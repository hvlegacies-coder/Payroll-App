
-- Table linking auth users to preparers
CREATE TABLE public.preparer_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ptin TEXT NOT NULL,
  contractor_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(ptin)
);

ALTER TABLE public.preparer_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preparer link"
  ON public.preparer_users FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Weekly earnings snapshots for preparers
CREATE TABLE public.preparer_payroll_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label TEXT NOT NULL,
  ptin TEXT NOT NULL,
  preparer_name TEXT NOT NULL DEFAULT '',
  tax_office TEXT NOT NULL DEFAULT '',
  row_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_received NUMERIC NOT NULL DEFAULT 0,
  total_high_prep_fee NUMERIC NOT NULL DEFAULT 0,
  total_after_advance NUMERIC NOT NULL DEFAULT 0,
  total_pay NUMERIC NOT NULL DEFAULT 0,
  total_preparer_share NUMERIC NOT NULL DEFAULT 0,
  preparer_fee NUMERIC NOT NULL DEFAULT 0,
  total_share NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(week_label, ptin)
);

ALTER TABLE public.preparer_payroll_weeks ENABLE ROW LEVEL SECURITY;

-- Preparers can only see their own earnings
CREATE POLICY "Preparers see own weekly earnings"
  ON public.preparer_payroll_weeks FOR SELECT TO authenticated
  USING (
    ptin IN (SELECT pu.ptin FROM public.preparer_users pu WHERE pu.user_id = auth.uid())
  );

-- Admins (public/anon for now since no admin role table) can insert
CREATE POLICY "Allow insert for all"
  ON public.preparer_payroll_weeks FOR INSERT
  WITH CHECK (true);

-- Allow public read for admin pages
CREATE POLICY "Allow all select for admin"
  ON public.preparer_payroll_weeks FOR SELECT
  USING (true);
