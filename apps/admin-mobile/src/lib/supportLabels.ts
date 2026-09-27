export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_for_user: "Waiting for User",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const CATEGORY_LABELS: Record<string, string> = {
  booking: "Booking",
  payment: "Payment",
  cancellation_refund: "Cancellation / Refund",
  puja_seva: "Puja / Seva",
  pujari: "Pujari",
  customer: "Customer",
  samagri: "Samagri",
  rescheduling: "Rescheduling",
  technical: "Technical / Website",
  other: "Other",
};

export const REPORTER_LABELS: Record<string, string> = {
  customer: "Customer",
  pujari: "Pujari",
  temple: "Temple",
  other: "Other",
};

export const SOURCE_LABELS: Record<string, string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  email: "Email",
  in_app_chat: "In-App Chat",
  in_app: "In App",
  other: "Other",
};

export const EVENT_LABELS: Record<string, string> = {
  ticket_created: "Ticket Created",
  admin_created_ticket: "Admin Created Ticket",
  user_message: "Customer/Pujari Message",
  admin_reply: "Admin Reply",
  call_note: "Call Note",
  whatsapp_note: "WhatsApp Note",
  email_note: "Email Note",
  internal_note: "Internal Note",
  agent_assigned: "Agent Assigned",
  priority_changed: "Priority Changed",
  status_changed: "Status Changed",
  booking_linked: "Booking Linked",
  escalated: "Escalated",
  resolution_added: "Resolution Added",
  ticket_resolved: "Ticket Resolved",
  ticket_closed: "Ticket Closed",
  ticket_reopened: "Ticket Reopened",
  message: "Message",
};

export const OPEN_TICKET_STATUSES = new Set([
  "open",
  "pending",
  "new",
  "in_progress",
  "waiting_for_user",
  "escalated",
]);

export const FILTER_OPTIONS = [
  { id: "", label: "All" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "waiting_for_user", label: "Waiting" },
  { id: "resolved", label: "Resolved" },
] as const;
