import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import PasswordInput, { passwordStrengthOk } from "@/components/PasswordInput";
import { dashboardPath, loginApi } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { safeReturnUrl } from "@/const";

export default function Login() {
  const [location, setLocation] = useLocation();
  const { refresh, user, loading } = useAuth();
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
        toast.error(`This sign-in is for ${roleHint} accounts. Your account role is ${out.user.role}.`);
      }
      await refresh();
      toast.success(`Welcome, ${out.user.name}`);
      goAfterLogin(out.user.role);
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setPending(false);
    }
  }

  const portalLabel = roleHint ? `${roleHint.charAt(0).toUpperCase()}${roleHint.slice(1)} sign in` : "Sign in to BSeva";

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 bg-gradient-to-b from-secondary/30 to-background">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-sidebar">{portalLabel}</CardTitle>
            <CardDescription>Use your registered email or phone and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit} autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or phone</Label>
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
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  name="bseva-login-password"
                />
              </div>
              <Button type="submit" className="w-full bg-primary" disabled={pending}>
                <LogIn className="w-4 h-4 mr-2" />
                {pending ? "Signing in..." : "Sign in"}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                New to BSeva?{" "}
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
                  Create an account
                </Link>
              </p>
              <p className="text-sm text-center">
                <Link href="/" className="text-muted-foreground hover:text-primary">Back to home</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
