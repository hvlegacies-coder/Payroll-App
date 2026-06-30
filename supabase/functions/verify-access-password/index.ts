import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Verifies a shared-scope password server-side and returns a short-lived
// HMAC-signed token. Replaces the previous client-side password literals.
// Scopes: "sub" (sub-account login), "kingj" (King J owner login),
// "admin_lock" (admin lock dialog).

const SCOPE_SECRETS: Record<string, string | undefined> = {
  sub: Deno.env.get('SUB_ACCOUNT_PASSWORD'),
  kingj: Deno.env.get('KINGJ_OWNER_PASSWORD'),
  admin_lock: Deno.env.get('ADMIN_LOCK_PASSWORD'),
}

const SCOPE_TTL_SECONDS: Record<string, number> = {
  sub: 60 * 60 * 12, // 12h
  kingj: 60 * 60 * 12,
  admin_lock: 60 * 60 * 4, // 4h
}

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

async function sign(payload: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload))
  return b64url(new Uint8Array(sig))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const tokenSecret = Deno.env.get('ACCESS_TOKEN_SECRET')
  if (!tokenSecret) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { scope?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const scope = String(body.scope ?? '').trim()
  const password = String(body.password ?? '')
  const expected = SCOPE_SECRETS[scope]
  if (!expected || typeof password !== 'string' || password.length === 0) {
    return new Response(JSON.stringify({ error: 'invalid' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!timingSafeEqual(password, expected)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const ttl = SCOPE_TTL_SECONDS[scope] ?? 3600
  const exp = Math.floor(Date.now() / 1000) + ttl
  const payloadObj = { scope, exp }
  const payload = b64url(new TextEncoder().encode(JSON.stringify(payloadObj)))
  const sig = await sign(payload, tokenSecret)
  const token = `${payload}.${sig}`

  return new Response(JSON.stringify({ ok: true, token, exp }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
