
-- Uploads table: tracks each file upload
CREATE TABLE public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  type TEXT NOT NULL,
  uploaded_by TEXT NOT NULL DEFAULT 'Admin',
  uploaded_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  rows_detected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upload rows table: stores parsed row data as JSONB
CREATE TABLE public.upload_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  row_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by upload_id
CREATE INDEX idx_upload_rows_upload_id ON public.upload_rows(upload_id);

-- Allow all access for now (no auth yet)
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to uploads" ON public.uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to upload_rows" ON public.upload_rows FOR ALL USING (true) WITH CHECK (true);
