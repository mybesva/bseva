import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/PasswordInput";
import { dashboardPath, loginApi } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { errorKeyForCode } from "@bseva/locales";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { safeReturnUrl } from "@/const";
import BSevaLogo from "@/components/BSevaLogo";

export default function Login() {
  const [, setLocation] = useLocation();
  const { refresh, user, loading } = useAuth();
  const { t } = useI18n();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const roleHint = params.get("role");
  const returnUrl = safeReturnUrl(params.get("returnUrl"));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  function goAfterLogin(role: string) {
    if (returnUrl && (role === "customer" || !roleHint || roleHint === "customer")) {
      setLocation(returnUrl);
      return;
    }
    setLocation(dashboardPath(role));
  }

  useEffect(() => {
    if (!loading && user) goAfterLogin(user.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  useEffect(() => {
    setIdentifier("");
    setPassword("");
  }, [roleHint]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const out = await loginApi(identifier, password);
      const roleOk =
        !roleHint ||
        out.user.role === roleHint ||
        (roleHint === "pujari" && out.user.role === "head_pujari") ||
        (roleHint === "admin" && (out.user.role === "admin" || out.user.role === "super_admin"));
      if (!roleOk) {
        toast.error(t("auth.wrongRole", { expected: roleHint, actual: out.user.role }));
      }
      await refresh();
      toast.success(t("auth.welcomeName", { name: out.user.name }));
      goAfterLogin(out.user.role);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const key = errorKeyForCode(code);
      toast.error(key ? t(key) : (err as Error)?.message || t("errors.loginFailed"));
    } finally {
      setPending(false);
    }
  }

  const portalLabel =
    roleHint === "customer"
      ? t("auth.customerLogin")
      : roleHint === "pujari"
        ? t("auth.pujariLogin")
        : t("auth.loginTitle");

  return (
    <Layout publicOnly>
      <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 bg-gradient-to-b from-secondary/30 to-background">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <BSevaLogo size="md" />
            </div>
            <CardTitle className="text-2xl text-foreground">{portalLabel}</CardTitle>
            <CardDescription>{t("auth.loginDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form key={roleHint || "default"} className="space-y-4" onSubmit={onSubmit} autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="identifier">{t("auth.emailOrPhone")}</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="off"
                  name="bseva-login-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  name="bseva-login-password"
                />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
                <LogIn className="w-4 h-4 mr-2" />
                {pending ? t("auth.loggingIn") : t("auth.login")}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                {t("auth.newToBseva")}{" "}
                <Link
                  href={
                    (() => {
                      const p = new URLSearchParams();
                      if (roleHint) p.set("role", roleHint);
                      if (returnUrl) p.set("returnUrl", returnUrl);
                      const q = p.toString();
                      return q ? `/register?${q}` : "/register";
                    })()
                  }
                  className="text-primary font-semibold"
                >
                  {t("mobile.createAccount")}
                </Link>
              </p>
              <p className="text-sm text-center">
                <Link href="/" className="text-muted-foreground hover:text-primary">{t("auth.backHome")}</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
