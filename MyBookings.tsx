import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Calendar, MapPin, User, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

export default function MyBookings() {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const { data: bookings, isLoading } = trpc.bookings.getMyBookings.useQuery(undefined, {
    enabled: !!user,
  });

  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-cream-50">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <h2 className="text-2xl font-serif font-bold mb-4">Login Required</h2>
              <p className="text-gray-600 mb-6">Please log in to view your bookings.</p>
              <Button
                onClick={() => setLocation("/login")}
                className="bg-[#F7931E] hover:bg-[#e8851a]"
              >
                Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "completed":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-cream-50 to-white py-16">
        <div className="container max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-serif font-bold text-[#1E3A5F] mb-2">My Bookings</h1>
            <p className="text-gray-600">View and manage all your puja bookings</p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7931E]"></div>
              <p className="mt-4 text-gray-600">Loading your bookings...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!bookings || bookings.length === 0) && (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Bookings Yet</h2>
                <p className="text-gray-600 mb-6">You haven't made any puja bookings yet.</p>
                <Button
                  onClick={() => setLocation("/services")}
                  className="bg-[#F7931E] hover:bg-[#e8851a]"
                >
                  Browse Services
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bookings List */}
          {!isLoading && bookings && bookings.length > 0 && (
            <div className="space-y-6">
              {bookings.map(({ booking, pujaType }) => (
                <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl font-serif text-[#1E3A5F]">
                          {pujaType.name}
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                          Booking #{booking.bookingNumber}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(booking.status)} border`}>
                        {booking.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-start space-x-3">
                        <Calendar className="w-5 h-5 text-[#F7931E] mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Date & Time</p>
                          <p className="text-sm text-gray-600">
                            {format(new Date(booking.bookingDate), "PPP")}
                            {booking.bookingTime && ` at ${booking.bookingTime}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <MapPin className="w-5 h-5 text-[#F7931E] mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Location</p>
                          <p className="text-sm text-gray-600">{booking.city}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <User className="w-5 h-5 text-[#F7931E] mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Package</p>
                          <p className="text-sm text-gray-600 capitalize">{booking.tier}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Clock className="w-5 h-5 text-[#F7931E] mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Total Amount</p>
                          <p className="text-sm font-bold text-[#1E3A5F]">
                            ₹{(booking.totalAmount / 100).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {booking.specialInstructions && (
                      <div className="bg-gray-50 p-3 rounded-lg mb-4">
                        <p className="text-xs font-medium text-gray-700 mb-1">Special Instructions:</p>
                        <p className="text-sm text-gray-600">{booking.specialInstructions}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/booking/${booking.id}`)}
                      >
                        View Details
                      </Button>
                      {booking.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          Cancel Booking
                        </Button>
                      )}
                      {booking.status === "completed" && (
                        <Button
                          size="sm"
                          className="bg-[#F7931E] hover:bg-[#e8851a]"
                          onClick={() => setLocation(`/review/${booking.id}`)}
                        >
                          Write Review
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
