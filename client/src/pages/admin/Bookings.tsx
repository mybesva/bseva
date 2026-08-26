import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Eye, Calendar, MapPin, User, Clock, IndianRupee, Loader2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

interface Booking {
  id: number;
  bookingNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  pujaType: string;
  tier: string;
  bookingDate: Date | string;
  bookingTime: string | null;
  location: string;
  city: string | null;
  status: string;
  totalAmount: number;
  platformFee: number;
  priestAmount: number;
  createdAt: Date | string;
}

export default function Bookings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const { data: bookings, isLoading, refetch } = trpc.admin.getBookings.useQuery({
    search: searchTerm || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const updateStatus = trpc.admin.updateBookingStatus.useMutation({
    onSuccess: () => {
      toast.success("Booking status updated");
      refetch();
      setIsViewDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const handleViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsViewDialogOpen(true);
  };

  const handleStatusChange = (bookingId: number, newStatus: string) => {
    updateStatus.mutate({ bookingId, status: newStatus });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return "TBD";
    return time;
  };

  const bookingsList = bookings || [];
  const totalCount = bookingsList.length;
  const pendingCount = bookingsList.filter(b => b.status === "pending").length;
  const confirmedCount = bookingsList.filter(b => b.status === "confirmed").length;
  const completedCount = bookingsList.filter(b => b.status === "completed").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bookings Management</h1>
            <p className="text-muted-foreground">View and manage all puja bookings</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{totalCount}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">{confirmedCount}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by booking ID, customer, or puja type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Puja Type</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : bookingsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : (
                  bookingsList.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{booking.customerName || "N/A"}</div>
                          <div className="text-sm text-muted-foreground">{booking.customerPhone || ""}</div>
                        </div>
                      </TableCell>
                      <TableCell>{booking.pujaType}</TableCell>
                      <TableCell>
                        <div>
                          <div>{formatDate(booking.bookingDate)}</div>
                          <div className="text-sm text-muted-foreground">{formatTime(booking.bookingTime)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{booking.tier}</TableCell>
                      <TableCell>₹{(booking.totalAmount / 100).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[booking.status] || "bg-gray-100 text-gray-800"}>
                          {booking.status.replace('_', ' ').charAt(0).toUpperCase() + booking.status.replace('_', ' ').slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewBooking(booking)}
                        >
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* View Booking Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">{selectedBooking.bookingNumber}</span>
                  <Badge className={statusColors[selectedBooking.status] || "bg-gray-100 text-gray-800"}>
                    {selectedBooking.status.replace('_', ' ').charAt(0).toUpperCase() + selectedBooking.status.replace('_', ' ').slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <User size={14} /> Customer
                    </div>
                    <div className="font-medium">{selectedBooking.customerName || "N/A"}</div>
                    <div className="text-sm text-muted-foreground">{selectedBooking.customerPhone || ""}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock size={14} /> Package
                    </div>
                    <div className="font-medium capitalize">{selectedBooking.tier}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Calendar size={14} /> Date & Time
                    </div>
                    <div className="font-medium">{formatDate(selectedBooking.bookingDate)}</div>
                    <div className="text-sm text-muted-foreground">{formatTime(selectedBooking.bookingTime)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <MapPin size={14} /> Location
                    </div>
                    <div className="font-medium">{selectedBooking.city || "N/A"}</div>
                    <div className="text-sm text-muted-foreground truncate">{selectedBooking.location}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock size={14} /> Puja Type
                    </div>
                    <div className="font-medium">{selectedBooking.pujaType}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <IndianRupee size={14} /> Amount
                    </div>
                    <div className="font-medium text-lg">₹{(selectedBooking.totalAmount / 100).toLocaleString('en-IN')}</div>
                    <div className="text-xs text-muted-foreground">
                      Platform: ₹{(selectedBooking.platformFee / 100).toLocaleString('en-IN')} | 
                      Priest: ₹{(selectedBooking.priestAmount / 100).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  {selectedBooking.status === "pending" && (
                    <>
                      <Button 
                        className="flex-1"
                        onClick={() => handleStatusChange(selectedBooking.id, "confirmed")}
                        disabled={updateStatus.isPending}
                      >
                        {updateStatus.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                        Confirm Booking
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="flex-1"
                        onClick={() => handleStatusChange(selectedBooking.id, "cancelled")}
                        disabled={updateStatus.isPending}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {selectedBooking.status === "confirmed" && (
                    <>
                      <Button 
                        className="flex-1"
                        onClick={() => handleStatusChange(selectedBooking.id, "in_progress")}
                        disabled={updateStatus.isPending}
                      >
                        {updateStatus.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                        Start Puja
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="flex-1"
                        onClick={() => handleStatusChange(selectedBooking.id, "cancelled")}
                        disabled={updateStatus.isPending}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {selectedBooking.status === "in_progress" && (
                    <Button 
                      className="flex-1"
                      onClick={() => handleStatusChange(selectedBooking.id, "completed")}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      Mark as Completed
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
