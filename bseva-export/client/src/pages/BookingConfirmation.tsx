import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { Loader2 } from "lucide-react";

/** Legacy confirmation URL — redirects to the booking receipt page. */
export default function BookingConfirmation() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const bookingNumber = searchParams.get("number");
  const id = searchParams.get("id");

  useEffect(() => {
    const target = id || bookingNumber;
    if (target) {
      setLocation(`/booking/${encodeURIComponent(target)}`);
    } else {
      setLocation("/customer/bookings");
    }
  }, [bookingNumber, id, setLocation]);

  return (
    <Layout>
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    </Layout>
  );
}
