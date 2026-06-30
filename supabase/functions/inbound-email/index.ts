import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Public webhook that accepts inbound email events and stores them
// in public.app_messages so the in-app inbox can display them.
//
// Accepts JSON of the shape:
// { from, to, subject, body, attachment_url?, attachment_name?, thread_id?, metadata? }
//
// Configure your inbound email provider (e.g., Mailgun route, SendGrid Inbound Parse,
// CloudMailin, ImprovMX -> webhook, or a custom forwarder) to POST to this endpoint.

interface InboundPayload {
  from?: string
  to?: string
  subject?: string
  body?: string
  text?: string
  html?: string
  attachment_url?: string
  attachment_name?: string
  thread_id?: string
  metadata?: Record<string, unknown>
}

// Resend inbound webhook event shape (e.g. type: "inbound.email.created")
interface ResendInboundEvent {
  type?: string
  data?: {
    from?: string | { email?: string; name?: string }
    to?: string | string[]
    subject?: string
    text?: string
    html?: string
    message_id?: string
    headers?: Record<string, string>
    attachments?: Array<{ filename?: string; content_url?: string; url?: string }>
  }
}

function normalizeAddress(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) return value.map(normalizeAddress).filter(Boolean).join(', ')
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { email?: string; name?: string }
    return v.email ?? ''
  }
  return String(value)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Webhook authentication: require a shared secret on every inbound request
  // (configured at the email provider). Reject anything else so an attacker
  // can't forge messages into the admin inbox.
  const expectedSecret = Deno.env.get('INBOUND_EMAIL_SECRET')
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  const url = new URL(req.url)
  const providedSecret =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('x-inbound-secret') ??
    url.searchParams.get('key') ??
    ''
  // Constant-time-ish compare.
  const a = providedSecret
  const b = expectedSecret
  let mismatch = a.length === b.length ? 0 : 1
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  if (mismatch !== 0) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: InboundPayload = {}
  const contentType = req.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      const raw = await req.json()
      // Detect Resend inbound webhook envelope
      if (raw && typeof raw === 'object' && 'data' in raw && (raw as ResendInboundEvent).data) {
        const ev = raw as ResendInboundEvent
        const d = ev.data ?? {}
        const att = d.attachments?.[0]
        payload = {
          from: normalizeAddress(d.from),
          to: normalizeAddress(d.to),
          subject: d.subject,
          body: d.text || d.html || '',
          text: d.text,
          html: d.html,
          thread_id: d.message_id,
          attachment_url: att?.content_url || att?.url,
          attachment_name: att?.filename,
          metadata: { provider: 'resend', type: ev.type, headers: d.headers },
        }
      } else {
        payload = raw as InboundPayload
      }
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await req.formData()
      payload = {
        from: (form.get('from') || form.get('sender') || '') as string,
        to: (form.get('to') || form.get('recipient') || '') as string,
        subject: (form.get('subject') || '') as string,
        body: (form.get('body-plain') || form.get('text') || form.get('body') || '') as string,
        html: (form.get('body-html') || form.get('html') || '') as string,
        thread_id: (form.get('Message-Id') || form.get('message_id') || '') as string,
      }
    } else {
      const text = await req.text()
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { body: text }
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const from = (payload.from || '').toString().trim()
  const to = (payload.to || '').toString().trim()
  const subject = (payload.subject || '(no subject)').toString().trim()
  const body = (payload.body || payload.text || payload.html || '').toString()

  if (!from) {
    return new Response(JSON.stringify({ error: 'Missing "from"' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('app_messages')
    .insert({
      direction: 'inbound',
      from_email: from,
      to_email: to || 'inbox@notify.higherviewtaxesllc.com',
      subject,
      body,
      attachment_url: payload.attachment_url ?? null,
      attachment_name: payload.attachment_name ?? null,
      thread_id: payload.thread_id ?? null,
      status: 'received',
      metadata: payload.metadata ?? null,
      is_read: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to store inbound email', error)
    return new Response(JSON.stringify({ error: 'Failed to store message' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})