import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import { notifyBookingBlocked } from "@/lib/notifyBookingBlocked";
import { useI18n } from "@/i18n/I18nProvider";

export const CUSTOMER_ADDRESS_PATH = "/customer/profile?tab=address";

/** Shared gate for every CTA that starts a booking flow. */
export function useStartBooking() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { canBook, checking, status, refresh } = useServiceAvailability();

  // Missing address: keep Book buttons active; clicking one prompts for the address (one banner on
  // the page explains it) instead of every card saying so. Booking itself still can't proceed.
  const needsAddress = status === "no_address" || status === "permission_denied" || status === "unsupported";
  const bookingBlocked =
    Boolean(isAuthenticated && user?.role === "customer" && (checking || (!canBook && !needsAddress)));
  const goToAddress = () => setLocation(CUSTOMER_ADDRESS_PATH);

  function startBooking(slug: string) {
    const path = `/book/${slug}`;
    if (authLoading || checking) return;
    if (!isAuthenticated || user?.role !== "customer") {
      setLocation(getLoginUrl({ role: "customer", returnPath: path }));
      return;
    }
    if (!canBook) {
      notifyBookingBlocked(status, t, goToAddress);
      return;
    }
    setLocation(path);
  }

  /** Label (and fix-it action, when there is one) for a blocked Book button. */
  const blockedCta: { label: string; action?: () => void } = checking
    ? { label: t("services.checkingAvailability") }
    : status === "error"
        ? { label: t("web.availability.errorTitle"), action: () => void refresh() }
        : { label: t("services.bookingUnavailableArea") };

  return { startBooking, bookingBlocked, blockedCta, checking, canBook, status, needsAddress, goToAddress };
}
