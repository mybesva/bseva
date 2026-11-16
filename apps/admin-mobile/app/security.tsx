import { displayTokenLabel, rupees } from "@bseva/config";
import { formatDisplayDateTime } from "@bseva/locales";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
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
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type MpinStatus = { has_mpin: boolean; locked: boolean; locked_until?: string | null; updated_at?: string | null; email: string };
type Mode = "create" | "change" | "reset";
type AuditRow = {
  id: string;
  actor_name: string;
  actor_email?: string | null;
  action: string;
  status: string;
  booking_number?: string | null;
  amount_paise?: number | null;
  transaction_reference?: string | null;
  reason?: string | null;
  created_at: string;
};

const MODE_TEXT: Record<Mode, { title: string; hint: string; button: string }> = {
  create: {
    title: "Create Your MPIN",
    hint: "A 6-digit MPIN is required, with an emailed OTP, before any settlement can be processed.",
    button: "Create MPIN",
  },
  change: { title: "Change MPIN", hint: "You need your current MPIN and an emailed OTP.", button: "Change MPIN" },
  reset: {
    title: "Forgot MPIN",
    hint: "Verify your identity with an emailed OTP and your account password.",
    button: "Reset MPIN",
  },
};

const RESET_CHALLENGE_CODES = ["VERIFICATION_EXPIRED", "VERIFICATION_MISMATCH", "OTP_ATTEMPTS_EXCEEDED", "MPIN_LOCKED"];

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

function errCode(e: unknown): string | undefined {
  return (e as { code?: string } | null)?.code;
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

function ManageMpin() {
  const { colors } = useAppTheme();
  const status = useQuery({
    queryKey: ["admin-security-mpin"],
    queryFn: () => apiClient.api<MpinStatus>("/admin/security/mpin"),
  });
  const s = status.data;
  const [picked, setPicked] = useState<Mode>("change");
  const mode: Mode = s && !s.has_mpin ? "create" : picked;
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clearForm() {
    setChallengeId(null);
    setOtp("");
    setCurrent("");
    setPassword("");
    setNext("");
    setConfirm("");
  }

  async function sendOtp() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const out = await apiClient.api<{ challenge_id: string; expires_in_minutes: number }>("/admin/security/challenge", {
        method: "POST",
        body: JSON.stringify({ action: `mpin_${mode}` }),
      });
      setChallengeId(out.challenge_id);
      setSuccess(`OTP sent to ${s?.email}. Valid for ${out.expires_in_minutes} minutes.`);
    } catch (e) {
      setError(errMessage(e, "Could not send the OTP."));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError(null);
    setSuccess(null);
    if (next !== confirm) {
      setError("The two MPINs do not match");
      return;
    }
    setBusy(true);
    try {
      await apiClient.api(`/admin/security/mpin/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          challenge_id: challengeId,
          otp,
          new_mpin: next,
          ...(mode === "change" ? { current_mpin: current } : {}),
          ...(mode === "reset" ? { password } : {}),
        }),
      });
      setSuccess("MPIN saved");
      clearForm();
      await status.refetch();
    } catch (e) {
      setError(errMessage(e, "Could not save the MPIN."));
      if (RESET_CHALLENGE_CODES.includes(errCode(e) || "")) {
        setChallengeId(null);
        setOtp("");
        await status.refetch();
      }
    } finally {
      setBusy(false);
    }
  }

  const text = MODE_TEXT[mode];
  const ready =
    otp.length === 6 &&
    next.length === 6 &&
    confirm.length === 6 &&
    (mode !== "change" || current.length === 6) &&
    (mode !== "reset" || password.length > 0);

  if (status.isLoading) return <LoadingBlock />;

  return (
    <View style={{ gap: 12 }}>
      <ErrorBanner message={status.error ? errMessage(status.error, "Could not load MPIN status.") : error} />
      <SuccessBanner message={success} />
      <Card>
        <AppText variant="h3">MPIN Status</AppText>
        <Pill
          label={s?.locked ? "Locked" : s?.has_mpin ? "Active" : "Not Created"}
          color={s?.locked ? colors.destructive : s?.has_mpin ? colors.success : colors.mutedForeground}
        />
        {s?.locked && s.locked_until ? (
          <AppText variant="small" color={colors.mutedForeground}>
            Locked until {formatDisplayDateTime(s.locked_until)}. Reset it to unlock now.
          </AppText>
        ) : null}
        {s?.updated_at ? (
          <AppText variant="small" color={colors.mutedForeground}>
            Last changed {formatDisplayDateTime(s.updated_at)}
          </AppText>
        ) : null}
        {s?.has_mpin ? (
          <ChoiceChips
            options={[
              { id: "change", label: MODE_TEXT.change.title },
              { id: "reset", label: MODE_TEXT.reset.title },
            ]}
            value={mode}
            onChange={(v) => {
              clearForm();
              setPicked(v as Mode);
            }}
          />
        ) : null}
      </Card>
      <Card>
        <AppText variant="h3">{text.title}</AppText>
        <AppText variant="small" color={colors.mutedForeground}>
          {text.hint}
        </AppText>
        {!challengeId ? (
          <PrimaryButton title={busy ? "Sending…" : "Send OTP"} onPress={() => void sendOtp()} loading={busy} disabled={busy || !s} />
        ) : (
          <View style={{ gap: 10 }}>
            <Field
              label="Email OTP"
              value={otp}
              onChangeText={(v) => setOtp(digits(v))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
            />
            {mode === "change" ? (
              <Field
                label="Current MPIN"
                value={current}
                onChangeText={(v) => setCurrent(digits(v))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                autoComplete="off"
              />
            ) : null}
            {mode === "reset" ? (
              <Field
                label="Account Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
              />
            ) : null}
            <Field
              label="New 6-Digit MPIN"
              value={next}
              onChangeText={(v) => setNext(digits(v))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoComplete="off"
            />
            <Field
              label="Confirm New MPIN"
              value={confirm}
              onChangeText={(v) => setConfirm(digits(v))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoComplete="off"
            />
            <PrimaryButton title={busy ? "Saving…" : text.button} onPress={() => void save()} loading={busy} disabled={busy || !ready} />
            <PrimaryButton title="Cancel" variant="outline" onPress={clearForm} disabled={busy} />
          </View>
        )}
      </Card>
    </View>
  );
}

function AuditLog() {
  const { colors } = useAppTheme();
  const audit = useQuery({
    queryKey: ["admin-security-audit"],
    queryFn: () => apiClient.api<AuditRow[]>("/admin/security/audit?limit=200"),
  });
  const rows = Array.isArray(audit.data) ? audit.data : [];

  return (
    <View style={{ gap: 10 }}>
      <AppText variant="small" color={colors.mutedForeground}>
        Permanent record of Super Admin sign-ins, MPIN changes and settlement actions, including failed attempts.
      </AppText>
      <ErrorBanner message={audit.error ? errMessage(audit.error, "Could not load the audit log.") : null} />
      {audit.isLoading ? <LoadingBlock /> : null}
      {!audit.isLoading && !audit.error && rows.length === 0 ? <EmptyState title="No security events yet." /> : null}
      {rows.map((row) => (
        <Card key={row.id} compact>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <AppText variant="h3" style={{ flex: 1 }}>
              {displayTokenLabel(row.action)}
            </AppText>
            <Pill
              label={displayTokenLabel(row.status)}
              color={row.status === "failed" ? colors.destructive : row.status === "success" ? colors.success : colors.mutedForeground}
            />
          </View>
          <AppText variant="small" color={colors.mutedForeground}>
            {formatDisplayDateTime(row.created_at)}
          </AppText>
          <AppText variant="small">
            {row.actor_name}
            {row.actor_email ? ` · ${row.actor_email}` : ""}
          </AppText>
          {row.booking_number ? <AppText variant="small">Booking: {row.booking_number}</AppText> : null}
          {row.amount_paise != null ? <AppText variant="small">Amount: {rupees(row.amount_paise)}</AppText> : null}
          {row.transaction_reference ? <AppText variant="small">Reference: {row.transaction_reference}</AppText> : null}
          {row.reason ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {displayTokenLabel(row.reason)}
            </AppText>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

export default function AdminSecurity() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<"mpin" | "audit">("mpin");
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const isSuper = user?.role === "super_admin";

  return (
    <Screen>
      <ScreenHeader title="Security Settings" back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["admin-security-mpin"] }),
                qc.invalidateQueries({ queryKey: ["admin-security-audit"] }),
              ]);
              setRefreshing(false);
            }}
          />
        }
      >
        {!isSuper ? (
          <EmptyState title="Super Admin only" subtitle="Security settings are available to Super Admins." />
        ) : (
          <>
            <AppText variant="small" color={colors.mutedForeground}>
              Your MPIN protects settlements and other sensitive financial actions.
            </AppText>
            <ChoiceChips
              options={[
                { id: "mpin", label: "Manage MPIN" },
                { id: "audit", label: "Audit Log" },
              ]}
              value={tab}
              onChange={(v) => setTab(v as "mpin" | "audit")}
            />
            {tab === "mpin" ? <ManageMpin /> : <AuditLog />}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
