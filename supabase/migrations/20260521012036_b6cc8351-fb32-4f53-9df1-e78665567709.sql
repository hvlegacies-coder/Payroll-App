
-- Messages table for sent & received emails
CREATE TABLE public.app_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  thread_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_messages_created_at ON public.app_messages(created_at DESC);
CREATE INDEX idx_app_messages_direction ON public.app_messages(direction);
CREATE INDEX idx_app_messages_thread ON public.app_messages(thread_id);

ALTER TABLE public.app_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to app_messages"
ON public.app_messages FOR ALL
USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_messages;

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read email attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-attachments');

CREATE POLICY "Anyone can upload email attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-attachments');

CREATE POLICY "Anyone can update email attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'email-attachments');

CREATE POLICY "Anyone can delete email attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'email-attachments');
