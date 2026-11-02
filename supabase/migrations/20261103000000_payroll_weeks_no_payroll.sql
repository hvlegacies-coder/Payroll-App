-- Lets admins mark a week as having no payroll (nothing to upload), with a note.
alter table public.payroll_weeks
  add column if not exists no_payroll boolean not null default false,
  add column if not exists no_payroll_note text;
