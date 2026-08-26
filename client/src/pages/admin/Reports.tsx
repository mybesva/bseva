import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  BarChart3, 
  Users, 
  UserCog,
  Church,
  Sparkles,
  Package,
  Calendar,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  IndianRupee,
  Star,
  Clock,
  MapPin,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Reports() {
  const [dateRange, setDateRange] = useState("last_30_days");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch real data from API
  const { data: pujariData, isLoading: pujariLoading, refetch: refetchPujari } = 
    trpc.admin.getPujariAnalytics.useQuery({ dateRange });
  
  const { data: customerData, isLoading: customerLoading, refetch: refetchCustomer } = 
    trpc.admin.getCustomerAnalytics.useQuery({ dateRange });
  
  const { data: templeData, isLoading: templeLoading, refetch: refetchTemple } = 
    trpc.admin.getTempleAnalytics.useQuery({ dateRange });
  
  const { data: serviceData, isLoading: serviceLoading, refetch: refetchService } = 
    trpc.admin.getServiceAnalytics.useQuery({ dateRange });
  
  const { data: samagriData, isLoading: samagriLoading, refetch: refetchSamagri } = 
    trpc.admin.getSamagriAnalytics.useQuery();
  
  const { data: bookingData, isLoading: bookingLoading, refetch: refetchBooking } = 
    trpc.admin.getBookingAnalytics.useQuery({ dateRange });
  
  const { data: paymentData, isLoading: paymentLoading, refetch: refetchPayment } = 
    trpc.admin.getPaymentAnalytics.useQuery({ dateRange });

  const isLoading = pujariLoading || customerLoading || templeLoading || 
                    serviceLoading || samagriLoading || bookingLoading || paymentLoading;

  const handleRefresh = () => {
    refetchPujari();
    refetchCustomer();
    refetchTemple();
    refetchService();
    refetchSamagri();
    refetchBooking();
    refetchPayment();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount / 100); // Convert from paise to rupees
  };

  const formatCurrencyRupees = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStockStatus = (status: string) => {
    const colors: Record<string, string> = {
      OK: "bg-green-100 text-green-700",
      Low: "bg-yellow-100 text-yellow-700",
      Critical: "bg-red-100 text-red-700",
    };
    return colors[status] || colors.OK;
  };

  const getAvailabilityColor = (status: string) => {
    const colors: Record<string, string> = {
      available: "bg-green-100 text-green-700",
      busy: "bg-yellow-100 text-yellow-700",
      unavailable: "bg-red-100 text-red-700",
    };
    return colors[status?.toLowerCase()] || colors.available;
  };

  // Default values for when data is loading
  const pujariAnalytics = pujariData || [];
  const customerAnalytics = customerData || { totalCustomers: 0, newRegistrations: 0, totalBookings: 0, repeatRate: 0 };
  const templeAnalytics = templeData || [];
  const serviceAnalytics = serviceData || [];
  const samagriAnalytics = samagriData || [];
  const bookingAnalytics = bookingData || { daily: [], monthly: { total: 0, confirmed: 0, cancelled: 0, pending: 0 } };
  const paymentAnalytics = paymentData || { gmv: 0, commissions: 0, priestPayouts: 0, pendingSettlements: 0, refunds: 0, byMethod: [] };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1E3A5F]">Analytics & Reports</h1>
            <p className="text-gray-600 mt-1">Comprehensive business intelligence dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button className="bg-[#F7931E] hover:bg-[#e8850d]">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {paymentLoading ? "..." : formatCurrency(paymentAnalytics.gmv)}
                  </p>
                  <div className="flex items-center mt-1 text-green-600 text-sm">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>vs last period</span>
                  </div>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <IndianRupee className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Bookings</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {bookingLoading ? "..." : bookingAnalytics.monthly.total}
                  </p>
                  <div className="flex items-center mt-1 text-green-600 text-sm">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>vs last period</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Pujaris</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {pujariLoading ? "..." : pujariAnalytics.length}
                  </p>
                  <div className="flex items-center mt-1 text-green-600 text-sm">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>this period</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <UserCog className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Customer Satisfaction</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {customerLoading ? "..." : `${customerAnalytics.repeatRate}%`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Repeat rate</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-7 w-full max-w-4xl">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="pujari" className="flex items-center gap-1">
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">Pujari</span>
            </TabsTrigger>
            <TabsTrigger value="customer" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Customer</span>
            </TabsTrigger>
            <TabsTrigger value="temple" className="flex items-center gap-1">
              <Church className="w-4 h-4" />
              <span className="hidden sm:inline">Temple</span>
            </TabsTrigger>
            <TabsTrigger value="service" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Service</span>
            </TabsTrigger>
            <TabsTrigger value="samagri" className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Samagri</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Booking Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Booking Trend (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {bookingLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bookingAnalytics.daily.map((day: any, index: number) => (
                        <div key={index} className="flex items-center gap-4">
                          <span className="w-16 text-sm text-gray-500">{day.date}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                            <div 
                              className="h-full bg-[#F7931E] rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${Math.min((day.total / 50) * 100, 100)}%` }}
                            >
                              <span className="text-xs text-white font-medium">{day.total}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentAnalytics.byMethod.map((method: any, index: number) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{method.method || 'Other'}</span>
                            <span className="text-gray-500">
                              {formatCurrency(method.amount)} ({method.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div 
                              className="h-full bg-[#1E3A5F] rounded-full"
                              style={{ width: `${method.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Services */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Performing Services</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Avg Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceAnalytics.slice(0, 5).map((service: any) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell className="text-right">{service.bookings}</TableCell>
                          <TableCell className="text-right">{formatCurrency(service.revenue)}</TableCell>
                          <TableCell className="text-right">{service.avgDuration} min</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pujari Tab */}
          <TabsContent value="pujari" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pujari Performance Analytics</CardTitle>
                <CardDescription>Detailed performance metrics for all pujaris</CardDescription>
              </CardHeader>
              <CardContent>
                {pujariLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pujari</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                        <TableHead className="text-right">Earnings</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pujariAnalytics.map((pujari: any) => (
                        <TableRow key={pujari.id}>
                          <TableCell className="font-medium">{pujari.name || `Pujari #${pujari.id}`}</TableCell>
                          <TableCell className="text-right">{pujari.bookings}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              {Number(pujari.rating).toFixed(1)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrencyRupees(Number(pujari.earnings))}</TableCell>
                          <TableCell>
                            <Badge className={getAvailabilityColor(pujari.availabilityStatus)}>
                              {pujari.availabilityStatus || 'Available'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customer Tab */}
          <TabsContent value="customer" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">Total Customers</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {customerLoading ? "..." : customerAnalytics.totalCustomers}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">New Registrations</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {customerLoading ? "..." : customerAnalytics.newRegistrations}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">Total Bookings</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {customerLoading ? "..." : customerAnalytics.totalBookings}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">Repeat Rate</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">
                    {customerLoading ? "..." : `${customerAnalytics.repeatRate}%`}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Temple Tab */}
          <TabsContent value="temple" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Temple Analytics</CardTitle>
                <CardDescription>Booking and revenue by temple location</CardDescription>
              </CardHeader>
              <CardContent>
                {templeLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Temple</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templeAnalytics.map((temple: any) => (
                        <TableRow key={temple.id}>
                          <TableCell className="font-medium">{temple.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              {temple.city}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{temple.bookings}</TableCell>
                          <TableCell className="text-right">{formatCurrency(temple.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Service Tab */}
          <TabsContent value="service" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service/Puja Analytics</CardTitle>
                <CardDescription>Performance metrics by service type</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Avg Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceAnalytics.map((service: any) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell className="text-right">{service.bookings}</TableCell>
                          <TableCell className="text-right">{formatCurrency(service.revenue)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {service.avgDuration} min
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Samagri Tab */}
          <TabsContent value="samagri" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Samagri Inventory Analytics</CardTitle>
                <CardDescription>Stock levels and consumption tracking</CardDescription>
              </CardHeader>
              <CardContent>
                {samagriLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Consumed</TableHead>
                        <TableHead className="text-right">Reorder Level</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samagriAnalytics.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.stock} {item.unit}</TableCell>
                          <TableCell className="text-right">{item.consumed} {item.unit}</TableCell>
                          <TableCell className="text-right">{item.reorderLevel} {item.unit}</TableCell>
                          <TableCell>
                            <Badge className={getStockStatus(item.status)}>
                              {item.status === 'Critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">GMV</p>
                  <p className="text-xl font-bold text-[#1E3A5F]">
                    {paymentLoading ? "..." : formatCurrency(paymentAnalytics.gmv)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">Commissions</p>
                  <p className="text-xl font-bold text-green-600">
                    {paymentLoading ? "..." : formatCurrency(paymentAnalytics.commissions)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">Priest Payouts</p>
                  <p className="text-xl font-bold text-[#1E3A5F]">
                    {paymentLoading ? "..." : formatCurrency(paymentAnalytics.priestPayouts)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">
                    {paymentLoading ? "..." : formatCurrency(paymentAnalytics.pendingSettlements)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">Refunds</p>
                  <p className="text-xl font-bold text-red-600">
                    {paymentLoading ? "..." : formatCurrency(paymentAnalytics.refunds)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentAnalytics.byMethod.map((method: any, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{method.method || 'Other'}</span>
                          <span className="text-gray-500">
                            {formatCurrency(method.amount)} ({method.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div 
                            className="h-full bg-gradient-to-r from-[#1E3A5F] to-[#F7931E] rounded-full"
                            style={{ width: `${method.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
