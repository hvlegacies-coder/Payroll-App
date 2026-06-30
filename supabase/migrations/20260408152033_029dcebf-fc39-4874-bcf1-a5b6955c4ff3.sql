
CREATE TABLE public.office_fee_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_name TEXT NOT NULL,
  fee_type TEXT NOT NULL,
  target_office TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'percentage',
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(office_name, fee_type, target_office)
);

ALTER TABLE public.office_fee_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to office_fee_configs"
  ON public.office_fee_configs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
