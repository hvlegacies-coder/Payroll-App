-- Client edits in Clients.tsx / PayrollProcessing.tsx are matched back on reload by
-- normalizing ssn_ein/client_name (trim + uppercase + collapse whitespace), but the rows
-- were being written with raw, unnormalized text under a UNIQUE(ssn_ein, client_name)
-- constraint. Any formatting difference between the row instance a user edited and the
-- row instance rebuilt from the next weekly upload created a *new* override row instead
-- of updating the existing one, so the edit silently failed to re-apply on reload and
-- looked like it "reverted" back to the source data.
--
-- This migration merges any override rows that already diverged this way, then
-- normalizes all ssn_ein/client_name values in place so the existing unique constraint
-- keeps working now that the application always writes normalized keys (see Clients.tsx
-- and PayrollProcessing.tsx).

DO $$
DECLARE
  grp RECORD;
  row_rec RECORD;
  winner_id UUID;
  merged_belongs TEXT;
  merged_email TEXT;
  merged_location TEXT;
BEGIN
  FOR grp IN
    SELECT
      upper(trim(regexp_replace(ssn_ein, '\s+', ' ', 'g'))) AS norm_ssn,
      upper(trim(regexp_replace(client_name, '\s+', ' ', 'g'))) AS norm_name
    FROM public.client_overrides
    GROUP BY 1, 2
    HAVING count(*) > 1
  LOOP
    winner_id := NULL;
    merged_belongs := '';
    merged_email := '';
    merged_location := '';

    FOR row_rec IN
      SELECT id, client_belongs_to, email, location_name
      FROM public.client_overrides
      WHERE upper(trim(regexp_replace(ssn_ein, '\s+', ' ', 'g'))) = grp.norm_ssn
        AND upper(trim(regexp_replace(client_name, '\s+', ' ', 'g'))) = grp.norm_name
      ORDER BY updated_at DESC
    LOOP
      IF winner_id IS NULL THEN
        winner_id := row_rec.id;
      END IF;
      IF merged_belongs = '' AND row_rec.client_belongs_to <> '' THEN
        merged_belongs := row_rec.client_belongs_to;
      END IF;
      IF merged_email = '' AND row_rec.email <> '' THEN
        merged_email := row_rec.email;
      END IF;
      IF merged_location = '' AND row_rec.location_name <> '' THEN
        merged_location := row_rec.location_name;
      END IF;
    END LOOP;

    UPDATE public.client_overrides
    SET client_belongs_to = merged_belongs,
        email = merged_email,
        location_name = merged_location,
        ssn_ein = grp.norm_ssn,
        client_name = grp.norm_name,
        updated_at = now()
    WHERE id = winner_id;

    DELETE FROM public.client_overrides
    WHERE upper(trim(regexp_replace(ssn_ein, '\s+', ' ', 'g'))) = grp.norm_ssn
      AND upper(trim(regexp_replace(client_name, '\s+', ' ', 'g'))) = grp.norm_name
      AND id <> winner_id;
  END LOOP;
END $$;

UPDATE public.client_overrides
SET ssn_ein = upper(trim(regexp_replace(ssn_ein, '\s+', ' ', 'g'))),
    client_name = upper(trim(regexp_replace(client_name, '\s+', ' ', 'g')))
WHERE ssn_ein <> upper(trim(regexp_replace(ssn_ein, '\s+', ' ', 'g')))
   OR client_name <> upper(trim(regexp_replace(client_name, '\s+', ' ', 'g')));
