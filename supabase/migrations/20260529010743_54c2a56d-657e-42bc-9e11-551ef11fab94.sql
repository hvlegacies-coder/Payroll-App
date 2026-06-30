ALTER TABLE public.payroll_weeks
  ADD COLUMN IF NOT EXISTS funding_date_from date,
  ADD COLUMN IF NOT EXISTS funding_date_to date;