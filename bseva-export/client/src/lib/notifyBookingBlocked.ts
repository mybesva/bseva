import {
  AVAILABILITY_ERROR_BODY,
  AVAILABILITY_ERROR_TITLE,
  COMING_SOON_BODY,
  COMING_SOON_TITLE,
  ENABLE_LOCATION_BODY,
  ENABLE_LOCATION_TITLE,
} from "@/lib/serviceAvailabilityMessages";
import type { ServiceAvailabilityStatus } from "@/lib/ServiceAvailabilityContext";
import { toast } from "sonner";

export function notifyBookingBlocked(status: ServiceAvailabilityStatus) {
  if (status === "unavailable") {
    toast.message(COMING_SOON_TITLE, { description: COMING_SOON_BODY });
    return;
  }
  if (status === "permission_denied" || status === "unsupported") {
    toast.message(ENABLE_LOCATION_TITLE, { description: ENABLE_LOCATION_BODY });
    return;
  }
  toast.message(AVAILABILITY_ERROR_TITLE, { description: AVAILABILITY_ERROR_BODY });
}
