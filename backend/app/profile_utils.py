import json
from datetime import datetime, timezone

CURRENT_TERMS_VERSION = "2026-01"
CURRENT_PRIVACY_VERSION = "2026-01"

PUJARI_REQUIRED = (
    "first_name",
    "last_name",
    "mobile_number",
    "date_of_birth",
    "gotra",
    "pravara",
    "profile_photo_path",
    "address_line1",
    "city",
    "state",
    "pincode",
    "latitude",
    "longitude",
    "sampradaya",
)


def parse_json_list(raw) -> list:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:
        return [p.strip() for p in str(raw).split(",") if p.strip()]


def pujari_profile_missing_required(row: dict) -> list[str]:
    """Human-readable missing required fields for verification submit."""
    missing: list[str] = []
    quals = parse_json_list(row.get("qualifications"))
    langs = parse_json_list(row.get("languages"))
    for key in PUJARI_REQUIRED:
        val = quals if key == "qualifications" else row.get(key)
        if val in (None, "", [], False):
            missing.append(key)
    # Qualifications are optional; the year is only needed once one is ticked.
    if quals and row.get("qualification_year") in (None, ""):
        missing.append("qualification_year")
    exp = row.get("experience_years")
    if exp in (None, ""):
        missing.append("experience_years")
    if not langs:
        missing.append("languages")
    return missing


def pujari_completion(row: dict) -> int:
    quals = parse_json_list(row.get("qualifications"))
    filled = 0
    for key in PUJARI_REQUIRED:
        val = quals if key == "qualifications" else row.get(key)
        if val not in (None, "", [], False):
            filled += 1
    total = len(PUJARI_REQUIRED)
    if quals:
        total += 1
        if row.get("qualification_year") not in (None, ""):
            filled += 1
    return round(100 * filled / total)


def pujari_profile_status(row: dict, angikara_status: str | None = None) -> str:
    pct = int(row.get("profile_completion_percentage") or 0)
    submitted = row.get("profile_submitted_at")
    vstatus = row.get("verification_status") or "pending"
    # Admin-approved only counts as Verified when profile is submitted or 100% complete.
    # Seed/test accounts may be approved early — UI should not say Verified at 77%.
    if vstatus == "approved" and (submitted or pct >= 100):
        return "verified"
    if vstatus == "rejected":
        return "rejected"
    if vstatus == "under_review" or (submitted and vstatus == "pending"):
        return "under_review"
    if submitted:
        return "submitted"
    if pct >= 100:
        return "ready_for_submission"
    return "profile_incomplete"


def utcnow():
    return datetime.now(timezone.utc)
