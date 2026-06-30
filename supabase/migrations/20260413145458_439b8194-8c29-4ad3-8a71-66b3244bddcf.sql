
CREATE TABLE public.client_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ssn_ein TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_belongs_to TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ssn_ein, client_name)
);

ALTER TABLE public.client_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to client_overrides"
  ON public.client_overrides FOR ALL
  USING (true) WITH CHECK (true);
