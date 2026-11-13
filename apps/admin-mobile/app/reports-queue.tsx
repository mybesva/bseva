import { Ionicons } from "@expo/vector-icons";
import { displayTokenLabel, formatIndianPhone } from "@bseva/config";
import { formatDisplayDateTime } from "@bseva/locales";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  AppText,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  PrimaryButton,
  Screen,
  SuccessBanner,
} from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

/** User reports (complaints). Not the Super Admin analytics "Reports" page. */
const API = "/admin/user-reports";
const PAGE_SIZE = 20;

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
  detail?: unknown;
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

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_review: "In review",
  escalated: "Escalated",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const TARGET_LABELS: Record<string, string> = { pujari: "Pujari", booking: "Booking", customer: "Customer" };

const REASONS: Record<string, string> = {
  misconduct: "Misconduct or rude behaviour",
  no_show: "Did not show up",
  unsafe: "Unsafe behaviour",
  fraud: "Fraud or scam",
  payment: "Payment problem",
  inappropriate_content: "Inappropriate content",
  other: "Other",
};

const reasonLabel = (key: string) => REASONS[key] || key;
const statusLabel = (s: string) => STATUS_LABELS[s] || displayTokenLabel(s);
const targetLabel = (t: string) => TARGET_LABELS[t] || t;

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

function useStatusColor() {
  const { colors } = useAppTheme();
  return (status: string) =>
    status === "open"
      ? colors.info
      : status === "in_review"
        ? colors.warning
        : status === "escalated"
          ? colors.destructive
          : status === "resolved"
            ? colors.success
            : colors.mutedForeground;
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" }}>
      <AppText variant="small" color={color} style={{ fontWeight: "700", fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

function SheetModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <AppText variant="h3" style={{ flex: 1 }}>
            {title}
          </AppText>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PersonBlock({ title, person }: { title: string; person?: Person | null }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="eyebrow" color={colors.mutedForeground}>
        {title.toUpperCase()}
      </AppText>
      {person ? (
        <>
          <AppText style={{ fontWeight: "700" }}>{person.name || "—"}</AppText>
          {person.role ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {displayTokenLabel(person.role)}
            </AppText>
          ) : null}
          {person.email ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {person.email}
            </AppText>
          ) : null}
          {person.phone ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {formatIndianPhone(person.phone)}
            </AppText>
          ) : null}
        </>
      ) : (
        <AppText variant="small" color={colors.mutedForeground}>
          —
        </AppText>
      )}
    </View>
  );
}

function ReportDetailView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { colors } = useAppTheme();
  const statusColor = useStatusColor();
  const { can } = useAdmin();
  const canManage = can("manage_complaints");
  const [nextStatus, setNextStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["admin-user-report", id],
    queryFn: () => apiClient.api<ReportDetail>(`${API}/${encodeURIComponent(id)}`),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, string>) =>
      apiClient.api(`${API}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async (_d, body) => {
      setSuccess(`Report marked ${statusLabel(body.status)}`);
      setNextStatus("");
      setResolution("");
      setNote("");
      await detail.refetch();
      onChanged();
    },
    onError: (e) => setFormError(errMessage(e, "Could not update the report.")),
  });

  function submit() {
    setSuccess(null);
    if (!nextStatus) return setFormError("Choose a status.");
    const closing = nextStatus === "resolved" || nextStatus === "dismissed";
    if (closing && !resolution.trim()) return setFormError("Write a resolution note. The reporter can see it.");
    setFormError(null);
    const body: Record<string, string> = { status: nextStatus };
    if (resolution.trim()) body.resolution = resolution.trim();
    if (note.trim()) body.note = note.trim();
    save.mutate(body);
  }

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.error || !detail.data) {
    return (
      <View style={{ gap: 10 }}>
        <ErrorBanner message={errMessage(detail.error, "Could not load this report.")} />
        <PrimaryButton title="Retry" variant="outline" onPress={() => void detail.refetch()} />
      </View>
    );
  }

  const data = detail.data;
  const report = (data.report || data) as ReportRow;
  const history = data.history || data.events || [];
  const target = data.target;
  const bookingRef = target?.booking_number || report.booking_number || report.booking_id;
  const closing = nextStatus === "resolved" || nextStatus === "dismissed";

  return (
    <View style={{ gap: 12 }}>
      <SuccessBanner message={success} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <AppText variant="h2">{targetLabel(report.target_type)} report</AppText>
        <Pill label={statusLabel(report.status)} color={statusColor(report.status)} />
      </View>

      <Card>
        <AppText variant="h3">{reasonLabel(report.reason)}</AppText>
        <AppText variant="small" color={colors.mutedForeground}>
          Reported {formatDisplayDateTime(report.created_at)} · ID {report.id}
        </AppText>
        {report.details ? (
          <View style={{ backgroundColor: colors.muted, borderRadius: 8, padding: 10 }}>
            <AppText variant="small">{report.details}</AppText>
          </View>
        ) : null}
        {bookingRef ? (
          <AppText variant="small">
            Booking: {String(bookingRef)}
            {target?.service_name ? ` · ${target.service_name}` : ""}
          </AppText>
        ) : null}
        {report.resolution ? <AppText variant="small">Resolution: {report.resolution}</AppText> : null}
      </Card>

      <Card>
        <PersonBlock title="Reporter" person={data.reporter} />
        <PersonBlock
          title={`Reported ${targetLabel(report.target_type).toLowerCase() || "target"}`}
          person={target ? { ...target, name: target.name || target.summary || null } : null}
        />
      </Card>

      {canManage ? (
        <Card>
          <AppText variant="h3">Update status</AppText>
          <ChoiceChips
            options={STATUSES.filter((s) => s !== "open" && s !== report.status).map((s) => ({
              id: s,
              label: s === "escalated" ? "Escalate" : `Mark ${STATUS_LABELS[s].toLowerCase()}`,
            }))}
            value={nextStatus}
            onChange={(v) => {
              setNextStatus(v as string);
              setFormError(null);
            }}
          />
          {closing ? (
            <Field label="Resolution (shown to the reporter)" value={resolution} onChangeText={setResolution} multiline numberOfLines={3} />
          ) : null}
          <Field label="Internal note (optional)" value={note} onChangeText={setNote} multiline numberOfLines={2} />
          <ErrorBanner message={formError} />
          <PrimaryButton title={save.isPending ? "Saving…" : "Save"} onPress={submit} loading={save.isPending} disabled={save.isPending || !nextStatus} />
        </Card>
      ) : null}

      <Card>
        <AppText variant="h3">History</AppText>
        {history.length ? (
          history.map((h, i) => {
            const label = h.to_status
              ? `Status: ${statusLabel(h.to_status)}`
              : h.status
                ? `Status: ${statusLabel(h.status)}`
                : displayTokenLabel(h.action || "update");
            return (
              <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 10, gap: 2 }}>
                <AppText style={{ fontWeight: "700" }}>{label}</AppText>
                <AppText variant="small" color={colors.mutedForeground}>
                  {formatDisplayDateTime(h.created_at)} · {h.actor_name || "System"}
                </AppText>
                {h.resolution ? <AppText variant="small">Resolution: {h.resolution}</AppText> : null}
                {h.note || formatEventDetail(h.detail) ? <AppText variant="small">{h.note || formatEventDetail(h.detail)}</AppText> : null}
              </View>
            );
          })
        ) : (
          <AppText variant="small" color={colors.mutedForeground}>
            No history yet.
          </AppText>
        )}
      </Card>
    </View>
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

export default function AdminReportsQueue() {
  const { colors } = useAppTheme();
  const statusColor = useStatusColor();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const allowed = can(["view_complaints", "manage_complaints"]);
  const [status, setStatus] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-user-reports", status, targetType, page],
    enabled: allowed,
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (status !== "all") qs.set("status", status);
      if (targetType !== "all") qs.set("target_type", targetType);
      return apiClient.api<ListResponse>(`${API}?${qs}`);
    },
  });

  const counts = list.data?.counts || {};
  const rows = list.data?.items || [];

  return (
    <Screen>
      <ScreenHeader title="User Reports" back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        {!allowed ? (
          <EmptyState title="No access" subtitle="Your admin permissions do not include user reports." />
        ) : (
          <>
            <ChoiceChips
              horizontal
              options={[
                { id: "all", label: "All" },
                ...STATUSES.map((s) => ({
                  id: s,
                  label: `${STATUS_LABELS[s]}${counts[s] != null ? ` (${counts[s]})` : ""}`,
                })),
              ]}
              value={status}
              onChange={(v) => {
                setStatus(v as string);
                setPage(1);
              }}
            />
            <ChoiceChips
              horizontal
              options={[
                { id: "all", label: "All types" },
                { id: "pujari", label: "Pujari" },
                { id: "booking", label: "Booking" },
                { id: "customer", label: "Customer" },
              ]}
              value={targetType}
              onChange={(v) => {
                setTargetType(v as string);
                setPage(1);
              }}
            />
            {list.error ? (
              <>
                <ErrorBanner message={errMessage(list.error, "Could not load reports.")} />
                <PrimaryButton title="Retry" variant="outline" onPress={() => void list.refetch()} />
              </>
            ) : null}
            {list.isLoading ? <LoadingBlock /> : null}
            {list.data && rows.length === 0 ? <EmptyState title="No reports match this filter." /> : null}
            {rows.map((r) => (
              <Pressable key={r.id} onPress={() => setOpenId(r.id)} accessibilityRole="button">
                <Card compact>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                      {reasonLabel(r.reason)}
                    </AppText>
                    <Pill label={statusLabel(r.status)} color={statusColor(r.status)} />
                  </View>
                  <AppText variant="small" color={colors.mutedForeground}>
                    {targetLabel(r.target_type)} · {formatDisplayDateTime(r.created_at)}
                  </AppText>
                  {r.details ? (
                    <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
                      {r.details}
                    </AppText>
                  ) : null}
                  <AppText variant="small">
                    By {r.reporter_name || "—"}
                    {r.reporter_role ? ` (${displayTokenLabel(r.reporter_role)})` : ""}
                  </AppText>
                  <AppText variant="small">
                    About {r.target_name || "—"}
                    {r.booking_number ? ` · ${r.booking_number}` : ""}
                  </AppText>
                </Card>
              </Pressable>
            ))}
            {list.data && list.data.total > 0 ? (
              <AdminPagination
                page={list.data.page || page}
                pages={list.data.pages || 1}
                total={list.data.total || 0}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            ) : null}
          </>
        )}
      </ScrollView>
      <SheetModal visible={openId !== null} title="Report" onClose={() => setOpenId(null)}>
        {openId ? (
          <ReportDetailView id={openId} onChanged={() => void qc.invalidateQueries({ queryKey: ["admin-user-reports"] })} />
        ) : null}
      </SheetModal>
    </Screen>
  );
}
