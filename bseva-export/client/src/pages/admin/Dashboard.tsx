import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, Calendar, DollarSign, AlertTriangle, Ban, CheckCircle, Clock } from "lucide-react";
import { api, rupees } from "@/lib/api";
import { Link } from "wouter";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    api("/admin/stats").then(setStats).catch(() => setStats(null));
  }, []);

  const ps = stats?.pujariStatus || {};
  const metrics = [
    { title: "Total Customers", value: stats?.totalCustomers ?? "—", icon: Users, href: "/admin/customers" },
    { title: "Active Pujaris", value: stats?.activePriests ?? "—", icon: UserCog, href: "/admin/pujaris" },
    { title: "Total Bookings", value: stats?.totalBookings ?? "—", icon: Calendar, href: "/admin/bookings" },
    { title: "Revenue", value: stats ? rupees(stats.monthlyRevenue) : "—", icon: DollarSign, href: "/admin/payments" },
  ];

  const pujariMetrics = [
    { title: "Approved", value: ps.active ?? "—", icon: CheckCircle, color: "text-emerald-600" },
    { title: "Pending verification", value: ps.pendingVerification ?? "—", icon: Clock, color: "text-amber-600" },
    { title: "Correction required", value: ps.correctionRequired ?? "—", icon: AlertTriangle, color: "text-orange-600" },
    { title: "Rejected", value: ps.rejected ?? "—", icon: Ban, color: "text-red-600" },
    { title: "Blocked", value: ps.blocked ?? "—", icon: Ban, color: "text-slate-600" },
  ];

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Admin dashboard</h1>
      <p className="text-muted-foreground mb-6">Live counts from Supabase via FastAPI.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <Link key={m.title} href={m.href}>
            <Card className="hover:border-primary cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{m.title}</CardTitle>
                <m.icon size={18} className="text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{m.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-heading font-semibold mb-3">Pujari status</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {pujariMetrics.map((m) => (
          <Link key={m.title} href="/admin/pujaris">
            <Card className="hover:border-primary cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">{m.title}</CardTitle>
                <m.icon size={16} className={m.color} />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{m.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
}
