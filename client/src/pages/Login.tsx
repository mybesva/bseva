import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const DEMO_ACCOUNTS = [
  { roleKey: "nav.customer", email: "customer@bseva.com", password: "password123", path: "/customer" },
  { roleKey: "nav.pujaris", email: "pujari@bseva.com", password: "password123", path: "/pujari" },
  { roleKey: "nav.admin", email: "admin@bseva.com", password: "password123", path: "/admin" },
];

export default function Login() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("customer@bseva.com");
  const [password, setPassword] = useState("password123");
  const utils = trpc.useUtils();

  const login = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      await utils.auth.me.invalidate();
      toast.success(`Welcome, ${data.user.name || data.user.email}!`);
      const role = data.user.role;
      if (role === "admin") setLocation("/admin");
      else if (role === "priest") setLocation("/pujari");
      else setLocation("/customer");
    },
    onError: (err) => {
      toast.error(err.message || "Login failed");
    },
  });

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 bg-gradient-to-b from-secondary/30 to-background">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">
          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle className="font-heading text-2xl text-sidebar">{t("auth.demoLogin")}</CardTitle>
              <CardDescription>{t("auth.demoLoginDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  login.mutate({ email, password });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@bseva.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  disabled={login.isPending}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {login.isPending ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border shadow-lg bg-sidebar text-sidebar-foreground">
            <CardHeader>
              <CardTitle className="font-heading text-xl">{t("auth.quickDemo")}</CardTitle>
              <CardDescription className="text-sidebar-foreground/70">{t("auth.quickDemoDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                  }}
                  className="w-full text-left p-4 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors border border-sidebar-border"
                >
                  <div className="font-semibold text-primary">{t(acc.roleKey)}</div>
                  <div className="text-sm opacity-80">{acc.email}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
