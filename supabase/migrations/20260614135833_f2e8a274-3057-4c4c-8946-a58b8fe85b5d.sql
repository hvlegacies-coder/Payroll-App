ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS source_file_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS uploads_dedupe_key
  ON public.uploads (account_id, type, week_label, source_file_hash)
  WHERE source_file_hash IS NOT NULL;