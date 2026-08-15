import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LogIn, UserPlus, Sparkles, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";

type PortalRole = "customer" | "priest" | "admin";

const ROLE_COPY: Record<
  PortalRole,
  { titleKey: string; subtitleKey: string; demoEmail: string; accentKey: string }
> = {
  customer: {
    titleKey: "portal.customer.title",
    subtitleKey: "portal.customer.subtitle",
    demoEmail: "customer@bseva.com",
    accentKey: "portal.customer.subtitle",
  },
  priest: {
    titleKey: "portal.priest.title",
    subtitleKey: "portal.priest.subtitle",
    demoEmail: "pujari@bseva.com",
    accentKey: "portal.priest.subtitle",
  },
  admin: {
    titleKey: "portal.admin.title",
    subtitleKey: "portal.admin.subtitle",
    demoEmail: "admin@bseva.com",
    accentKey: "portal.admin.subtitle",
  },
};

interface RolePortalGateProps {
  role: PortalRole;
  children: React.ReactNode;
  allowAdminBypass?: boolean;
}

export default function RolePortalGate({
  role,
  children,
  allowAdminBypass = true,
}: RolePortalGateProps) {
  const { t } = useI18n();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const copy = ROLE_COPY[role];
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(copy.demoEmail);
  const [password, setPassword] = useState("password123");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Bangalore");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [demoOtpHint, setDemoOtpHint] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      await utils.auth.me.invalidate();
      if (data.user.role !== role && !(allowAdminBypass && data.user.role === "admin")) {
        toast.error(`This portal is for ${role}s. You signed in as ${data.user.role}.`);
        await utils.client.auth.logout.mutate();
        await utils.auth.me.invalidate();
        return;
      }
      toast.success(`Welcome, ${data.user.name || data.user.email}!`);
    },
    onError: (err) => toast.error(err.message || "Login failed"),
  });

  const sendOtp = trpc.auth.sendOtp.useMutation({
    onSuccess: (data) => {
      setOtpSent(true);
      setDemoOtpHint(data.demoOtp || "123456");
      toast.success(data.message || "OTP sent (demo)");
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message);
        return;
      }
      setOtpVerified(true);
      toast.success(data.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      await utils.auth.me.invalidate();
      toast.success(`Account created. Welcome, ${data.user.name || data.user.email}!`);
    },
    onError: (err) => toast.error(err.message || "Registration failed"),
  });

  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  const phoneValid = /^[6-9]\d{9}$/.test(phoneDigits);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-16">
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  const canEnter =
    user &&
    (user.role === role || (role === "admin" && user.role === "admin"));

  if (canEnter) {
    return <>{children}</>;
  }

  if (user && user.role !== role) {
    return (
      <Layout>
        <section className="bg-sidebar text-sidebar-foreground py-12">
          <div className="container text-center">
            <h1 className="font-heading text-3xl font-bold mb-2">{t(copy.titleKey)}</h1>
            <p className="text-sidebar-foreground/80">{t(copy.subtitleKey)}</p>
          </div>
        </section>
        <div className="container py-12 flex justify-center">
          <Card className="max-w-md w-full border-border">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-muted-foreground">
                You are signed in as <strong>{user.role}</strong> ({user.email}).
                Please logout and sign in with a {role} account to use this portal.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  await utils.client.auth.logout.mutate();
                  await utils.auth.me.invalidate();
                  toast.success("Logged out");
                }}
              >
                Logout & switch account
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="bg-sidebar text-sidebar-foreground py-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center max-w-2xl">
          <div className="inline-flex items-center gap-2 text-primary mb-3">
            <Sparkles size={20} />
            <span className="text-sm font-medium uppercase tracking-wide">B-Seva</span>
          </div>
          <h1 className="font-heading font-bold text-4xl md:text-5xl mb-4">{t(copy.titleKey)}</h1>
          <p className="text-lg text-white/80 mb-2">{t(copy.subtitleKey)}</p>
          <p className="text-sm text-white/60">{t(copy.accentKey)}</p>
        </div>
      </section>

      <div className="container py-12 flex justify-center">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <CardTitle className="font-heading text-xl text-sidebar">
              {mode === "login" ? t("auth.login") : t("auth.register")}
            </CardTitle>
            <CardDescription>
              {role === "admin"
                ? "Admin access requires an existing account."
                : mode === "login"
                  ? `Sign in to your ${role} account`
                  : `Create a new ${role} account — phone is your demo user ID`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "login" | "register")}
              className="w-full"
            >
              <TabsList className={`grid w-full ${role === "admin" ? "grid-cols-1" : "grid-cols-2"} mb-4`}>
                <TabsTrigger value="login" className="gap-1">
                  <LogIn size={14} /> {t("auth.login")}
                </TabsTrigger>
                {role !== "admin" && (
                  <TabsTrigger value="register" className="gap-1">
                    <UserPlus size={14} /> {t("auth.register")}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-0">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    login.mutate({ email, password });
                  }}
                >
                  <div className="space-y-2">
                    <Label>{t("auth.email")}</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.password")}</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-bold" disabled={login.isPending}>
                    {login.isPending ? t("common.loading") : t("auth.login")}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground text-center">
                  Demo: {copy.demoEmail} / password123
                </p>
              </TabsContent>

              {role !== "admin" && (
                <TabsContent value="register" className="space-y-4 mt-0">
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!otpVerified) {
                        toast.error("Please verify phone OTP first");
                        return;
                      }
                      register.mutate({
                        name,
                        email,
                        password,
                        phone: phoneDigits,
                        city: city || undefined,
                        role,
                        otpVerified: true,
                      });
                    }}
                  >
                    <div className="space-y-2">
                      <Label>{t("auth.name")}</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("auth.email")}</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("auth.password")}</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("auth.phone")} (User ID)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            setOtpVerified(false);
                            setOtpSent(false);
                          }}
                          placeholder="10-digit mobile"
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!phoneValid || sendOtp.isPending}
                          onClick={() => sendOtp.mutate({ phone: phoneDigits })}
                        >
                          {t("auth.sendOtp")}
                        </Button>
                      </div>
                      {!phoneValid && phone.length > 0 && (
                        <p className="text-xs text-red-600">Enter a valid 10-digit Indian mobile (starts 6–9)</p>
                      )}
                    </div>

                    {otpSent && (
                      <div className="space-y-2 p-3 rounded-lg border border-orange-200 bg-orange-50">
                        <Badge variant="outline" className="mb-1">{t("common.demo")}</Badge>
                        <p className="text-xs text-muted-foreground">{t("auth.otpDemo")}</p>
                        {demoOtpHint && (
                          <p className="text-xs font-medium">Demo OTP: {demoOtpHint}</p>
                        )}
                        <Label>{t("auth.otp")}</Label>
                        <div className="flex gap-2">
                          <Input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="123456"
                            maxLength={6}
                          />
                          <Button
                            type="button"
                            disabled={verifyOtp.isPending || otp.length < 4}
                            onClick={() => verifyOtp.mutate({ phone: phoneDigits, otp })}
                          >
                            {t("auth.verifyOtp")}
                          </Button>
                        </div>
                        {otpVerified && (
                          <p className="text-sm text-green-700 flex items-center gap-1">
                            <CheckCircle2 size={14} /> Phone verified
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>{t("auth.city")}</Label>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bangalore" />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 font-bold"
                      disabled={register.isPending || !otpVerified}
                    >
                      {register.isPending ? t("common.loading") : t("auth.createAccount")}
                    </Button>
                  </form>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
