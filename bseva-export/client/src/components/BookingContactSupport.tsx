import { Mail, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/MarketingLayout";
import { Card, CardContent } from "@/components/ui/card";
import { telHref, usePublicConfig, whatsappHref } from "@/hooks/usePublicConfig";

const LINK =
  "inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary sm:flex-row sm:gap-2";

export default function BookingContactSupport({ bookingNumber }: { bookingNumber: string }) {
  const { config } = usePublicConfig();
  const message = `Hi B-Seva, I need help with my booking ${bookingNumber}.`;
  const subject = `Support for booking ${bookingNumber}`;
  const email = config.support_email || config.email_from_support;
  return (
    <Card className="print:hidden">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Need help with this booking?</p>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
          <a
            className={LINK}
            href={`${whatsappHref(config.bseva_whatsapp_number)}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="text-[#25D366]">
              <WhatsAppIcon size="1.125rem" />
            </span>
            WhatsApp
          </a>
          <a className={LINK} href={telHref(config.support_phone || config.bseva_whatsapp_number)}>
            <Phone className="size-4 text-primary" aria-hidden />
            Call
          </a>
          <a
            className={LINK}
            href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Booking ID: ${bookingNumber}\n\n`)}`}
          >
            <Mail className="size-4 text-primary" aria-hidden />
            Email
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
