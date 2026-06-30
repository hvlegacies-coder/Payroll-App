
CREATE TABLE public.payroll_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  start_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to payroll_weeks"
  ON public.payroll_weeks FOR ALL
  USING (true) WITH CHECK (true);

-- Only one active week at a time
CREATE UNIQUE INDEX payroll_weeks_one_active
  ON public.payroll_weeks (is_active) WHERE is_active = true;

ALTER TABLE public.uploads
  ADD COLUMN week_label text NOT NULL DEFAULT 'April 10, 2026';

-- Backfill all existing uploads as April 10, 2026
UPDATE public.uploads SET week_label = 'April 10, 2026';

-- Seed weeks: April 10 archived, April 17 active
INSERT INTO public.payroll_weeks (label, start_date, is_active) VALUES
  ('April 10, 2026', '2026-04-10', false),
  ('April 17, 2026', '2026-04-17', true);

-- New uploads default to current active week via trigger
CREATE OR REPLACE FUNCTION public.set_upload_active_week()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE active_label text;
BEGIN
  IF NEW.week_label IS NULL OR NEW.week_label = 'April 10, 2026' THEN
    SELECT label INTO active_label FROM public.payroll_weeks WHERE is_active = true LIMIT 1;
    IF active_label IS NOT NULL THEN
      NEW.week_label = active_label;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER uploads_set_active_week
  BEFORE INSERT ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_upload_active_week();

CREATE INDEX uploads_week_label_idx ON public.uploads (week_label);
