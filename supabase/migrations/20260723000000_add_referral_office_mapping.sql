-- Manual mapping of referral-app referrers to payroll offices, since the
-- separate Referral app has no concept of "office". Filled in by an admin
-- from the Referral Program page; consumed by Office Summary's Referral
-- Payouts table.
CREATE TABLE public.referral_office_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_name text NOT NULL,
  referrer_email text,
  office_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (referrer_name)
);

ALTER TABLE public.referral_office_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to referral_office_mapping"
  ON public.referral_office_mapping
  FOR ALL
  USING (true)
  WITH CHECK (true);
