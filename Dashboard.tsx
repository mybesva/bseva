import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, Calendar, DollarSign, TrendingUp, TrendingDown, Clock, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function AdminDashboard() {
  // Fetch dashboard metrics
  const { data: stats, isLoading } = trpc.admin.getDashboardStats.useQuery();

  const metrics = [
    {
      title: "Total Customers",
      value: stats?.totalCustomers || 0,
      change: "+12%",
      trend: "up",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Active Priests",
      value: stats?.activePriests || 0,
      change: "+5%",
      trend: "up",
      icon: UserCog,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Bookings",
      value: stats?.totalBookings || 0,
      change: "+23%",
      trend: "up",
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Revenue (This Month)",
      value: `₹${((stats?.monthlyRevenue || 0) / 100).toLocaleString('en-IN')}`,
      change: "+18%",
      trend: "up",
      icon: DollarSign,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  const recentBookings = stats?.recentBookings || [];
  const topPriests = stats?.topPriests || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your platform.</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <Card key={index} className="border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                    <metric.icon className={`w-6 h-6 ${metric.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    metric.trend === "up" ? "text-green-600" : "text-red-600"
                  }`}>
                    {metric.trend === "up" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {metric.change}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{metric.title}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Bookings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} />
                Recent Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentBookings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No recent bookings</p>
              ) : (
                <div className="space-y-4">
                  {recentBookings.map((booking: any) => (
                    <div key={booking.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{booking.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{booking.pujaName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(booking.pujaDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">₹{(booking.totalAmount / 100).toLocaleString('en-IN')}</p>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Performing Priests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star size={20} />
                Top Performing Priests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : topPriests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No priest data available</p>
              ) : (
                <div className="space-y-4">
                  {topPriests.map((priest: any, index: number) => (
                    <div key={priest.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white font-bold shrink-0">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{priest.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Star size={12} className="fill-yellow-400 text-yellow-400" />
                          <span>{priest.rating} ({priest.totalReviews} reviews)</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{priest.totalBookings}</p>
                        <p className="text-xs text-muted-foreground">bookings</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/customers">
                <a className="p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left block">
                  <Users className="w-6 h-6 text-primary mb-2" />
                  <p className="font-medium text-sm">Add Customer</p>
                </a>
              </Link>
              <Link href="/admin/pujaris">
                <a className="p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left block">
                  <UserCog className="w-6 h-6 text-primary mb-2" />
                  <p className="font-medium text-sm">Add Priest</p>
                </a>
              </Link>
              <Link href="/admin/bookings">
                <a className="p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left block">
                  <Calendar className="w-6 h-6 text-primary mb-2" />
                  <p className="font-medium text-sm">View Bookings</p>
                </a>
              </Link>
              <Link href="/admin/payments">
                <a className="p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left block">
                  <DollarSign className="w-6 h-6 text-primary mb-2" />
                  <p className="font-medium text-sm">View Payments</p>
                </a>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
