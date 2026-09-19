import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import AdminPageHeader from "@/components/AdminPageHeader";
import { AdminPager, DEFAULT_PAGE_SIZE, parsePage, parsePageSize } from "@/components/AdminPager";
import CreateTicketDialog from "@/components/support/CreateTicketDialog";
import TicketWorkspace from "@/components/support/TicketWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { adminPath } from "@/const";
import { formatDisplayDateTime } from "@/lib/formatDate";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  REPORTER_LABELS,
  STATUS_LABELS,
  asTicketList,
  priorityClass,
  statusClass,
  type SupportTicket,
} from "@/lib/supportTickets";
import { notifyBadgesChanged } from "@/components/NotificationBell";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

type Meta = {
  agents?: { id: string; name?: string }[];
  categories?: { id: string; label: string }[];
};

export default function AdminSupport() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const ticketId = params.get("ticket");
  const statusFilter = params.get("status") || "all";
  const priorityFilter = params.get("priority") || "all";
  const categoryFilter = params.get("category") || "all";
  const reporterFilter = params.get("reporter") || "all";
  const pageSize = parsePageSize(params.get("size"));
  const urlPage = parsePage(params.get("page"));
  const qParam = params.get("q") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const [q, setQ] = useState(qParam);
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [meta, setMeta] = useState<Meta>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatReply, setChatReply] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const agents = meta.agents || [];

  function go(next: Record<string, string | number | undefined>) {
    const sp = new URLSearchParams();
    const merged: Record<string, string> = {
      status: statusFilter,
      priority: priorityFilter,
      category: categoryFilter,
      reporter: reporterFilter,
      q: qParam,
      from,
      to,
      size: String(pageSize),
      page: String(urlPage),
      ticket: ticketId || "",
      ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v == null ? "" : String(v)])),
    };
    if (merged.status && merged.status !== "all") sp.set("status", merged.status);
    if (merged.priority && merged.priority !== "all") sp.set("priority", merged.priority);
    if (merged.category && merged.category !== "all") sp.set("category", merged.category);
    if (merged.reporter && merged.reporter !== "all") sp.set("reporter", merged.reporter);
    if (merged.q.trim()) sp.set("q", merged.q.trim());
    if (merged.from) sp.set("from", merged.from);
    if (merged.to) sp.set("to", merged.to);
    if (Number(merged.size) !== DEFAULT_PAGE_SIZE) sp.set("size", merged.size);
    if (Number(merged.page) > 1) sp.set("page", merged.page);
    if (merged.ticket) sp.set("ticket", merged.ticket);
    const qs = sp.toString();
    setLocation(adminPath(`/support${qs ? `?${qs}` : ""}`));
  }

  async function loadList() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(urlPage),
        page_size: String(pageSize),
        sort: "created_at",
        dir: "desc",
      });
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (priorityFilter !== "all") qs.set("priority", priorityFilter);
      if (categoryFilter !== "all") qs.set("category", categoryFilter);
      if (reporterFilter !== "all") qs.set("reporter_type", reporterFilter);
      if (qParam.trim()) qs.set("q", qParam.trim());
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const data = asTicketList(await api(`/support/tickets?${qs}`));
      setTickets(data.items);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
      setCounts(data.counts || {});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    try {
      setDetail(await api<SupportTicket>(`/support/tickets/${id}`));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function loadChat() {
    try {
      setConversations((await api<any[]>("/support/conversations").catch(() => [])) || []);
    } catch {
      setConversations([]);
    }
  }

  useEffect(() => {
    void api<Meta>("/support/tickets/meta").then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    setQ(qParam);
    setFromDate(from);
    setToDate(to);
    if (ticketId) void loadDetail(ticketId);
    else {
      setDetail(null);
      void loadList();
    }
    void loadChat();
  }, [search]);

  async function openConversation(id: string) {
    setActiveConv(id);
    setChatOpen(true);
    try {
      setMessages(await api<any[]>(`/support/conversations/${id}/messages`));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function sendChat() {
    if (!activeConv || !chatReply.trim()) return;
    try {
      await api(`/support/conversations/${activeConv}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: chatReply.trim() }),
      });
      setChatReply("");
      await openConversation(activeConv);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function convertChat() {
    if (!activeConv) return;
    try {
      const res = await api<{ id: string }>(`/support/conversations/${activeConv}/to-ticket`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Chat linked to ticket");
      notifyBadgesChanged();
      go({ ticket: res.id, page: 1 });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const summary = useMemo(() => {
    const all = counts.all ?? total;
    return [
      { id: "all", label: "All Tickets", n: all },
      { id: "open", label: "Open", n: counts.open || 0 },
      { id: "in_progress", label: "In Progress", n: counts.in_progress || 0 },
      { id: "waiting_for_user", label: "Waiting", n: counts.waiting_for_user || 0 },
      { id: "escalated", label: "Escalated", n: counts.escalated || 0 },
      { id: "resolved", label: "Resolved", n: counts.resolved || 0 },
      { id: "closed", label: "Closed", n: counts.closed || 0 },
    ];
  }, [counts, total]);

  const openChats = conversations.filter((c) => !["closed", "resolved"].includes(String(c.status || "open")));

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Support"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!ticketId && (
              <AdminPager
                page={page}
                pages={pages}
                total={total}
                pageSize={pageSize}
                onPage={(p) => go({ page: p })}
                onPageSize={(size) => go({ size, page: 1 })}
                sizeLabel="tickets / page"
              />
            )}
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Create Ticket
            </Button>
          </div>
        }
      />

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agents={agents}
        onCreated={(id) => {
          notifyBadgesChanged();
          go({ ticket: id, page: 1 });
        }}
      />

      {detail && ticketId ? (
        <TicketWorkspace
          ticket={detail}
          agents={agents}
          onBack={() => go({ ticket: "" })}
          onChange={() => {
            notifyBadgesChanged();
            void loadDetail(ticketId);
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
            {summary.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => go({ status: c.id, page: 1, ticket: "" })}
                className={`rounded-xl border p-3 text-left transition ${
                  statusFilter === c.id ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40"
                }`}
              >
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-semibold mt-1">{c.n}</div>
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["urgent", "high", "medium", "low"] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={priorityFilter === p ? "default" : "outline"}
                    onClick={() => go({ priority: priorityFilter === p ? "all" : p, page: 1 })}
                  >
                    {PRIORITY_LABELS[p]}
                  </Button>
                ))}
              </div>
              <div className="grid lg:grid-cols-6 md:grid-cols-3 gap-2">
                <div className="lg:col-span-2 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={q}
                    placeholder="Ticket ID, name, phone, booking, agent…"
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") go({ q, from: fromDate, to: toDate, page: 1 });
                    }}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={(v) => go({ category: v, page: 1 })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={reporterFilter} onValueChange={(v) => go({ reporter: v, page: 1 })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Reporter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reporters</SelectItem>
                    {Object.entries(REPORTER_LABELS).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => go({ q, from: fromDate, to: toDate, page: 1 })}>
                  Apply filters
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setFromDate("");
                    setToDate("");
                    go({ q: "", from: "", to: "", status: "all", priority: "all", category: "all", reporter: "all", page: 1 });
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Live chat (in-app)</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setChatOpen((v) => !v)}>
                {chatOpen ? "Hide" : `Show · ${openChats.length} open`}
              </Button>
            </CardHeader>
            {chatOpen && (
              <CardContent className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {conversations.length === 0 && <p className="text-sm text-muted-foreground">No chats.</p>}
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full text-left rounded-md border p-3 text-sm ${activeConv === c.id ? "border-primary bg-primary/5" : ""}`}
                      onClick={() => void openConversation(c.id)}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{c.subject || "Chat"}</span>
                        <Badge variant="secondary">{c.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.customer_name || c.customer_id}
                        {c.ticket_number ? ` · ${c.ticket_number}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="rounded-md border p-3 space-y-3 min-h-[200px]">
                  {!activeConv && <p className="text-sm text-muted-foreground">Select a conversation</p>}
                  {activeConv && (
                    <>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto">
                        {messages.map((m) => (
                          <div key={m.id} className="text-sm">
                            <span className="font-medium">{m.sender_role}: </span>
                            {m.body}
                          </div>
                        ))}
                      </div>
                      <Textarea value={chatReply} onChange={(e) => setChatReply(e.target.value)} rows={2} placeholder="Reply as agent…" />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void sendChat()}>
                          Send
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void convertChat()}>
                          Convert / link ticket
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && tickets.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">No tickets match these filters.</p>
              )}
              {tickets.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((t) => (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer"
                        onClick={() => go({ ticket: t.id })}
                      >
                        <TableCell className="font-medium whitespace-nowrap">
                          <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => go({ ticket: t.id })}>
                            {t.ticket_number}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{t.reporter_name || t.guest_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {REPORTER_LABELS[t.reporter_type] || t.reporter_type} · {t.reporter_public_id || t.reporter_phone || ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[220px] truncate">{t.subject}</div>
                          <div className="text-xs text-muted-foreground">{t.category_label || CATEGORY_LABELS[t.category] || t.category}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.booking_number || "—"}
                          {t.service_name ? <div className="text-muted-foreground">{t.service_name}</div> : null}
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityClass(t.priority)}>{t.priority_label || PRIORITY_LABELS[t.priority]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusClass(t.status)}>{t.status_label || STATUS_LABELS[t.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{t.assigned_agent_name || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDisplayDateTime(t.sla_due_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
