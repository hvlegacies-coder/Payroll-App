
ALTER TABLE public.offices ADD COLUMN process_frontend boolean NOT NULL DEFAULT false;
ALTER TABLE public.offices ADD COLUMN process_backend boolean NOT NULL DEFAULT false;
ALTER TABLE public.offices ADD COLUMN parent_office text NOT NULL DEFAULT '';
