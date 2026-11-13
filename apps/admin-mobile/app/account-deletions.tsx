import { Ionicons } from "@expo/vector-icons";
import { displayTokenLabel, formatIndianPhone, rupees } from "@bseva/config";
import { formatDisplayDate, formatDisplayDateTime } from "@bseva/locales";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { showAdminActionSheet } from "@/components/admin/adminActionSheet";
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

const PAGE_SIZE = 20;

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

type DeletionBooking = {
  id: string;
  booking_number: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  status: string;
  kind: "upcoming" | "ongoing" | "unpaid";
  cancellation?: { allowed: boolean; refund_paise: number; fee_paise: number; policy_note: string };
  action?: "reassign" | "close";
};

type DeletionObligations = {
  bookings: DeletionBooking[];
  wallet_balance_paise: number;
  pending_refunds: number;
  pending_settlement_paise: number;
  blocking: string[];
};

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

const STATUS_OPTIONS: { key: keyof Counts | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "requested", label: "New" },
  { key: "pending_resolution", label: "Pending resolution" },
  { key: "ready", label: "Ready" },
  { key: "escalated", label: "Escalated" },
  { key: "overdue", label: "Overdue" },
  { key: "deleted", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATE_LABELS: Record<string, string> = {
  requested: "Requested",
  pending_resolution: "Pending resolution",
  ready: "Ready for deletion",
  deleted: "Deleted",
  cancelled: "Cancelled",
  escalated: "Escalated",
};

const REASONS: Record<string, string> = {
  no_longer_using: "I no longer use B-Seva",
  not_satisfied: "I am not satisfied with the service",
  privacy: "Privacy concerns",
  payment_settlement: "Payment or settlement issues",
  app_issues: "Problems with the app or website",
  duplicate_account: "I have a duplicate account",
  other: "Other",
};

const reasonLabel = (key: string) => REASONS[key] || key;
const stateLabel = (s: string) => STATE_LABELS[s] || displayTokenLabel(s);
const roleLabel = (role: string) => (role === "head_pujari" ? "Head Pujari" : displayTokenLabel(role));

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

function useStateColor() {
  const { colors } = useAppTheme();
  return (state: string) =>
    state === "requested"
      ? colors.info
      : state === "pending_resolution"
        ? colors.warning
        : state === "ready"
          ? colors.success
          : state === "escalated"
            ? colors.destructive
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

function StateBadges({ state, overdue }: { state: string; overdue?: boolean }) {
  const { colors } = useAppTheme();
  const stateColor = useStateColor();
  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      <Pill label={stateLabel(state)} color={stateColor(state)} />
      {overdue ? <Pill label="Overdue" color={colors.destructive} /> : null}
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

function Row({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  const { colors } = useAppTheme();
  return (
    <AppText variant="small" color={color}>
      <AppText variant="small" color={colors.mutedForeground}>
        {label}:{" "}
      </AppText>
      {value}
    </AppText>
  );
}

type ActionKind = "note" | "review" | "escalate" | null;

const ACTION_TEXT: Record<Exclude<ActionKind, null>, { title: string; hint: string; label: string }> = {
  note: { title: "Add note", hint: "Notes are visible to other admins in the history.", label: "Note" },
  review: {
    title: "Mark review complete",
    hint: "Confirms every obligation is resolved, so the account can be deleted on schedule.",
    label: "Note (optional)",
  },
  escalate: {
    title: "Escalate request",
    hint: "Escalation is recorded in the history and the user is told the request needs more time.",
    label: "Reason",
  },
};

function DeletionDetailView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const canManage = can("manage_account_deletions");
  const [action, setAction] = useState<ActionKind>(null);
  const [text, setText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const detail = useQuery({
    queryKey: ["admin-account-deletion", id],
    queryFn: () => apiClient.api<DeletionDetail>(`/admin/account-deletions/${encodeURIComponent(id)}`),
  });

  const admins = useQuery({
    queryKey: ["admin-admins-lite"],
    enabled: canManage,
    queryFn: async () => {
      try {
        const list = await apiClient.api<{ id: string; name: string }[]>("/admin/admins-lite");
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
  });

  async function post(path: string, body: Record<string, unknown>, done: string) {
    setBusy(true);
    setActionError(null);
    setSuccess(null);
    try {
      await apiClient.api(`/admin/account-deletions/${encodeURIComponent(id)}/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccess(done);
      setAction(null);
      setText("");
      await detail.refetch();
      onChanged();
    } catch (e) {
      setActionError(errMessage(e, "Action failed."));
    } finally {
      setBusy(false);
    }
  }

  function submitAction() {
    if (action === "note") {
      if (!text.trim()) return setActionError("Write a note.");
      void post("note", { note: text.trim() }, "Note added");
    } else if (action === "review") {
      void post("review-complete", text.trim() ? { note: text.trim() } : {}, "Review marked complete");
    } else if (action === "escalate") {
      if (!text.trim()) return setActionError("Give a reason for escalating.");
      void post("escalate", { reason: text.trim() }, "Request escalated");
    }
  }

  function openAction(kind: Exclude<ActionKind, null>) {
    setAction(kind);
    setText("");
    setActionError(null);
    setSuccess(null);
  }

  function pickAssignee() {
    const list = admins.data || [];
    showAdminActionSheet("Assign to", [
      { label: "Unassigned", onPress: () => void post("assign", { admin_id: null }, "Unassigned") },
      ...list.map((a) => ({ label: a.name, onPress: () => void post("assign", { admin_id: a.id }, "Assigned") })),
    ]);
  }

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.error || !detail.data) {
    return (
      <View style={{ gap: 10 }}>
        <ErrorBanner message={errMessage(detail.error, "Could not load this request.")} />
        <PrimaryButton title="Retry" variant="outline" onPress={() => void detail.refetch()} />
      </View>
    );
  }

  const { request, user, obligations, events } = detail.data;
  const bookings = obligations.bookings || [];
  const blocking = obligations.blocking || [];
  const wallet = Number(obligations.wallet_balance_paise || 0);
  const settlement = Number(obligations.pending_settlement_paise || 0);
  const closed = request.state === "deleted" || request.state === "cancelled";

  return (
    <View style={{ gap: 12 }}>
      <SuccessBanner message={success} />
      <View style={{ gap: 6 }}>
        <AppText variant="h2">{user.name || "Deletion request"}</AppText>
        <StateBadges state={request.state} overdue={request.overdue} />
      </View>

      {canManage && !closed ? (
        <Card>
          <Row label="Assigned to" value={request.assigned_admin_name || "Unassigned"} />
          <PrimaryButton title="Change assignee" variant="outline" onPress={pickAssignee} disabled={busy} />
          {action ? (
            <View style={{ gap: 8 }}>
              <AppText variant="h3">{ACTION_TEXT[action].title}</AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                {ACTION_TEXT[action].hint}
              </AppText>
              <Field label={ACTION_TEXT[action].label} value={text} onChangeText={setText} multiline numberOfLines={4} />
              <ErrorBanner message={actionError} />
              <PrimaryButton title={busy ? "Saving…" : "Save"} onPress={submitAction} loading={busy} disabled={busy} />
              <PrimaryButton
                title="Cancel"
                variant="ghost"
                onPress={() => {
                  setAction(null);
                  setText("");
                  setActionError(null);
                }}
                disabled={busy}
              />
            </View>
          ) : (
            <>
              <ErrorBanner message={actionError} />
              <PrimaryButton title="Add note" variant="outline" onPress={() => openAction("note")} disabled={busy} />
              <PrimaryButton title="Mark review complete" onPress={() => openAction("review")} disabled={busy} />
              <PrimaryButton title="Escalate" variant="navy" onPress={() => openAction("escalate")} disabled={busy} />
            </>
          )}
          <AppText variant="small" color={colors.mutedForeground}>
            Final deletion runs automatically on day 14 for requests that are ready. Refunds and payouts use the settlement and wallet
            screens.
          </AppText>
        </Card>
      ) : (
        <AppText variant="small" color={colors.mutedForeground}>
          Assigned to: {request.assigned_admin_name || "Unassigned"}
        </AppText>
      )}

      <Card>
        <AppText variant="h3">Request</AppText>
        <Row label="Request ID" value={request.id} />
        <Row label="Requested" value={formatDisplayDateTime(request.requested_at)} />
        <Row label="Deadline" value={formatDisplayDate(request.deadline_at)} color={request.overdue ? colors.destructive : undefined} />
        {request.cancelled_at ? <Row label="Cancelled" value={formatDisplayDateTime(request.cancelled_at)} /> : null}
        {request.completed_at ? <Row label="Completed" value={formatDisplayDateTime(request.completed_at)} /> : null}
        <Row label="Reason" value={reasonLabel(request.reason)} />
        {request.explanation ? (
          <View style={{ backgroundColor: colors.muted, borderRadius: 8, padding: 10 }}>
            <AppText variant="small">{request.explanation}</AppText>
          </View>
        ) : null}
        {request.escalation_reason ? <Row label="Escalation reason" value={request.escalation_reason} /> : null}
        {request.message ? (
          <AppText variant="small" color={colors.mutedForeground}>
            User sees: {request.message}
          </AppText>
        ) : null}
      </Card>

      <Card>
        <AppText variant="h3">User</AppText>
        <Row label="Name" value={user.name || "—"} />
        <Row label="Role" value={roleLabel(user.role)} />
        <Row label="Email" value={user.email} />
        <Row label="Phone" value={formatIndianPhone(user.phone)} />
        <Row label="Account created" value={formatDisplayDate(user.created_at)} />
      </Card>

      <Card>
        <AppText variant="h3">Obligations</AppText>
        {blocking.length ? (
          <View style={{ borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warning + "18", borderRadius: 8, padding: 10, gap: 4 }}>
            <AppText style={{ fontWeight: "700" }}>Blocking final deletion</AppText>
            {blocking.map((b, i) => (
              <AppText key={i} variant="small">
                • {b}
              </AppText>
            ))}
          </View>
        ) : (
          <AppText variant="small" color={colors.mutedForeground}>
            Nothing is blocking final deletion.
          </AppText>
        )}
        {bookings.length ? (
          bookings.map((b) => (
            <View key={b.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 2 }}>
              <AppText style={{ fontWeight: "700" }}>
                {b.booking_number || b.id.slice(0, 8)} · {b.service_name}
              </AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                {formatDisplayDate(b.booking_date)} {b.start_time} · {displayTokenLabel(b.status)}
              </AppText>
              <AppText variant="small">
                Action needed:{" "}
                {b.action === "reassign"
                  ? "Reassign to another pujari"
                  : b.kind === "ongoing"
                    ? "Let it finish"
                    : b.cancellation
                      ? `Cancel: refund ${rupees(b.cancellation.refund_paise)}, fee ${rupees(b.cancellation.fee_paise)}`
                      : "—"}
              </AppText>
            </View>
          ))
        ) : (
          <AppText variant="small" color={colors.mutedForeground}>
            No open bookings.
          </AppText>
        )}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Wallet balance", value: wallet < 0 ? `−${rupees(Math.abs(wallet))}` : rupees(wallet) },
            { label: "Pending refunds", value: String(Number(obligations.pending_refunds || 0)) },
            { label: "Pending settlement", value: rupees(settlement) },
          ].map((m) => (
            <View key={m.label} style={{ flexGrow: 1, minWidth: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 }}>
              <AppText variant="small" color={colors.mutedForeground}>
                {m.label}
              </AppText>
              <AppText style={{ fontWeight: "700" }}>{m.value}</AppText>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <AppText variant="h3">History</AppText>
        {events.length ? (
          events.map((ev, i) => (
            <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 10, gap: 2 }}>
              <AppText style={{ fontWeight: "700" }}>{displayTokenLabel(ev.action)}</AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                {formatDisplayDateTime(ev.created_at)} · {ev.actor_name || "System"}
              </AppText>
              {formatEventDetail(ev.detail) ? <AppText variant="small">{formatEventDetail(ev.detail)}</AppText> : null}
            </View>
          ))
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

export default function AdminAccountDeletions() {
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const allowed = can(["view_account_deletions", "manage_account_deletions"]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-account-deletions", status, query, page],
    enabled: allowed,
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (status !== "all") qs.set("status", status);
      if (query.trim()) qs.set("q", query.trim());
      return apiClient.api<ListResponse>(`/admin/account-deletions?${qs}`);
    },
  });

  const counts = list.data?.counts || {};
  const rows = list.data?.items || [];

  function runSearch(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <Screen>
      <ScreenHeader title="Account Deletions" back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        {!allowed ? (
          <EmptyState title="No access" subtitle="Your admin permissions do not include account deletions." />
        ) : (
          <>
            <ChoiceChips
              horizontal
              options={STATUS_OPTIONS.map((o) => {
                const n = o.key === "all" ? counts.total : counts[o.key];
                return { id: o.key, label: `${o.label}${n != null ? ` (${n})` : ""}` };
              })}
              value={status}
              onChange={(v) => {
                setStatus(v as string);
                setPage(1);
              }}
            />
            <Field
              label="Search"
              placeholder="Name, email, phone or request ID"
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => runSearch(q)}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Search" variant="outline" onPress={() => runSearch(q)} />
              </View>
              {query ? (
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Clear"
                    variant="ghost"
                    onPress={() => {
                      setQ("");
                      runSearch("");
                    }}
                  />
                </View>
              ) : null}
            </View>
            {list.error ? (
              <>
                <ErrorBanner message={errMessage(list.error, "Could not load deletion requests.")} />
                <PrimaryButton title="Retry" variant="outline" onPress={() => void list.refetch()} />
              </>
            ) : null}
            {list.isLoading ? <LoadingBlock /> : null}
            {list.data && rows.length === 0 ? <EmptyState title="No deletion requests match this filter." /> : null}
            {rows.map((r) => (
              <Pressable key={r.id} onPress={() => setOpenId(r.id)} accessibilityRole="button">
                <Card compact>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="h3" numberOfLines={1}>
                        {r.name || "—"}
                      </AppText>
                      <AppText variant="small" color={colors.mutedForeground}>
                        {roleLabel(r.role)} · {r.id.slice(0, 8)}
                      </AppText>
                    </View>
                    <StateBadges state={r.state} overdue={r.overdue} />
                  </View>
                  <AppText variant="small" color={colors.mutedForeground}>
                    {r.email}
                    {r.phone ? ` · ${formatIndianPhone(r.phone)}` : ""}
                  </AppText>
                  <AppText variant="small">{reasonLabel(r.reason)}</AppText>
                  {r.explanation ? (
                    <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
                      {r.explanation}
                    </AppText>
                  ) : null}
                  <AppText variant="small" color={colors.mutedForeground}>
                    Joined {formatDisplayDate(r.account_created_at)} · Requested {formatDisplayDate(r.requested_at)}
                  </AppText>
                  <AppText variant="small" color={r.overdue ? colors.destructive : colors.mutedForeground}>
                    Deadline {formatDisplayDate(r.deadline_at)}
                  </AppText>
                  <AppText variant="small">
                    Bookings: {r.active_bookings ?? 0} active / {r.booking_count ?? 0} total
                    {r.financial_status ? ` · Money: ${displayTokenLabel(r.financial_status)}` : ""}
                  </AppText>
                  <AppText variant="small">Assigned: {r.assigned_admin_name || "Unassigned"}</AppText>
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
      <SheetModal visible={openId !== null} title="Deletion request" onClose={() => setOpenId(null)}>
        {openId ? (
          <DeletionDetailView id={openId} onChanged={() => void qc.invalidateQueries({ queryKey: ["admin-account-deletions"] })} />
        ) : null}
      </SheetModal>
    </Screen>
  );
}
