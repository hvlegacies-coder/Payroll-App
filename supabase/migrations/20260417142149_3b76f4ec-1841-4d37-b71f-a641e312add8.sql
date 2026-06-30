
ALTER TABLE public.preparer_payroll_weeks
  ADD CONSTRAINT preparer_payroll_weeks_ptin_week_unique UNIQUE (ptin, week_label);

CREATE POLICY "Allow update for all"
  ON public.preparer_payroll_weeks FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete for all"
  ON public.preparer_payroll_weeks FOR DELETE
  USING (true);
