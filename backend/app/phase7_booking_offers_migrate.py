"""Multi-pujari booking offers within service radius."""

_PHASE7_STMTS = [
    """
    CREATE TABLE IF NOT EXISTS booking_pujari_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'invited',
      distance_km DOUBLE PRECISION,
      invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      rejection_reason TEXT,
      UNIQUE (booking_id, pujari_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_booking_pujari_offers_pujari ON booking_pujari_offers (pujari_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_booking_pujari_offers_booking ON booking_pujari_offers (booking_id, status)",
]
