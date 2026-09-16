import { useEffect, useState } from "react";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PasswordInput from "@/components/PasswordInput";
import { loginApi } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { errorKeyForCode } from "@bseva/locales";

type PortalRole = "customer" | "priest" | "admin";

function apiRole(role: PortalRole) {
  return role === "priest" ? "pujari" : role;
}

function portalCopy(role: PortalRole, t: (key: string, vars?: Record<string, string>) => string) {
  if (role === "priest") {
    return {
      title: t("auth.pujariLogin"),
      description: t("auth.pujariLoginDescription"),
      hint: t("auth.pujariLoginHint"),
      Icon: Sparkles,
    };
  }
  if (role === "admin") {
    return {
      title: "Admin Login",
      description: "Sign in with your admin credentials to manage the platform.",
      hint: "For BSeva operations staff only.",
      Icon: Users,
    };
  }
  return {
    title: t("auth.customerLogin"),
    description: t("auth.customerLoginDescription"),
    hint: t("auth.customerLoginHint"),
    Icon: Users,
  };
}

/** Login gate for portals. Registration is only via /register (req #110). */
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
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const expected = apiRole(role);
  const copy = portalCopy(role, t);
  const isAdminLike = (r: string) => r === "admin" || r === "super_admin";
  const matchesPortal =
    user &&
    (user.role === expected ||
      (expected === "pujari" && user.role === "head_pujari") ||
      (allowAdminBypass && isAdminLike(user.role) && role === "admin"));
  const canEnter = Boolean(matchesPortal);

  useEffect(() => {
    setEmail("");
    setPassword("");
  }, [role]);

  if (loading) {
    return (
      <MarketingLayout>
        <div className="container py-16">
          <Skeleton className="h-48 w-full" />
        </div>
      </MarketingLayout>
    );
  }

  if (canEnter) return <>{children}</>;

  if (user && user.role !== expected && !(expected === "pujari" && user.role === "head_pujari")) {
    return (
      <MarketingLayout>
        <div className="container py-16 max-w-md">
          <Card>
            <CardContent className="pt-6 space-y-4 text-center">
              <p>{t("auth.loggedInWrongPortal", { actual: user.role, expected })}</p>
              <Button variant="outline" onClick={() => logout()}>
                {t("nav.logout")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </MarketingLayout>
    );
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
        toast.error(t("auth.wrongRole", { expected, actual: out.user.role }));
        await logout();
        return;
      }
      await refresh();
      toast.success(t("auth.loggedIn"));
    } catch (err: any) {
      const key = errorKeyForCode(err?.code);
      toast.error(key ? t(key) : err.message || t("errors.loginFailed"));
    } finally {
      setPending(false);
    }
  }

  const registerHref =
    expected === "pujari"
      ? `/register?role=pujari&returnUrl=${encodeURIComponent("/pujari")}`
      : expected === "customer"
        ? `/register?role=customer&returnUrl=${encodeURIComponent("/customer")}`
        : null;

  const Icon = copy.Icon;

  return (
    <MarketingLayout>
      <div className="container py-12 max-w-md">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon size={20} />
              </div>
              <div>
                <CardTitle>{copy.title}</CardTitle>
                <p className="text-xs font-medium text-primary mt-0.5">{copy.hint}</p>
              </div>
            </div>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form key={expected} className="space-y-3" onSubmit={onLogin} autoComplete="off">
              <div className="space-y-2">
                <Label>{t("auth.emailOrPhone")}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label>{t("auth.password")}</Label>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
                {pending
                  ? t("auth.loggingIn")
                  : expected === "pujari"
                    ? t("auth.loginAsPujari")
                    : expected === "admin"
                      ? "Login as Admin"
                      : t("auth.loginAsCustomer")}
              </Button>
            </form>
            {registerHref && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                {t("auth.newHere")}{" "}
                <Link href={registerHref} className="text-primary underline">
                  {expected === "pujari" ? t("auth.createPujariAccount") : t("auth.createCustomerAccount")}
                </Link>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {t("auth.orUseShared")}{" "}
              <button
                type="button"
                className="underline text-primary"
                onClick={() => setLocation(`/login?role=${expected}`)}
              >
                {t("auth.loginPage")}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
