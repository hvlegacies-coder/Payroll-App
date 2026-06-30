CREATE TABLE public.office_summary_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_name text NOT NULL UNIQUE,
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.office_summary_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to office_summary_configs"
  ON public.office_summary_configs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_office_summary_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_office_summary_configs_updated_at
BEFORE UPDATE ON public.office_summary_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_office_summary_configs_updated_at();