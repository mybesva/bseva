export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_for_user",
  "escalated",
  "resolved",
  "closed",
] as const;

export const EMPTY_SUPPORT_TICKET = {
  reporter_type: "customer",
  contact_source: "phone",
  subject: "",
  category: "other",
  priority: "medium",
  description: "",
  expected_resolution: "",
  additional_info: "",
  assigned_admin_id: "",
  sla_hours: "",
  guest_name: "",
  guest_phone: "",
  guest_email: "",
};

export const SUPPORT_REPORTER_TYPES = [
  { id: "customer", label: "Customer" },
  { id: "pujari", label: "Pujari" },
  { id: "temple", label: "Temple" },
  { id: "other", label: "Other" },
] as const;

export const SUPPORT_CONTACT_SOURCES = [
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "in_app", label: "In app" },
] as const;

export const SUPPORT_PRIORITIES = [
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
] as const;

export const SUPPORT_CATEGORIES = [
  { id: "booking", label: "Booking" },
  { id: "payment", label: "Payment" },
  { id: "cancellation_refund", label: "Cancellation / Refund" },
  { id: "puja_seva", label: "Puja / Seva" },
  { id: "pujari", label: "Pujari" },
  { id: "customer", label: "Customer" },
  { id: "samagri", label: "Samagri" },
  { id: "rescheduling", label: "Rescheduling" },
  { id: "technical", label: "Technical / Website" },
  { id: "other", label: "Other" },
] as const;
