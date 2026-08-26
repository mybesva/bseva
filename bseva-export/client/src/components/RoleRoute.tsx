import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { dashboardPath } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RoleRoute({
  role,
  children,
  allowAdmin = false,
}: {
  role: "customer" | "pujari" | "admin";
  children: ReactNode;
  allowAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (role === "customer") setLocation("/login?role=customer");
      else if (role === "pujari") setLocation("/login?role=pujari");
      else setLocation("/login?role=admin");
      return;
    }
    if (user.role !== role && !(allowAdmin && user.role === "admin")) {
      setLocation(dashboardPath(user.role));
    }
  }, [user, loading, role, allowAdmin, setLocation]);

  if (loading) {
    return (
      <div className="container py-16">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user || (user.role !== role && !(allowAdmin && user.role === "admin"))) {
    return (
      <div className="container py-16 max-w-md">
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p>Redirecting…</p>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
