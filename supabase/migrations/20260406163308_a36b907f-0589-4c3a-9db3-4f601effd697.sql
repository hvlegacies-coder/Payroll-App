
CREATE TABLE public.preparers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ptin TEXT NOT NULL,
  contractor TEXT NOT NULL,
  main_office TEXT NOT NULL DEFAULT '',
  tax_office TEXT NOT NULL DEFAULT '',
  efin TEXT NOT NULL DEFAULT '',
  efin2 TEXT NOT NULL DEFAULT '',
  share_percent NUMERIC NOT NULL DEFAULT 0,
  shared_efin_percent NUMERIC NOT NULL DEFAULT 0,
  roles TEXT NOT NULL DEFAULT '',
  preparer_client_percent NUMERIC NOT NULL DEFAULT 0,
  office_flat_rate NUMERIC NOT NULL DEFAULT 0,
  landing_tab TEXT NOT NULL DEFAULT '',
  availed_payroll NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.preparers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to preparers" ON public.preparers FOR ALL USING (true) WITH CHECK (true);
