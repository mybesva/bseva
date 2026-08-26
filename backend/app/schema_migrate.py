from sqlalchemy import text

from app.db import engine

_STMTS = [
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS full_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS father_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS gotra TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS native_place TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS permanent_address TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS present_address TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS mobile_number TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS qualifications TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS qualification_year INTEGER",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS sampradaya TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS website_publication_consent BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS signature_path TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_consent BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_consent_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version TEXT",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS district TEXT",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India'",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS district TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India'",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS gender TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS languages TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS specializations TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_submitted_at TIMESTAMPTZ",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS final_submission_consent BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS final_submission_consent_at TIMESTAMPTZ",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
    """
    CREATE TABLE IF NOT EXISTS pujari_angikara (
      pujari_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'not_started',
      snapshot JSONB,
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_document_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL DEFAULT 'ANGIKARA_PATRAM',
      version_number INTEGER NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_blocked_dates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_date DATE NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pujari_id, blocked_date)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      level INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT,
      examples JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS legal_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '2026-01',
      sort_order INTEGER NOT NULL DEFAULT 0,
      points JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
]

_DEFAULT_PUJARI_ROLES = [
    (1, "Vehicle / Basic Rituals", "Simple rituals such as vehicle puja and other basic rites configured by Admin.", ["Vehicle Puja", "Basic vehicle-related pujas", "Simple/basic rituals"]),
    (2, "Basic Pujas", "Regular household and devotional pujas.", ["Ganapathi Puja", "Lakshmi Puja", "Satyanarayana Puja", "Basic house pujas"]),
    (3, "Main / Major Pujas", "Important or complex ceremonies.", ["Marriage ceremonies", "Gruha Pravesham", "Major house/family ceremonies"]),
    (4, "All Services", "All Level 1–3 services plus any additional advanced services configured by Admin.", ["All Level 1, 2 and 3 services", "Additional advanced services"]),
]


def _seed_pujari_roles(conn) -> None:
    count = conn.execute(text("SELECT COUNT(*) FROM pujari_roles")).scalar() or 0
    if count:
        return
    import json

    for level, title, summary, examples in _DEFAULT_PUJARI_ROLES:
        conn.execute(
            text(
                """
                INSERT INTO pujari_roles (level, title, summary, examples)
                VALUES (:level, :title, :summary, CAST(:examples AS jsonb))
                """
            ),
            {"level": level, "title": title, "summary": summary, "examples": json.dumps(examples)},
        )


_DEFAULT_LEGAL_POLICIES = [
    {
        "slug": "platform_terms",
        "title": "Platform Terms & Conditions",
        "sort_order": 1,
        "points": [
            {"title": "About BSeva", "body": "BSeva is a platform that connects customers with pujaris for religious and ceremonial services. These Terms govern your use of the BSeva website and applications."},
            {"title": "Accounts", "body": "You must provide accurate registration information and keep your credentials secure. BSeva may suspend accounts that violate these Terms or applicable law."},
            {"title": "Pujari verification", "body": "Pujaris must complete profile verification before receiving bookings. Approved service levels are assigned by BSeva administrators after review of submitted information and documents."},
            {"title": "Acceptable use", "body": "You may not misuse the platform, upload false information, harass other users, or attempt unauthorized access to systems or data."},
            {"title": "Changes", "body": "BSeva may update these Terms. Material changes will be reflected by an updated version date. Continued use after changes constitutes acceptance of the updated Terms."},
        ],
    },
    {
        "slug": "booking_terms",
        "title": "Booking Terms & Conditions",
        "sort_order": 2,
        "points": [
            {"title": "Booking confirmation", "body": "Confirming a booking means you accept the selected service, pujari, date, time, package (Standard/Premium), and mode (In-person or Virtual)."},
            {"title": "Availability", "body": "Bookings are subject to availability, pujari verification, and service-level eligibility."},
            {"title": "Pricing", "body": "The checkout total may include GST, service charges and peak-day fees. The amount shown at checkout is charged to your wallet."},
            {"title": "Pujari levels", "body": "Pujaris may only be booked for services allowed by their Admin-approved service level."},
            {"title": "Demo notice", "body": "This is a demonstration application. Payments, OTP, maps, wallets, and document reviews may be mocked."},
        ],
    },
    {
        "slug": "cancellation_policy",
        "title": "Cancellation Policy",
        "sort_order": 3,
        "points": [
            {"title": "More than 48 hours before booking", "body": "10% cancellation charge, 90% refund to your Customer Wallet."},
            {"title": "Between 24 and 48 hours before booking", "body": "50% cancellation charge, 50% refund to your Customer Wallet."},
            {"title": "Less than 24 hours before booking", "body": "Cancellation is not permitted."},
            {"title": "How timing is calculated", "body": "Cancellation is calculated from the scheduled booking date and time versus the current date and time."},
        ],
    },
    {
        "slug": "privacy",
        "title": "Privacy Policy",
        "sort_order": 4,
        "points": [
            {"title": "Information we collect", "body": "We collect account details, contact information, profile data, addresses, location coordinates, booking history, documents submitted by pujaris, and technical usage data needed to operate the service."},
            {"title": "How we use information", "body": "Information is used to create and manage accounts, match customers with nearby pujaris, process bookings, verify pujari credentials, provide support, and improve the platform."},
            {"title": "Sharing", "body": "We share necessary booking and contact details between customers and assigned pujaris. We do not sell personal information. Service providers assisting BSeva may process data under appropriate safeguards."},
            {"title": "Storage and security", "body": "Data is stored in secured systems with access controls. Passwords are stored using industry-standard hashing. Uploaded documents are accessible only to authorized users."},
            {"title": "Your choices", "body": "You may update profile information, change your password, and request account assistance through BSeva support channels where available."},
            {"title": "Updates", "body": "This Privacy Policy may be updated periodically. The version date indicates the latest revision."},
        ],
    },
]


def _seed_legal_policies(conn) -> None:
    count = conn.execute(text("SELECT COUNT(*) FROM legal_policies")).scalar() or 0
    if count:
        return
    import json

    for policy in _DEFAULT_LEGAL_POLICIES:
        conn.execute(
            text(
                """
                INSERT INTO legal_policies (slug, title, version, sort_order, points)
                VALUES (:slug, :title, '2026-01', :sort_order, CAST(:points AS jsonb))
                """
            ),
            {
                "slug": policy["slug"],
                "title": policy["title"],
                "sort_order": policy["sort_order"],
                "points": json.dumps(policy["points"]),
            },
        )


def ensure_schema() -> None:
    with engine.begin() as conn:
        for stmt in _STMTS:
            conn.execute(text(stmt))
        _seed_pujari_roles(conn)
        _seed_legal_policies(conn)


def ensure_pujari_profile_schema() -> None:
    ensure_schema()
