-- Admin RBAC v2 (mirror of backend/app/rbac_migrate.py — run ONE of them; both are idempotent).
--  1. Admins with no admin_permissions rows get the pre-v2 default set materialised (no access lost).
--  2. Pre-v2 keys are expanded into the finer v2 catalogue.
--  3. Super-Admin-only keys are removed from role = 'admin' rows.
--  4. Marker row: afterwards, "no rows" means "no permissions".

CREATE TABLE IF NOT EXISTS rbac_migrations (
  key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rbac_migrations WHERE key = 'admin_rbac_v2') THEN
    RAISE NOTICE 'admin_rbac_v2 already applied';
    RETURN;
  END IF;

  -- 1. materialise the old implicit default for admins without rows
  INSERT INTO admin_permissions (user_id, permission)
  SELECT u.id, d.p
  FROM users u
  CROSS JOIN (VALUES
    ('view_customers'), ('create_customers'), ('edit_customers'),
    ('view_pujaris'), ('create_pujaris'), ('edit_pujaris'), ('approve_pujaris'), ('verify_pujaris'), ('block_pujaris'),
    ('view_bookings'), ('manage_bookings'), ('view_payments'), ('manage_support'), ('manage_promotions')
  ) AS d(p)
  WHERE u.role = 'admin'
    AND NOT EXISTS (SELECT 1 FROM admin_permissions ap WHERE ap.user_id = u.id)
  ON CONFLICT (user_id, permission) DO NOTHING;

  -- 2. expand pre-v2 keys
  INSERT INTO admin_permissions (user_id, permission)
  SELECT ap.user_id, e.new_key
  FROM admin_permissions ap
  JOIN users u ON u.id = ap.user_id AND u.role = 'admin'
  JOIN (VALUES
    ('manage_services', 'view_services'), ('manage_services', 'view_temples'), ('manage_services', 'manage_temples'),
    ('manage_services', 'view_recommendations'), ('manage_services', 'manage_recommendations'),
    ('manage_services', 'view_seva_events'), ('manage_services', 'manage_seva_events'),
    ('manage_samagri', 'view_samagri'),
    ('view_bookings', 'view_reviews'), ('view_bookings', 'manage_reviews'),
    ('view_bookings', 'view_virtual_puja'), ('view_bookings', 'view_muhurtham'),
    ('manage_bookings', 'manage_virtual_puja'), ('manage_bookings', 'manage_muhurtham'),
    ('manage_bookings', 'view_invoices'), ('manage_bookings', 'manage_invoices'), ('manage_bookings', 'view_seva_events'),
    ('view_payments', 'view_invoices'),
    ('manage_promotions', 'view_promotions'),
    ('manage_config', 'view_pricing'), ('manage_config', 'manage_pricing')
  ) AS e(old_key, new_key) ON e.old_key = ap.permission
  ON CONFLICT (user_id, permission) DO NOTHING;

  -- 3. Super-Admin-only capabilities are never effective for normal admins
  DELETE FROM admin_permissions ap
  USING users u
  WHERE u.id = ap.user_id AND u.role = 'admin'
    AND ap.permission IN ('manage_admins', 'manage_settlements', 'view_reports', 'view_financials', 'manage_config');

  INSERT INTO rbac_migrations (key, details) VALUES ('admin_rbac_v2', '{"source": "sql"}'::jsonb);
END $$;
