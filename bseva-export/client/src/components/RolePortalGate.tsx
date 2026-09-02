import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PasswordInput, { passwordStrengthOk } from "@/components/PasswordInput";
import { Checkbox } from "@/components/ui/checkbox";
import { LegalInlineLink } from "@/components/LegalModal";
import { api, loginApi, registerApi } from "@/lib/api";
import { REGISTRATION_CONSENT_LABEL, TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePujariLevels } from "@/hooks/usePujariLevels";

type PortalRole = "customer" | "priest" | "admin";

function apiRole(role: PortalRole) {
  return role === "priest" ? "pujari" : role;
}

export default function RolePortalGate({
  role,
  children,
  allowAdminBypass = true,
}: {
  role: PortalRole;
  children: React.ReactNode;
  allowAdminBypass?: boolean;
}) {
  const { user, loading, refresh, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [requestedLevel, setRequestedLevel] = useState(2);
  const [pending, setPending] = useState(false);
  const expected = apiRole(role);
  const isAdminLike = (r: string) => r === "admin" || r === "super_admin";
  const matchesPortal =
    user &&
    (user.role === expected ||
      (expected === "pujari" && user.role === "head_pujari") ||
      (allowAdminBypass && isAdminLike(user.role) && role === "admin"));
  const canEnter = Boolean(matchesPortal);
  const { levels: pujariLevels } = usePujariLevels();

  useEffect(() => {
    setMode("login");
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setPhone("");
    setOtp("");
    setOtpSent(false);
    setConsent(false);
    setRequestedLevel(2);
  }, [role]);

  if (loading) {
    return (
      <Layout>
        <div className="container py-16">
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  if (canEnter) return <>{children}</>;

  if (user && user.role !== expected && !(expected === "pujari" && user.role === "head_pujari")) {
    return (
      <Layout>
        <div className="container py-16 max-w-md">
          <Card>
            <CardContent className="pt-6 space-y-4 text-center">
              <p>You are signed in as <strong>{user.role}</strong>. This portal is for {expected}s only.</p>
              <Button variant="outline" onClick={() => logout()}>Logout</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  async function sendOtp() {
    try {
      await api("/auth/otp/request", { method: "POST", body: JSON.stringify({ email, phone, purpose: "register" }) });
      setOtpSent(true);
      toast.success("Verification code sent");
    } catch (err: any) {
      toast.error(err.message || "Could not send OTP");
    }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const out = await loginApi(email, password);
      const roleOk =
        out.user.role === expected ||
        (expected === "pujari" && out.user.role === "head_pujari") ||
        (allowAdminBypass && isAdminLike(out.user.role) && role === "admin");
      if (!roleOk) {
        toast.error(`This portal is for ${expected}s.`);
        await logout();
        return;
      }
      await refresh();
      toast.success(`Welcome, ${out.user.name}`);
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setPending(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (role === "admin") return;
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!passwordStrengthOk(password)) {
      toast.error("Password must be at least 8 characters with letters and numbers");
      return;
    }
    if (!consent) {
      toast.error("Accept Terms & Privacy to continue");
      return;
    }
    setPending(true);
    try {
      await registerApi({
        account_type: expected,
        name,
        email,
        phone,
        password,
        otp,
        language: "en",
        calendar_preference: "north",
        requested_level: expected === "pujari" ? requestedLevel : undefined,
        registration_consent: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      });
      await refresh();
      toast.success("Account created. Add your address after signing in.");
      if (expected === "customer") setLocation("/customer/address");
      else if (expected === "pujari") setLocation("/pujari/onboarding");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Layout>
      <section className="bg-sidebar text-sidebar-foreground py-14">
        <div className="container text-center max-w-2xl">
          <div className="inline-flex items-center gap-2 text-primary mb-3">
            <Sparkles size={20} />
            <span className="text-sm font-medium uppercase tracking-wide">BSeva</span>
          </div>
          <h1 className="font-heading font-bold text-4xl mb-2 capitalize">{expected} portal</h1>
          <p className="text-white/80">Sign in or register to continue.</p>
        </div>
      </section>
      <div className="container py-12 flex justify-center">
        <Card className="w-full max-w-lg" key={`portal-${role}`}>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create account"}</CardTitle>
            <CardDescription>
              {role === "admin"
                ? "Admin accounts are provisioned by BSeva."
                : mode === "register"
                  ? "Address and location can be added after you sign in."
                  : "Use your registered credentials."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register" disabled={role === "admin"}>Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form className="space-y-3 mt-4" onSubmit={onLogin} autoComplete="off">
                  <Label>Email or phone</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="off"
                    name={`${expected}-login-id`}
                  />
                  <Label>Password</Label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    name={`${expected}-login-password`}
                  />
                  <Button className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form className="space-y-3 mt-4" onSubmit={onRegister} autoComplete="off">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" name={`${expected}-reg-name`} />
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" name={`${expected}-reg-email`} />
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="off" name={`${expected}-reg-phone`} />
                  <Label>Password</Label>
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" name={`${expected}-reg-password`} />
                  <Label>Confirm password</Label>
                  <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" name={`${expected}-reg-password-confirm`} />
                  {role === "priest" && (
                    <select className="w-full h-10 rounded-md border px-2 text-sm" value={requestedLevel} onChange={(e) => setRequestedLevel(Number(e.target.value))}>
                      {pujariLevels.map((l) => (
                        <option key={l.level} value={l.level}>Level {l.level} — {l.title}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="OTP" required />
                    <Button type="button" variant="secondary" onClick={() => void sendOtp()}>{otpSent ? "Resend" : "Send OTP"}</Button>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                    <span>
                      {REGISTRATION_CONSENT_LABEL}{" "}
                      <LegalInlineLink kind="terms">Terms & Conditions</LegalInlineLink>{" "}
                      and{" "}
                      <LegalInlineLink kind="privacy">Privacy Policy</LegalInlineLink>.
                    </span>
                  </label>
                  <Button className="w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
