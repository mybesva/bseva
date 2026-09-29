import { useParams } from "wouter";
import RedirectTo from "@/components/RedirectTo";
import { resolveSevaServiceType, servicesPathForType } from "@bseva/config";

/**
 * Legacy Seva hub URLs keep working and land on the unified Explore Services page:
 *   /seva            → /services
 *   /seva/chadhava   → /services?type=chadhava
 *   /seva/pravachan  → /services?type=pravachan
 * `/seva/events/:id` is a separate route (event detail + registration) and is not affected.
 */
export default function SevaHub() {
  const params = useParams<{ serviceType?: string }>();
  return <RedirectTo to={servicesPathForType(resolveSevaServiceType(params.serviceType))} replace />;
}
