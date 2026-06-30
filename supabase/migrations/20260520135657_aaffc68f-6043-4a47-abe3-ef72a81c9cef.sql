
CREATE TABLE public.sub_account_table_visibility (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL,
  office_name text NOT NULL,
  hidden_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, office_name)
);

ALTER TABLE public.sub_account_table_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to sub_account_table_visibility"
ON public.sub_account_table_visibility
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_sub_account_table_visibility_updated_at
BEFORE UPDATE ON public.sub_account_table_visibility
FOR EACH ROW EXECUTE FUNCTION public.update_office_summary_configs_updated_at();
