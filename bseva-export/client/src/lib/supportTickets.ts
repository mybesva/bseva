export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_for_user",
  "escalated",
  "resolved",
  "closed",
] as const;

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
  in_app: "In-App",
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

export type SupportTicket = Record<string, any>;

export type TicketListResponse = {
  items: SupportTicket[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  counts?: Record<string, number>;
};

export function statusClass(status: string) {
  switch (status) {
    case "open":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "in_progress":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "waiting_for_user":
      return "bg-violet-100 text-violet-800 border-violet-200";
    case "escalated":
      return "bg-red-100 text-red-800 border-red-200";
    case "resolved":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "closed":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export function priorityClass(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-600 text-white border-red-600";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "low":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export function asTicketList(data: TicketListResponse | SupportTicket[] | unknown): TicketListResponse {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, page_size: data.length || 20, pages: 1, counts: {} };
  }
  const d = data as TicketListResponse;
  return {
    items: d.items || [],
    total: d.total || 0,
    page: d.page || 1,
    page_size: d.page_size || 20,
    pages: d.pages || 1,
    counts: d.counts || {},
  };
}
