import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import { notifyBookingBlocked } from "@/lib/notifyBookingBlocked";
import { useI18n } from "@/i18n/I18nProvider";

/** Shared gate for every CTA that starts a booking flow. */
export function useStartBooking() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { canBook, checking, status } = useServiceAvailability();

  const bookingBlocked =
    Boolean(isAuthenticated && user?.role === "customer" && (!canBook || checking));

  function startBooking(slug: string) {
    const path = `/book/${slug}`;
    if (authLoading || checking) return;
    if (!isAuthenticated || user?.role !== "customer") {
      setLocation(getLoginUrl({ role: "customer", returnPath: path }));
      return;
    }
    if (!canBook) {
      notifyBookingBlocked(status, t);
      return;
    }
    setLocation(path);
  }

  return { startBooking, bookingBlocked, checking, canBook, status };
}
