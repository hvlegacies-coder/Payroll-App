-- Office Summary → Preparer Share manual edits (fee/share overrides, colors,
-- notes, edit history). These were kept in each browser's localStorage, so
-- admins on different computers saw different totals. One row per former
-- storage key, e.g. "preparerFeeOverrides:Higher View:05/01/2026".
CREATE TABLE public.preparer_share_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.preparer_share_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access"
  ON public.preparer_share_state
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
