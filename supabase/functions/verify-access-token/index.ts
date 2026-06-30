import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Verifies an HMAC-signed access token issued by verify-access-password.

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
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

  let body: { token?: string; scope?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = String(body.token ?? '')
  const scope = String(body.scope ?? '').trim()
  const parts = token.split('.')
  if (parts.length !== 2) {
    return new Response(JSON.stringify({ ok: false, error: 'malformed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const [payload, sig] = parts
  const expected = await sign(payload, tokenSecret)
  if (!timingSafeEqual(sig, expected)) {
    return new Response(JSON.stringify({ ok: false, error: 'bad_signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  let decoded: { scope?: string; exp?: number }
  try {
    decoded = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)))
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'malformed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const nowSec = Math.floor(Date.now() / 1000)
  if (!decoded.exp || decoded.exp < nowSec) {
    return new Response(JSON.stringify({ ok: false, error: 'expired' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (scope && decoded.scope !== scope) {
    return new Response(JSON.stringify({ ok: false, error: 'scope_mismatch' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, scope: decoded.scope, exp: decoded.exp }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
