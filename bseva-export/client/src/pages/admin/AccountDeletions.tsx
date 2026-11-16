import { displayTokenLabel, formatIndianPhone } from "@bseva/config";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { AdminCountCards } from "@/components/admin/AdminCountCards";
import { AdminPager, DEFAULT_PAGE_SIZE, parsePage, parsePageSize } from "@/components/AdminPager";
import { StaticHead } from "@/components/SortableHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminPath } from "@/const";
import { useAdminCan } from "@/hooks/useAdminPermissions";
import { api, apiErrorInfo, rupees } from "@/lib/api";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import {
  DELETION_STATE_LABELS,
  deletionStateClass,
  reasonLabel,
  type DeletionObligations,
} from "@/lib/compliance";

const BASE = "/account-deletions";

type DeletionListItem = {
  id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
  phone: string;
  account_created_at: string;
  requested_at: string;
  deadline_at: string;
  reason: string;
  explanation: string;
  booking_count: number;
  active_bookings: number;
  financial_status: string;
  assigned_admin_name: string | null;
  state: string;
  overdue: boolean;
};

type Counts = {
  total?: number;
  requested?: number;
  pending_resolution?: number;
  ready?: number;
  deleted?: number;
  cancelled?: number;
  escalated?: number;
  overdue?: number;
};

type ListResponse = { items: DeletionListItem[]; total: number; page: number; pages: number; counts?: Counts };

type DeletionDetail = {
  request: Partial<DeletionListItem> & {
    id: string;
    state: string;
    reason: string;
    explanation: string;
    requested_at: string;
    deadline_at: string;
    cancelled_at?: string | null;
    completed_at?: string | null;
    message?: string;
    assigned_admin_id?: string | null;
    escalation_reason?: string | null;
  };
  user: { name: string; email: string; phone: string; role: string; created_at: string };
  obligations: Partial<DeletionObligations>;
  events: { action: string; actor_name: string | null; detail: unknown; created_at: string }[];
};

const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "requested", label: "New" },
  { key: "pending_resolution", label: "Pending resolution" },
  { key: "ready", label: "Ready" },
  { key: "escalated", label: "Escalated" },
  { key: "overdue", label: "Overdue" },
  { key: "deleted", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function StateBadge({ state, overdue }: { state: string; overdue?: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="outline" className={cn("whitespace-nowrap font-normal", deletionStateClass(state))}>
        {DELETION_STATE_LABELS[state] || displayTokenLabel(state)}
      </Badge>
      {overdue ? (
        <Badge variant="destructive" className="font-normal">
          Overdue
        </Badge>
      ) : null}
    </div>
  );
}

function roleLabel(role: string) {
  return role === "head_pujari" ? "Head Pujari" : displayTokenLabel(role);
}

function DeletionsList() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const status = params.get("status") || "all";
  const pageSize = parsePageSize(params.get("size"));
  const urlPage = parsePage(params.get("page"));
  const [q, setQ] = useState(params.get("q") || "");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(next: { status?: string; q?: string; page?: number; size?: number }) {
    const sp = new URLSearchParams();
    const st = next.status ?? status;
    const query = next.q ?? (params.get("q") || "");
    const size = next.size ?? pageSize;
    const reset = next.status !== undefined || next.q !== undefined || next.size !== undefined;
    const p = next.page ?? (reset ? 1 : urlPage);
    if (st !== "all") sp.set("status", st);
    if (query.trim()) sp.set("q", query.trim());
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    setLocation(`${adminPath(BASE)}${qs ? `?${qs}` : ""}`);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(urlPage), page_size: String(pageSize) });
      if (status !== "all") qs.set("status", status);
      const query = (params.get("q") || "").trim();
      if (query) qs.set("q", query);
      setData(await api<ListResponse>(`/admin/account-deletions?${qs}`));
    } catch (err) {
      setError(apiErrorInfo(err, "Could not load deletion requests.").message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQ(params.get("q") || "");
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const counts = data?.counts || {};
  const rows = data?.items || [];

  return (
    <>
      <AdminCountCards
        active={status === "all" ? "total" : status}
        onSelect={(key) => update({ status: key === "total" ? "all" : key })}
        cards={[
          { key: "total", label: "Total", value: counts.total },
          { key: "requested", label: "New", value: counts.requested },
          { key: "pending_resolution", label: "Pending resolution", value: counts.pending_resolution, tone: "warn" },
          { key: "ready", label: "Ready", value: counts.ready, tone: "ok" },
          { key: "escalated", label: "Escalated", value: counts.escalated, tone: "danger" },
          { key: "overdue", label: "Overdue", value: counts.overdue, tone: "danger" },
          { key: "deleted", label: "Completed", value: counts.deleted },
          { key: "cancelled", label: "Cancelled", value: counts.cancelled },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger className="w-[13rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[12.5rem] flex-1 gap-2">
          <Input
            placeholder="Search name, email, phone or request ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ q });
            }}
          />
          <Button type="button" variant="secondary" onClick={() => update({ q })}>
            Search
          </Button>
          {params.get("q") ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQ("");
                update({ q: "" });
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <div className="ml-auto">
          <AdminPager
            page={data?.page || urlPage}
            pages={data?.pages || 1}
            total={data?.total || 0}
            pageSize={pageSize}
            onPage={(p) => update({ page: p })}
            onPageSize={(size) => update({ size })}
            sizeLabel="rows / page"
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <Table
        className="border-separate border-spacing-0"
        containerClassName="max-h-[calc(100vh-20rem)] overflow-auto rounded-lg border bg-card"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <StaticHead label="Request" />
            <StaticHead label="User" />
            <StaticHead label="Dates" />
            <StaticHead label="Reason" />
            <StaticHead label="Bookings" />
            <StaticHead label="Money" />
            <StaticHead label="Assigned" />
            <StaticHead label="State" />
            <StaticHead label="" className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap font-mono text-xs" title={r.id}>
                {r.id.slice(0, 8)}
                <div className="font-sans text-xs text-muted-foreground">{roleLabel(r.role)}</div>
              </TableCell>
              <TableCell className="min-w-[11rem] whitespace-normal text-sm">
                <div className="font-medium">{r.name || "—"}</div>
                <div className="break-all text-xs text-muted-foreground">{r.email}</div>
                <div className="text-xs text-muted-foreground">{formatIndianPhone(r.phone)}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                <div>Joined {formatDisplayDate(r.account_created_at)}</div>
                <div>Requested {formatDisplayDate(r.requested_at)}</div>
                <div className={cn(r.overdue && "font-semibold text-destructive")}>
                  Deadline {formatDisplayDate(r.deadline_at)}
                </div>
              </TableCell>
              <TableCell className="min-w-[12rem] max-w-[16rem] whitespace-normal text-sm">
                <div className="font-medium">{reasonLabel(r.reason)}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground" title={r.explanation}>
                  {r.explanation}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {r.active_bookings} active
                <div className="text-xs text-muted-foreground">{r.booking_count} total</div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{displayTokenLabel(r.financial_status)}</TableCell>
              <TableCell className="text-sm">{r.assigned_admin_name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
              <TableCell>
                <StateBadge state={r.state} overdue={r.overdue} />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setLocation(adminPath(`${BASE}/${r.id}`))}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {loading && !data ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : null}
      {data && rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No deletion requests match this filter.</p> : null}
    </>
  );
}

type ActionKind = "note" | "review" | "escalate" | null;

function DeletionDetailView({ id }: { id: string }) {
  const { can, isSuper } = useAdminCan();
  const canManage = can("manage_account_deletions");
  const [data, setData] = useState<DeletionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [action, setAction] = useState<ActionKind>(null);
  const [text, setText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      setData(await api<DeletionDetail>(`/admin/account-deletions/${encodeURIComponent(id)}`));
    } catch (err) {
      setError(apiErrorInfo(err, "Could not load this request.").message);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!canManage) return;
    api<{ id: string; name: string }[]>("/admin/admins-lite")
      .then((list) => setAdmins(Array.isArray(list) ? list : []))
      .catch(() => setAdmins([]));
  }, [canManage]);

  async function post(path: string, body: Record<string, unknown>, success: string) {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/admin/account-deletions/${encodeURIComponent(id)}/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(success);
      setAction(null);
      setText("");
      await load();
      return true;
    } catch (err) {
      const msg = apiErrorInfo(err, "Action failed.").message;
      setActionError(msg);
      if (!action) toast.error(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitAction(e: React.FormEvent) {
    e.preventDefault();
    if (action === "note") {
      if (!text.trim()) return setActionError("Write a note.");
      await post("note", { note: text.trim() }, "Note added");
    } else if (action === "review") {
      await post("review-complete", text.trim() ? { note: text.trim() } : {}, "Review marked complete");
    } else if (action === "escalate") {
      if (!text.trim()) return setActionError("Give a reason for escalating.");
      await post("escalate", { reason: text.trim() }, "Request escalated");
    }
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }

  const { request, user, obligations, events } = data;
  const bookings = obligations.bookings || [];
  const blocking = obligations.blocking || [];
  const wallet = Number(obligations.wallet_balance_paise || 0);
  const settlement = Number(obligations.pending_settlement_paise || 0);
  const isPujari = user.role === "pujari" || user.role === "head_pujari";
  const closed = request.state === "deleted" || request.state === "cancelled";
  const userLink = request.user_id
    ? isPujari
      ? adminPath(`/pujaris/${request.user_id}`)
      : `${adminPath("/customers")}?q=${encodeURIComponent(user.email)}`
    : `${adminPath(isPujari ? "/pujaris" : "/customers")}?q=${encodeURIComponent(user.email)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1">{user.name || "Deletion request"}</h1>
        <StateBadge state={request.state} overdue={request.overdue} />
      </div>

      {canManage && !closed ? (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="space-y-1">
              <Label className="text-xs">Assigned to</Label>
              <Select
                value={request.assigned_admin_id || (request.assigned_admin_name ? "" : "none")}
                onValueChange={(v) =>
                  void post("assign", { admin_id: v === "none" ? null : v }, v === "none" ? "Unassigned" : "Assigned")
                }
                disabled={busy}
              >
                <SelectTrigger className="w-[14rem]">
                  <SelectValue placeholder={request.assigned_admin_name || "Unassigned"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => setAction("note")}>
              Add note
            </Button>
            <Button onClick={() => setAction("review")}>Mark review complete</Button>
            <Button variant="destructive" onClick={() => setAction("escalate")}>
              Escalate
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Final deletion runs automatically on day 14 for requests that are ready. Refunds and payouts use the
              settlement and wallet screens.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Assigned to: {request.assigned_admin_name || "Unassigned"}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Request ID: </span>
              <span className="font-mono text-xs">{request.id}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Requested: </span>
              {formatDisplayDateTime(request.requested_at)}
            </p>
            <p className={cn(request.overdue && "font-semibold text-destructive")}>
              <span className="text-muted-foreground">Deadline: </span>
              {formatDisplayDate(request.deadline_at)}
            </p>
            {request.cancelled_at ? (
              <p>
                <span className="text-muted-foreground">Cancelled: </span>
                {formatDisplayDateTime(request.cancelled_at)}
              </p>
            ) : null}
            {request.completed_at ? (
              <p>
                <span className="text-muted-foreground">Completed: </span>
                {formatDisplayDateTime(request.completed_at)}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Reason: </span>
              {reasonLabel(request.reason)}
            </p>
            <p className="whitespace-pre-line rounded-md bg-muted/40 p-2">{request.explanation}</p>
            {request.escalation_reason ? (
              <p>
                <span className="text-muted-foreground">Escalation reason: </span>
                {request.escalation_reason}
              </p>
            ) : null}
            {request.message ? <p className="text-xs text-muted-foreground">User sees: {request.message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name: </span>
              <Link href={userLink} className="text-primary hover:underline">
                {user.name || "—"}
              </Link>
            </p>
            <p>
              <span className="text-muted-foreground">Role: </span>
              {roleLabel(user.role)}
            </p>
            <p className="break-all">
              <span className="text-muted-foreground">Email: </span>
              {user.email}
            </p>
            <p>
              <span className="text-muted-foreground">Phone: </span>
              {formatIndianPhone(user.phone)}
            </p>
            <p>
              <span className="text-muted-foreground">Account created: </span>
              {formatDisplayDate(user.created_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Obligations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {blocking.length ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              <p className="font-semibold">Blocking final deletion</p>
              <ul className="list-disc pl-5">
                {blocking.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">Nothing is blocking final deletion.</p>
          )}

          {bookings.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Booking</th>
                    <th className="py-1 pr-3">Service</th>
                    <th className="py-1 pr-3">Date</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1 pr-3">Action needed</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <Link
                          href={`${adminPath("/bookings")}?q=${encodeURIComponent(b.booking_number || b.id)}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {b.booking_number || b.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{b.service_name}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        {formatDisplayDate(b.booking_date)} {b.start_time}
                      </td>
                      <td className="py-2 pr-3">{displayTokenLabel(b.status)}</td>
                      <td className="py-2 pr-3">
                        {b.action === "reassign"
                          ? "Reassign to another pujari"
                          : b.kind === "ongoing"
                            ? "Let it finish"
                            : b.cancellation
                              ? `Cancel: refund ${rupees(b.cancellation.refund_paise)}, fee ${rupees(b.cancellation.fee_paise)}`
                              : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">No open bookings.</p>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="font-semibold">{wallet < 0 ? `−${rupees(Math.abs(wallet))}` : rupees(wallet)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Pending refunds</p>
              <p className="font-semibold">{Number(obligations.pending_refunds || 0)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Pending settlement</p>
              <p className="font-semibold">{rupees(settlement)}</p>
              {settlement && isSuper ? (
                <Link
                  href={`${adminPath("/settlements")}?q=${encodeURIComponent(user.email)}`}
                  className="text-xs text-primary hover:underline"
                >
                  Open settlements
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length ? (
            <ol className="space-y-3 border-l border-border pl-4 text-sm">
              {events.map((ev, i) => (
                <li key={i}>
                  <p className="font-medium">{displayTokenLabel(ev.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayDateTime(ev.created_at)} · {ev.actor_name || "System"}
                  </p>
                  {formatEventDetail(ev.detail) ? <p className="mt-1 whitespace-pre-line">{formatEventDetail(ev.detail)}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={action !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAction(null);
            setText("");
            setActionError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "note" ? "Add note" : action === "review" ? "Mark review complete" : "Escalate request"}
            </DialogTitle>
            <DialogDescription>
              {action === "review"
                ? "Confirms every obligation is resolved, so the account can be deleted on schedule."
                : action === "escalate"
                  ? "Escalation is recorded in the history and the user is told the request needs more time."
                  : "Notes are visible to other admins in the history."}
            </DialogDescription>
          </DialogHeader>
          <form id="deletion-action-form" onSubmit={submitAction} className="space-y-2">
            <Label htmlFor="deletion-action-text">
              {action === "escalate" ? "Reason" : action === "review" ? "Note (optional)" : "Note"}
            </Label>
            <Textarea
              id="deletion-action-text"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              required={action !== "review"}
            />
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAction(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="deletion-action-form"
              variant={action === "escalate" ? "destructive" : "default"}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** History "detail" is JSONB on the server ({reason, source, deadline, ...}); show it as readable text, never as an object. */
function formatEventDetail(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== "" && !(typeof v === "object" && !Object.keys(v as object).length))
    .map(([k, v]) => `${k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n");
}

export default function AccountDeletionsPage() {
  const params = useParams<{ id?: string }>();
  const id = params.id ? String(params.id) : "";
  return (
    <AdminLayout>
      {id ? (
        <>
          <Link href={adminPath(BASE)} className="mb-4 inline-flex items-center gap-1 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" /> All deletion requests
          </Link>
          <DeletionDetailView id={id} />
        </>
      ) : (
        <DeletionsList />
      )}
    </AdminLayout>
  );
}
