UPDATE office_summary_configs
SET tables = (
  SELECT jsonb_agg(
    CASE WHEN t->>'title' = 'Fees Due' THEN
      jsonb_set(t, '{fields}', (
        SELECT jsonb_agg(
          CASE WHEN f->>'fieldId' = 'p_high_prep'
            THEN jsonb_set(f, '{filters}', '{"efin":"","preparer":"","taxOffice":""}'::jsonb)
            ELSE f END
        )
        FROM jsonb_array_elements(t->'fields') f
      ))
    ELSE t END
  )
  FROM jsonb_array_elements(tables) t
),
updated_at = now()
WHERE office_name = 'D & D';