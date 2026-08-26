import json
from datetime import datetime, timezone

CURRENT_TERMS_VERSION = "2026-01"
CURRENT_PRIVACY_VERSION = "2026-01"

PUJARI_REQUIRED = (
    "full_name",
    "mobile_number",
    "date_of_birth",
    "profile_photo_path",
    "address_line1",
    "city",
    "state",
    "pincode",
    "latitude",
    "longitude",
    "qualifications",
    "qualification_year",
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


def pujari_completion(row: dict) -> int:
    quals = parse_json_list(row.get("qualifications"))
    filled = 0
    for key in PUJARI_REQUIRED:
        val = quals if key == "qualifications" else row.get(key)
        if val not in (None, "", [], False):
            filled += 1
    return round(100 * filled / len(PUJARI_REQUIRED))


def pujari_profile_status(row: dict, angikara_status: str | None = None) -> str:
    pct = int(row.get("profile_completion_percentage") or 0)
    submitted = row.get("profile_submitted_at")
    vstatus = row.get("verification_status") or "pending"
    if vstatus == "approved":
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
