"""Schema additions for requirements batch (language UX, fee, components, muhurta, astrology, penalties)."""

_PHASE3_STMTS = [
    # --- Services: category + cost components + muhurta ---
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'puja'",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS main_puja_price_paise INTEGER",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS samagri_price_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS alankaram_price_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS food_price_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS samagri_provider TEXT NOT NULL DEFAULT 'included'",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS alankaram_provider TEXT NOT NULL DEFAULT 'included'",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS food_provider TEXT NOT NULL DEFAULT 'included'",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS muhurta_consultation_enabled BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS muhurta_fee_paise INTEGER",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_muhurta BOOLEAN NOT NULL DEFAULT FALSE",
    "CREATE INDEX IF NOT EXISTS idx_services_category ON services (category)",
    # --- Pujari: pravara + joining fee ---
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS pravara TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS joining_fee_status TEXT NOT NULL DEFAULT 'not_required'",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS joining_fee_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS joining_fee_paid_at TIMESTAMPTZ",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS joining_fee_waived_by UUID",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS joining_fee_waived_reason TEXT",
    # --- Bookings: reject / reassign / components snapshot / consultation link ---
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS needs_reassignment BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_kind TEXT NOT NULL DEFAULT 'puja'",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS consultation_id UUID",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS samagri_charge_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS alankaram_charge_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS food_charge_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS main_puja_charge_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pujari_reimbursement_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_penalty_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assignment_history JSONB NOT NULL DEFAULT '[]'::jsonb",
    # Settlements: separate reimbursement from earnings
    "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS reimbursement_paise INTEGER NOT NULL DEFAULT 0",
    # --- Muhurta consultations ---
    """
    CREATE TABLE IF NOT EXISTS muhurta_consultations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES users(id),
      service_id UUID REFERENCES services(id),
      pujari_id UUID REFERENCES users(id),
      fee_paise INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'requested',
      guidance_notes TEXT,
      preferred_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_booking_id UUID REFERENCES bookings(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # --- Monthly / recommended pujas (config, not AI) ---
    """
    CREATE TABLE IF NOT EXISTS service_recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      audience TEXT NOT NULL DEFAULT 'customer',
      month_number INTEGER,
      recurrence_hint TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # --- Wallet ledger reason for penalties / joining fee ---
    "ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS meta JSONB",
]
