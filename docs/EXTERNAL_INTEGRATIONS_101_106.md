# External provider integration contracts (req #101–102, #106)

These features have **application-side configuration and data models** in BSeva.
They are **not** end-to-end wired to a live third-party provider.

## #101–102 Call forwarding

### Config already in platform settings
- `call_forwarding_enabled`
- `call_forwarding_office_hours` (e.g. `09:00-18:00`)
- `call_forwarding_timezone` (e.g. `Asia/Kolkata`)
- `call_forwarding_primary_number`
- `call_forwarding_forward_to`

### Adapter contract (future)
Implement a provider module e.g. `app/telephony/provider.py` with:

```python
def sync_forwarding_rules(cfg: dict) -> None:
    """Push office-hours + numbers to Twilio / Exotel / etc."""

def resolve_route(now: datetime, cfg: dict) -> str:
    """Return primary vs forward number based on hours/timezone."""
```

Hook points:
- Admin Settings save → call `sync_forwarding_rules`
- Optional inbound webhook for call events → notifications

Do **not** claim forwarding works until a provider is configured and `sync_forwarding_rules` is implemented.

## #106 Astrology voice / video

### App-side fields (schema)
- `muhurta_consultations.consultation_type` (`voice` | `video`)
- `provider_session_id`
- `join_status` (`pending` | `ready` | `ended` | `failed`)

### Booking already supports
- Admin-configurable duration / fee / availability via Settings + service muhurta fees

### Adapter contract (future)
```python
def create_session(*, booking_id: str, mode: Literal["voice","video"], participants: list[str]) -> dict:
    """Return { provider_session_id, join_url_customer, join_url_pujari, expires_at }."""

def end_session(provider_session_id: str) -> None: ...
```

Wire after consultation confirm:
1. Create provider session
2. Persist `provider_session_id` + `join_status=ready`
3. Expose join URLs only to authorized customer + assigned pujari
4. Never expose personal phone as the meeting channel when virtual mode is used

Suggested providers: Agora, Twilio Video, Daily.co — pick one and implement the adapter above.
