CREATE TABLE public.offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name text NOT NULL DEFAULT '',
  primary_efin text NOT NULL DEFAULT '',
  secondary_efin text NOT NULL DEFAULT '',
  share_percent numeric NOT NULL DEFAULT 0,
  process_advance boolean NOT NULL DEFAULT false,
  clients_belongs_data text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to offices" ON public.offices FOR ALL TO public USING (true) WITH CHECK (true);