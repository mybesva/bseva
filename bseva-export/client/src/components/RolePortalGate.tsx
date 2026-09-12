import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
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

type PortalRole = "customer" | "priest" | "admin";

function apiRole(role: PortalRole) {
  return role === "priest" ? "pujari" : role;
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
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const expected = apiRole(role);
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
              <p>
                You are logged in as <strong>{user.role}</strong>. This portal is for {expected}s only.
              </p>
              <Button variant="outline" onClick={() => logout()}>
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
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
        toast.error(`This portal is for ${expected}s.`);
        await logout();
        return;
      }
      await refresh();
      toast.success("Logged in");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
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

  return (
    <Layout>
      <div className="container py-12 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Use your registered credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onLogin} autoComplete="off">
              <div className="space-y-2">
                <Label>Email or phone</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
                {pending ? "Logging in…" : "Login"}
              </Button>
            </form>
            {registerHref && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                New here?{" "}
                <Link href={registerHref} className="text-primary underline">
                  Create an account
                </Link>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Or use the shared{" "}
              <button type="button" className="underline text-primary" onClick={() => setLocation("/login")}>
                Login page
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
