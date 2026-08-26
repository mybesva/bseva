import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Download, Home, Calendar } from "lucide-react";

export default function BookingConfirmation() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const bookingNumber = searchParams.get("number");

  useEffect(() => {
    if (!bookingNumber) {
      setLocation("/");
    }
  }, [bookingNumber, setLocation]);

  if (!bookingNumber) {
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-cream-50 to-white py-16">
        <div className="container max-w-3xl">
          <Card className="border-2 border-green-500 shadow-xl">
            <CardContent className="pt-12 pb-8 text-center">
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
              </div>

              {/* Success Message */}
              <h1 className="text-3xl font-serif font-bold text-[#1E3A5F] mb-3">
                Booking Confirmed!
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Your puja booking has been successfully confirmed. We have sent the details to your registered email.
              </p>

              {/* Booking Number */}
              <div className="bg-gradient-to-r from-[#F7931E]/10 to-[#F7931E]/5 border-2 border-[#F7931E] rounded-lg p-6 mb-8">
                <p className="text-sm text-gray-600 mb-2">Your Booking Number</p>
                <p className="text-3xl font-bold text-[#1E3A5F] font-mono tracking-wider">
                  {bookingNumber}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Please save this number for future reference
                </p>
              </div>

              {/* What's Next */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
                <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">What happens next?</h2>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</span>
                    <span>You will receive a confirmation email with all booking details within 5 minutes.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</span>
                    <span>Our team will contact you within 24 hours to confirm the priest assignment and final details.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</span>
                    <span>The assigned priest will reach out 48 hours before the puja date to discuss any specific requirements.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">4</span>
                    <span>On the scheduled date, the priest will arrive 30 minutes early to set up the puja arrangements.</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => setLocation("/my-bookings")}
                  className="bg-[#F7931E] hover:bg-[#e8851a] text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  View My Bookings
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Receipt
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/")}
                  className="text-gray-600 hover:text-[#1E3A5F]"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>

              {/* Support Info */}
              <div className="mt-8 pt-8 border-t text-sm text-gray-600">
                <p className="mb-2">Need help with your booking?</p>
                <p className="font-medium text-[#1E3A5F]">
                  Call us at <a href="tel:+919876543210" className="underline">+91 98765 43210</a> or email{" "}
                  <a href="mailto:support@bseva.com" className="underline">support@bseva.com</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
