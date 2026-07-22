import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Secure proxy: the separate Referral app (higher-view-referral-app) runs on
// its own Supabase project with Row Level Security locked to its own admin
// sessions, so it can't be queried directly from this app's browser client.
// This function uses that project's service-role key (kept only as a Supabase
// secret on this project, never shipped to the browser) to read payout data
// server-side and returns a sanitized subset to the authenticated caller.
//
// Confirmed schema (via service-role OpenAPI introspection):
//   payout_reports: id, referrer_id, amount, referral_ids, status,
//                   payment_method, notes, processed_at, created_at
//   referrers:      id, name, email, ... (joined via referrer_id)
//   referrals:      id, referrer_id, referred_name, referred_email, status,
//                   commission_amount, ... (looked up via payout_reports.referral_ids)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const referralUrl = Deno.env.get('REFERRAL_SUPABASE_URL')
  const referralServiceKey = Deno.env.get('REFERRAL_SUPABASE_SERVICE_ROLE_KEY')
  if (!referralUrl || !referralServiceKey) {
    return new Response(JSON.stringify({ error: 'Referral integration is not configured (missing REFERRAL_SUPABASE_URL / REFERRAL_SUPABASE_SERVICE_ROLE_KEY secrets).' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const referralClient = createClient(referralUrl, referralServiceKey)

    const { data, error } = await referralClient
      .from('payout_reports')
      .select('id, amount, status, payment_method, processed_at, created_at, referral_ids, referrer:referrers(name, email)')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rows = data ?? []
    const allReferralIds = Array.from(new Set(rows.flatMap((r: Record<string, any>) => r.referral_ids ?? [])))

    let referralsById: Record<string, { name: string; email: string; amount: number; status: string }> = {}
    if (allReferralIds.length > 0) {
      const { data: referralRows } = await referralClient
        .from('referrals')
        .select('id, referred_name, referred_email, status, commission_amount')
        .in('id', allReferralIds)
      referralsById = Object.fromEntries((referralRows ?? []).map((r: Record<string, any>) => [
        r.id,
        {
          name: r.referred_name ?? '',
          email: r.referred_email ?? '',
          amount: Number(r.commission_amount ?? 0),
          status: r.status ?? '',
        },
      ]))
    }

    const payouts = rows.map((row: Record<string, any>) => ({
      id: row.id,
      referrerName: row.referrer?.name ?? '',
      referrerEmail: row.referrer?.email ?? '',
      amount: Number(row.amount ?? 0),
      method: row.payment_method ?? '',
      status: row.status ?? '',
      date: row.processed_at ?? row.created_at ?? null,
      referrals: (row.referral_ids ?? [])
        .map((rid: string) => referralsById[rid])
        .filter(Boolean),
    }))

    return new Response(JSON.stringify({ payouts }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
