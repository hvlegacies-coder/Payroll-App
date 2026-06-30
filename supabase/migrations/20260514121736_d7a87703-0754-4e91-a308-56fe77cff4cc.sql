-- ============================================================
-- 1. accounts (GHL-style sub-accounts)
-- ============================================================
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  branding_logo_url text NOT NULL DEFAULT '',
  branding_primary_color text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. account_users
-- ============================================================
CREATE TABLE public.account_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, username)
);

ALTER TABLE public.account_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to account_users" ON public.account_users FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_account_users_username ON public.account_users(username);

-- ============================================================
-- 3. audit_log
-- ============================================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL DEFAULT '',
  entity_label text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor);
CREATE INDEX idx_audit_log_entity_type ON public.audit_log(entity_type);

-- ============================================================
-- 4. Seed parent + sub account
-- ============================================================
INSERT INTO public.accounts (name, slug, parent_account_id, branding_primary_color)
VALUES ('Higher View', 'higher-view', NULL, '43 85% 55%');

INSERT INTO public.accounts (name, slug, parent_account_id, branding_primary_color)
SELECT 'King J', 'king-j', id, '45 80% 55%' FROM public.accounts WHERE slug = 'higher-view';

-- ============================================================
-- 5. Seed admin users on Higher View
-- ============================================================
INSERT INTO public.account_users (account_id, username, role)
SELECT a.id, u.username, 'owner'
FROM public.accounts a
CROSS JOIN (VALUES ('Payroll'), ('Michael'), ('OlBrown'), ('Julius')) AS u(username)
WHERE a.slug = 'higher-view';

-- ============================================================
-- 6. account_id on tenant tables + backfill to Higher View
-- ============================================================
DO $$
DECLARE
  hv_id uuid;
  t text;
  tables text[] := ARRAY[
    'offices','preparers','client_overrides','uploads','upload_rows',
    'payroll_weeks','preparer_payroll_weeks','office_fee_configs',
    'office_summary_configs','office_summary_calc_templates','notifications'
  ];
BEGIN
  SELECT id INTO hv_id FROM public.accounts WHERE slug = 'higher-view';
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET account_id = $1 WHERE account_id IS NULL', t) USING hv_id;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_account_id ON public.%I(account_id)', t, t);
  END LOOP;
END $$;