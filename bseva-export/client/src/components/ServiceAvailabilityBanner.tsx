import { MapPin, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import {
  AVAILABILITY_ERROR_BODY,
  AVAILABILITY_ERROR_TITLE,
  COMING_SOON_BODY,
  COMING_SOON_TITLE,
  ENABLE_LOCATION_BODY,
  ENABLE_LOCATION_TITLE,
  MY_ADDRESS_BODY,
  MY_ADDRESS_TITLE,
} from "@/lib/serviceAvailabilityMessages";

type Props = {
  /** When true, also show a subtle checking strip while availability is loading. */
  showChecking?: boolean;
};

export default function ServiceAvailabilityBanner({ showChecking = true }: Props) {
  const { status, checking, refresh } = useServiceAvailability();

  if (status === "available" || status === "idle") return null;

  if (checking || status === "checking") {
    if (!showChecking) return null;
    return (
      <div
        className="mb-6 rounded-xl border border-primary/20 bg-orange-50/80 dark:bg-orange-950/30 px-4 py-3 flex items-center gap-3 text-sm text-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span>Checking service availability for your saved address…</span>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="mb-6 rounded-xl border border-primary/25 bg-gradient-to-br from-orange-50 to-amber-50/80 dark:from-orange-950/40 dark:to-amber-950/20 shadow-sm px-5 py-5 md:px-6 md:py-6">
        <div className="flex gap-3 md:gap-4">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-lg md:text-xl font-bold text-[#1A2B4A] dark:text-primary leading-snug">
              {COMING_SOON_TITLE}
            </h2>
            <p className="text-sm md:text-[15px] text-muted-foreground leading-relaxed">{COMING_SOON_BODY}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "no_address") {
    return (
      <div className="mb-6 rounded-xl border border-[#1A2B4A]/20 dark:border-primary/30 bg-card shadow-sm px-5 py-5 md:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex gap-3 md:gap-4 min-w-0">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A2B4A]/10 dark:bg-primary/15 text-[#1A2B4A] dark:text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h2 className="text-lg md:text-xl font-bold text-[#1A2B4A] dark:text-primary leading-snug">
                {MY_ADDRESS_TITLE}
              </h2>
              <p className="text-sm md:text-[15px] text-muted-foreground leading-relaxed">{MY_ADDRESS_BODY}</p>
            </div>
          </div>
          <Link href="/customer/address">
            <Button type="button" className="shrink-0 bg-primary hover:bg-primary/90 font-semibold">
              My Address
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "permission_denied" || status === "unsupported") {
    return (
      <div className="mb-6 rounded-xl border border-[#1A2B4A]/20 dark:border-primary/30 bg-card shadow-sm px-5 py-5 md:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex gap-3 md:gap-4 min-w-0">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A2B4A]/10 dark:bg-primary/15 text-[#1A2B4A] dark:text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h2 className="text-lg md:text-xl font-bold text-[#1A2B4A] dark:text-primary leading-snug">
                {ENABLE_LOCATION_TITLE}
              </h2>
              <p className="text-sm md:text-[15px] text-muted-foreground leading-relaxed">
                {status === "unsupported"
                  ? "Location services aren't supported in this browser. Please try another device or browser to check availability."
                  : ENABLE_LOCATION_BODY}
              </p>
            </div>
          </div>
          {status === "permission_denied" ? (
            <Button
              type="button"
              className="shrink-0 bg-primary hover:bg-primary/90 font-semibold"
              onClick={() => void refresh()}
            >
              Check location
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // error
  return (
    <div className="mb-6 rounded-xl border border-border bg-card shadow-sm px-5 py-5 md:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-lg font-bold text-foreground">{AVAILABILITY_ERROR_TITLE}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{AVAILABILITY_ERROR_BODY}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 font-semibold border-primary/40 text-primary"
          onClick={() => void refresh()}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
