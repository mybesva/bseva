import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserCog,
  Calendar,
  IndianRupee,
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  FileWarning,
  Pencil,
} from "lucide-react";
import { api, rupees } from "@/lib/api";
import { Link } from "wouter";
import { adminPath } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoadError(null);
    api("/admin/stats")
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setStats(null);
          setLoadError(e.message || "Failed to load dashboard stats");
          toast.error(e.message || "Failed to load dashboard stats");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const ps = stats?.pujariStatus || {};
  const metrics = [
    { title: "Total Customers", value: stats?.totalCustomers ?? "—", icon: Users, href: adminPath("/customers") },
    {
      title: "Active Pujaris",
      value: stats?.activePriests ?? "—",
      icon: UserCog,
      href: adminPath("/pujaris?status=approved"),
    },
    { title: "Total Bookings", value: stats?.totalBookings ?? "—", icon: Calendar, href: adminPath("/bookings") },
    {
      title: "Revenue",
      value: stats ? rupees(stats.monthlyRevenue) : "—",
      icon: IndianRupee,
      href: adminPath("/payments"),
    },
  ];

  const pujariMetrics = [
    {
      title: "Approved",
      value: ps.active ?? "—",
      icon: CheckCircle,
      color: "text-emerald-600",
      href: adminPath("/pujaris?status=approved"),
    },
    {
      title: "Pending verification",
      value: ps.pendingVerification ?? "—",
      icon: Clock,
      color: "text-amber-600",
      href: adminPath("/pujaris?status=pending"),
    },
    {
      title: "Correction required",
      value: ps.correctionRequired ?? "—",
      icon: Pencil,
      color: "text-orange-600",
      href: adminPath("/pujaris?status=correction_required"),
    },
    {
      title: "Rejected",
      value: ps.rejected ?? "—",
      icon: FileWarning,
      color: "text-red-600",
      href: adminPath("/pujaris?status=rejected"),
    },
    {
      title: "Blocked",
      value: ps.blocked ?? "—",
      icon: Ban,
      color: "text-slate-600",
      href: adminPath("/pujaris?status=blocked"),
    },
  ];

  return (
    <AdminLayout>
      <h1 className="text-h1 mb-4">Dashboard</h1>
      {loadError && (
        <p className="text-sm text-destructive mb-3 flex items-center gap-2">
          <AlertTriangle size={16} /> {loadError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {metrics.map((m) => (
          <Link key={m.title} href={m.href}>
            <a>
              <Card className="hover:border-primary/40 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
                  <m.icon className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{m.value}</div>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>
      <h2 className="text-lg font-semibold mb-3">Pujari status</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {pujariMetrics.map((m) => (
          <Link key={m.title} href={m.href}>
            <a>
              <Card className="hover:border-primary/40 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{m.value}</div>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
}
