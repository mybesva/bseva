from __future__ import annotations

SERVICE_TYPES = frozenset({"puja", "chadhava", "pravachan"})
PARTICIPATION_MODES = frozenset({"offline", "online", "hybrid"})
REGISTRATION_PARTICIPATION = frozenset({"offline", "online"})
PUJA_EVENT_KINDS = frozenset({"group_live", "proxy"})
EVENT_STATUSES = frozenset({"draft", "published", "cancelled", "completed", "live"})
REGISTRATION_STATUSES = frozenset({"pending", "confirmed", "cancelled", "completed", "refunded"})
PAYMENT_STATUSES = frozenset({"pending", "paid", "free", "refunded", "failed"})
PRASAD_STATUSES = frozenset({"not_applicable", "preparing", "ready", "shipped", "delivered"})
FAMILY_RELATIONSHIPS = frozenset({"self", "spouse", "parent", "child", "other"})
