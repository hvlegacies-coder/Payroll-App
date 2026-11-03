-- Runs the email queue dispatcher (process-email-queue) every 10 seconds.
-- The Lovable-era job and its vault secret didn't come over in the move.
-- The job authenticates with its own random secret, generated here and kept
-- only in vault (never in code or git); the function checks it through
-- email_queue_cron_secret_ok().

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_queue_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'email_queue_cron_secret');
  end if;
end $$;

create or replace function public.email_queue_cron_secret_ok(secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'email_queue_cron_secret' and decrypted_secret = secret
  );
$$;
revoke all on function public.email_queue_cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.email_queue_cron_secret_ok(text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'process-email-queue';

select cron.schedule(
  'process-email-queue',
  '10 seconds',
  $$
  select net.http_post(
    url := 'https://csasgyodywfvnycvrbga.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from pgmq.q_transactional_emails)
     or exists (select 1 from pgmq.q_auth_emails)
  $$
);
