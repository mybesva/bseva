import { Link, useParams } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import BookingDetailPanel from "@/components/BookingDetailPanel";
import { useI18n } from "@/i18n/I18nProvider";

export default function PujariBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useI18n();
  const id = String(params.id || "").trim();
  return (
    <PujariPortal>
      <Link href="/pujari/bookings">
        <a className="mb-4 inline-block text-sm text-primary">{t("web.booking.backToBookings")}</a>
      </Link>
      {id ? <BookingDetailPanel bookingId={id} role="pujari" /> : <p className="text-sm text-muted-foreground">{t("web.booking.notFound")}</p>}
    </PujariPortal>
  );
}
