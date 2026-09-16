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
import type { ServiceAvailabilityStatus } from "@/lib/ServiceAvailabilityContext";
import { toast } from "sonner";

type TranslateFn = (key: string) => string;

export function notifyBookingBlocked(status: ServiceAvailabilityStatus, t: TranslateFn) {
  if (status === "unavailable") {
    toast.message(t(COMING_SOON_TITLE), { description: t(COMING_SOON_BODY) });
    return;
  }
  if (status === "no_address") {
    toast.message(t(MY_ADDRESS_TITLE), { description: t(MY_ADDRESS_BODY) });
    return;
  }
  if (status === "permission_denied" || status === "unsupported") {
    toast.message(t(ENABLE_LOCATION_TITLE), { description: t(ENABLE_LOCATION_BODY) });
    return;
  }
  toast.message(t(AVAILABILITY_ERROR_TITLE), { description: t(AVAILABILITY_ERROR_BODY) });
}
