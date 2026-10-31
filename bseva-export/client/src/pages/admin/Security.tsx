import { displayTokenLabel } from "@bseva/config";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AdminPageHeader from "@/components/AdminPageHeader";
import PasswordInput from "@/components/PasswordInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, rupees } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { toast } from "sonner";

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
    title: "Create your MPIN",
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

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

function MpinField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <PasswordInput
        id={id}
        value={value}
        onChange={(e) => onChange(digits(e.target.value))}
        inputMode="numeric"
        autoComplete="off"
      />
    </div>
  );
}

function ManageMpin() {
  const [status, setStatus] = useState<MpinStatus | null>(null);
  const [mode, setMode] = useState<Mode>("change");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  function clearForm() {
    setChallengeId(null);
    setOtp("");
    setCurrent("");
    setPassword("");
    setNext("");
    setConfirm("");
  }

  async function load() {
    const out = await api<MpinStatus>("/admin/security/mpin");
    setStatus(out);
    setMode((m) => (out.has_mpin ? (m === "create" ? "change" : m) : "create"));
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  async function sendOtp() {
    setBusy(true);
    try {
      const out = await api<{ challenge_id: string; expires_in_minutes: number }>("/admin/security/challenge", {
        method: "POST",
        body: JSON.stringify({ action: `mpin_${mode}` }),
      });
      setChallengeId(out.challenge_id);
      toast.success(`OTP sent to ${status?.email}. Valid for ${out.expires_in_minutes} minutes.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("The two MPINs do not match");
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/security/mpin/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          challenge_id: challengeId,
          otp,
          new_mpin: next,
          ...(mode === "change" ? { current_mpin: current } : {}),
          ...(mode === "reset" ? { password } : {}),
        }),
      });
      toast.success("MPIN saved");
      clearForm();
      await load();
    } catch (e: any) {
      toast.error(e.message);
      if (["VERIFICATION_EXPIRED", "VERIFICATION_MISMATCH", "OTP_ATTEMPTS_EXCEEDED", "MPIN_LOCKED"].includes(e.code)) {
        setChallengeId(null);
        setOtp("");
        await load();
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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MPIN status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Badge variant={status?.locked ? "destructive" : status?.has_mpin ? "default" : "secondary"}>
            {status?.locked ? "Locked" : status?.has_mpin ? "Active" : "Not created"}
          </Badge>
          {status?.locked && status.locked_until ? (
            <p className="text-muted-foreground">Locked until {formatDisplayDateTime(status.locked_until)}. Reset it to unlock now.</p>
          ) : null}
          {status?.updated_at ? (
            <p className="text-muted-foreground">Last changed {formatDisplayDateTime(status.updated_at)}</p>
          ) : null}
          {status?.has_mpin ? (
            <div className="flex flex-wrap gap-2">
              {(["change", "reset"] as const).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={mode === m ? "default" : "outline"}
                  onClick={() => {
                    clearForm();
                    setMode(m);
                  }}
                >
                  {MODE_TEXT[m].title}
                </Button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{text.title}</CardTitle>
          <CardDescription>{text.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          {!challengeId ? (
            <Button onClick={() => void sendOtp()} disabled={busy || !status}>
              {busy ? "Sending…" : "Send OTP"}
            </Button>
          ) : (
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={save} autoComplete="off">
              <div className="space-y-1.5">
                <Label htmlFor="mpin-otp">Email OTP</Label>
                <Input id="mpin-otp" value={otp} onChange={(e) => setOtp(digits(e.target.value))} inputMode="numeric" autoComplete="one-time-code" />
              </div>
              {mode === "change" ? <MpinField id="mpin-current" label="Current MPIN" value={current} onChange={setCurrent} /> : null}
              {mode === "reset" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="mpin-password">Account password</Label>
                  <PasswordInput id="mpin-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
              ) : null}
              <MpinField id="mpin-new" label="New 6-digit MPIN" value={next} onChange={setNext} />
              <MpinField id="mpin-confirm" label="Confirm new MPIN" value={confirm} onChange={setConfirm} />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={busy || !ready}>
                  {busy ? "Saving…" : text.button}
                </Button>
                <Button type="button" variant="outline" onClick={clearForm}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AuditRow[]>("/admin/security/audit?limit=200")
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Security audit log</CardTitle>
        <CardDescription>Permanent record of Super Admin sign-ins, MPIN changes and settlement actions, including failed attempts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{formatDisplayDateTime(row.created_at)}</TableCell>
                <TableCell>
                  <div>{row.actor_name}</div>
                  {row.actor_email ? <div className="text-xs text-muted-foreground">{row.actor_email}</div> : null}
                </TableCell>
                <TableCell>{displayTokenLabel(row.action)}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "failed" ? "destructive" : row.status === "success" ? "default" : "secondary"}>
                    {displayTokenLabel(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.booking_number || "—"}</TableCell>
                <TableCell>{row.amount_paise == null ? "—" : rupees(row.amount_paise)}</TableCell>
                <TableCell>{row.transaction_reference || "—"}</TableCell>
                <TableCell className="max-w-56 whitespace-normal text-xs text-muted-foreground">{row.reason ? displayTokenLabel(row.reason) : "—"}</TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No security events yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AdminSecurity() {
  return (
    <AdminLayout>
      <AdminPageHeader title="Security Settings" description="Your MPIN protects settlements and other sensitive financial actions." />
      <Tabs defaultValue="mpin">
        <TabsList>
          <TabsTrigger value="mpin">Manage MPIN</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="mpin">
          <ManageMpin />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
