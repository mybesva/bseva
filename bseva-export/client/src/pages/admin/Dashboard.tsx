import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, Calendar, DollarSign } from "lucide-react";
import { api, rupees } from "@/lib/api";
import { Link } from "wouter";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    api("/admin/stats").then(setStats).catch(() => setStats(null));
  }, []);

  const metrics = [
    { title: "Total Customers", value: stats?.totalCustomers ?? "—", icon: Users, href: "/admin/customers" },
    { title: "Active Pujaris", value: stats?.activePriests ?? "—", icon: UserCog, href: "/admin/pujaris" },
    { title: "Total Bookings", value: stats?.totalBookings ?? "—", icon: Calendar, href: "/admin/bookings" },
    { title: "Revenue", value: stats ? rupees(stats.monthlyRevenue) : "—", icon: DollarSign, href: "/admin/payments" },
  ];

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Admin dashboard</h1>
      <p className="text-muted-foreground mb-6">Live counts from Supabase via FastAPI.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </AdminLayout>
  );
}
