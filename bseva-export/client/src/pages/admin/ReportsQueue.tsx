import { displayTokenLabel, formatIndianPhone } from "@bseva/config";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { AdminCountCards } from "@/components/admin/AdminCountCards";
import { parsePage } from "@/components/AdminPager";
import { StaticHead } from "@/components/SortableHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminPath } from "@/const";
import { useAdminCan } from "@/hooks/useAdminPermissions";
import { api, apiErrorInfo } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import {
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  reportReasonLabel,
  reportStatusClass,
} from "@/lib/compliance";

/** User reports (complaints). Not the Super Admin analytics "Reports" page. */
const BASE = "/reports-queue";
const API = "/admin/user-reports";

type Person = { id?: string; name?: string | null; email?: string | null; phone?: string | null; role?: string | null };

type ReportRow = {
  id: string;
  target_type: string;
  target_id?: string;
  booking_id?: string | null;
  booking_number?: string | null;
  reason: string;
  details?: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  resolution?: string | null;
  reporter_name?: string | null;
  reporter_role?: string | null;
  target_name?: string | null;
};

type Counts = { open?: number; in_review?: number; escalated?: number; resolved?: number; dismissed?: number };
type ListResponse = { items: ReportRow[]; total: number; page: number; pages: number; counts?: Counts };

type HistoryItem = {
  action?: string;
  status?: string;
  from_status?: string | null;
  to_status?: string | null;
  actor_name?: string | null;
  note?: string | null;
  detail?: string | null;
  resolution?: string | null;
  created_at: string;
};

type ReportDetail = {
  report?: ReportRow;
  reporter?: Person | null;
  target?: (Person & { summary?: string | null; booking_number?: string | null; service_name?: string | null }) | null;
  history?: HistoryItem[];
  events?: HistoryItem[];
} & Partial<ReportRow>;

const STATUSES = ["open", "in_review", "escalated", "resolved", "dismissed"] as const;

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-normal", reportStatusClass(status))}>
      {REPORT_STATUS_LABELS[status] || displayTokenLabel(status)}
    </Badge>
  );
}

function ReportsList() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const status = params.get("status") || "all";
  const targetType = params.get("type") || "all";
  const urlPage = parsePage(params.get("page"));
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(next: { status?: string; type?: string; page?: number }) {
    const sp = new URLSearchParams();
    const st = next.status ?? status;
    const ty = next.type ?? targetType;
    const reset = next.status !== undefined || next.type !== undefined;
    const p = next.page ?? (reset ? 1 : urlPage);
    if (st !== "all") sp.set("status", st);
    if (ty !== "all") sp.set("type", ty);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    setLocation(`${adminPath(BASE)}${qs ? `?${qs}` : ""}`);
  }

  async function load() {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(urlPage) });
      if (status !== "all") qs.set("status", status);
      if (targetType !== "all") qs.set("target_type", targetType);
      setData(await api<ListResponse>(`${API}?${qs}`));
    } catch (err) {
      setError(apiErrorInfo(err, "Could not load reports.").message);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const counts = data?.counts || {};
  const rows = data?.items || [];

  return (
    <>
      <AdminCountCards
        active={status}
        onSelect={(key) => update({ status: key === status ? "all" : key })}
        cards={[
          { key: "open", label: "Open", value: counts.open },
          { key: "in_review", label: "In review", value: counts.in_review, tone: "warn" },
          { key: "escalated", label: "Escalated", value: counts.escalated, tone: "danger" },
          { key: "resolved", label: "Resolved", value: counts.resolved, tone: "ok" },
          { key: "dismissed", label: "Dismissed", value: counts.dismissed },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger className="w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {REPORT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={targetType} onValueChange={(v) => update({ type: v })}>
            <SelectTrigger className="w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pujari">Pujari</SelectItem>
              <SelectItem value="booking">Booking</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            Page {data?.page || urlPage}/{data?.pages || 1} · {data?.total || 0}
          </span>
          <Button size="sm" variant="outline" disabled={urlPage <= 1} onClick={() => update({ page: urlPage - 1 })}>
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={urlPage >= (data?.pages || 1)}
            onClick={() => update({ page: urlPage + 1 })}
          >
            Next
          </Button>
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
            <StaticHead label="Reported" />
            <StaticHead label="Type" />
            <StaticHead label="Reason" />
            <StaticHead label="Reporter" />
            <StaticHead label="About" />
            <StaticHead label="Status" />
            <StaticHead label="" className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-xs">{formatDisplayDateTime(r.created_at)}</TableCell>
              <TableCell className="text-sm">{REPORT_TARGET_LABELS[r.target_type] || r.target_type}</TableCell>
              <TableCell className="min-w-[12rem] max-w-[18rem] whitespace-normal text-sm">
                <div className="font-medium">{reportReasonLabel(r.reason)}</div>
                {r.details ? (
                  <div className="line-clamp-2 text-xs text-muted-foreground" title={r.details}>
                    {r.details}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">
                {r.reporter_name || "—"}
                {r.reporter_role ? (
                  <div className="text-xs text-muted-foreground">{displayTokenLabel(r.reporter_role)}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">
                {r.target_name || "—"}
                {r.booking_number ? <div className="font-mono text-xs text-muted-foreground">{r.booking_number}</div> : null}
              </TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
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
      {!data && !error ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : null}
      {data && rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No reports match this filter.</p> : null}
    </>
  );
}

function PersonBlock({ title, person }: { title: string; person?: Person | null }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {person ? (
        <>
          <p className="font-medium">{person.name || "—"}</p>
          {person.role ? <p className="text-muted-foreground">{displayTokenLabel(person.role)}</p> : null}
          {person.email ? <p className="break-all text-muted-foreground">{person.email}</p> : null}
          {person.phone ? <p className="text-muted-foreground">{formatIndianPhone(person.phone)}</p> : null}
        </>
      ) : (
        <p className="text-muted-foreground">—</p>
      )}
    </div>
  );
}

function ReportDetailView({ id }: { id: string }) {
  const { can } = useAdminCan();
  const canManage = can("manage_complaints");
  const [data, setData] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      setData(await api<ReportDetail>(`${API}/${encodeURIComponent(id)}`));
    } catch (err) {
      setError(apiErrorInfo(err, "Could not load this report.").message);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!nextStatus) return setFormError("Choose a status.");
    const closing = nextStatus === "resolved" || nextStatus === "dismissed";
    if (closing && !resolution.trim()) return setFormError("Write a resolution note. The reporter can see it.");
    setBusy(true);
    setFormError(null);
    try {
      const body: Record<string, string> = { status: nextStatus };
      if (resolution.trim()) body.resolution = resolution.trim();
      if (note.trim()) body.note = note.trim();
      await api(`${API}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(`Report marked ${REPORT_STATUS_LABELS[nextStatus] || nextStatus}`);
      setNextStatus("");
      setResolution("");
      setNote("");
      await load();
    } catch (err) {
      setFormError(apiErrorInfo(err, "Could not update the report.").message);
    } finally {
      setBusy(false);
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

  const report: ReportRow = (data.report || data) as ReportRow;
  const history = data.history || data.events || [];
  const target = data.target;
  const bookingRef = target?.booking_number || report.booking_number || report.booking_id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1">
          {REPORT_TARGET_LABELS[report.target_type] || report.target_type} report
        </h1>
        <StatusBadge status={report.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{reportReasonLabel(report.reason)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Reported {formatDisplayDateTime(report.created_at)} · ID <span className="font-mono">{report.id}</span>
            </p>
            {report.details ? <p className="whitespace-pre-line rounded-md bg-muted/40 p-3">{report.details}</p> : null}
            {bookingRef ? (
              <p>
                <span className="text-muted-foreground">Booking: </span>
                <Link
                  href={`${adminPath("/bookings")}?q=${encodeURIComponent(String(bookingRef))}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {bookingRef}
                </Link>
                {target?.service_name ? ` · ${target.service_name}` : ""}
              </p>
            ) : null}
            {report.resolution ? (
              <p>
                <span className="text-muted-foreground">Resolution: </span>
                {report.resolution}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <PersonBlock title="Reporter" person={data.reporter} />
            <PersonBlock
              title={`Reported ${REPORT_TARGET_LABELS[report.target_type]?.toLowerCase() || "target"}`}
              person={target ? { ...target, name: target.name || target.summary || null } : null}
            />
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update status</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={save}>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== "open" && s !== report.status).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={nextStatus === s ? "default" : s === "escalated" ? "destructive" : "outline"}
                    onClick={() => setNextStatus(s)}
                  >
                    {s === "escalated" ? "Escalate" : `Mark ${REPORT_STATUS_LABELS[s].toLowerCase()}`}
                  </Button>
                ))}
              </div>
              {nextStatus === "resolved" || nextStatus === "dismissed" ? (
                <div className="space-y-1">
                  <Label htmlFor="report-resolution">Resolution (shown to the reporter)</Label>
                  <Textarea
                    id="report-resolution"
                    rows={3}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label htmlFor="report-note">Internal note (optional)</Label>
                <Textarea id="report-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <Button type="submit" disabled={busy || !nextStatus}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length ? (
            <ol className="space-y-3 border-l border-border pl-4 text-sm">
              {history.map((h, i) => {
                const label = h.to_status
                  ? `Status: ${REPORT_STATUS_LABELS[h.to_status] || h.to_status}`
                  : h.status
                    ? `Status: ${REPORT_STATUS_LABELS[h.status] || h.status}`
                    : displayTokenLabel(h.action || "update");
                return (
                  <li key={i}>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDateTime(h.created_at)} · {h.actor_name || "System"}
                    </p>
                    {h.resolution ? <p className="mt-1">Resolution: {h.resolution}</p> : null}
                    {h.note || h.detail ? <p className="mt-1 whitespace-pre-line">{h.note || h.detail}</p> : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsQueuePage() {
  const params = useParams<{ id?: string }>();
  const id = params.id ? String(params.id) : "";
  return (
    <AdminLayout>
      {id ? (
        <>
          <Link href={adminPath(BASE)} className="mb-4 inline-flex items-center gap-1 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" /> All reports
          </Link>
          <ReportDetailView id={id} />
        </>
      ) : (
        <ReportsList />
      )}
    </AdminLayout>
  );
}
