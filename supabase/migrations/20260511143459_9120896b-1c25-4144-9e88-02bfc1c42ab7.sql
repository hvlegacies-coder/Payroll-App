CREATE TABLE public.office_summary_calc_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  operands jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_summary_calc_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to office_summary_calc_templates"
ON public.office_summary_calc_templates
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_office_summary_calc_templates_updated_at
BEFORE UPDATE ON public.office_summary_calc_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_office_summary_configs_updated_at();