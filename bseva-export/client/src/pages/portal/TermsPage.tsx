import { useEffect, useState } from "react";
import { CustomerPortal, PujariPortal } from "@/components/RolePortals";
import { Skeleton } from "@/components/ui/skeleton";
import { policyBySlug, useLegalPolicies } from "@/hooks/useLegalPolicies";
import { cn } from "@/lib/utils";
import { Ban, FileText, Scale } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  platform_terms: Scale,
  booking_terms: FileText,
  cancellation_policy: Ban,
};

function PortalTermsContent() {
  const { t } = useI18n();
  const { policies, loading } = useLegalPolicies([
    "platform_terms",
    "booking_terms",
    "cancellation_policy",
  ]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!policies.length) return;
    setSelectedSlug((prev) => prev || policies[0].slug);
  }, [policies]);

  const selected = policyBySlug(policies, selectedSlug || policies[0]?.slug || "") || policies[0];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("legal.terms")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("web.legal.chooseSection")}
        </p>
      </div>

      {loading && <Skeleton className="h-40 w-full" />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {policies.map((policy) => {
          const Icon = SECTION_ICONS[policy.slug] || FileText;
          const active = selectedSlug === policy.slug;
          return (
            <button
              key={policy.slug}
              type="button"
              onClick={() => setSelectedSlug(policy.slug)}
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border-2 p-4 text-center transition-colors",
                active
                  ? "border-primary bg-orange-50 shadow-sm"
                  : "border-border bg-background hover:border-primary/40"
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  active ? "bg-primary text-white" : "bg-secondary text-foreground"
                )}
              >
                <Icon size={20} />
              </span>
              <span
                className={cn(
                  "text-sm font-medium leading-snug",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {policy.title}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-5 text-muted-foreground leading-relaxed">
          <div>
            <h2 className="text-xl text-foreground mb-1">{selected.title}</h2>
            {selected.version && (
              <p className="text-sm text-muted-foreground mb-4">{t("common.version", { version: selected.version })}</p>
            )}
          </div>
          {selected.points.map((s, i) => (
            <section key={i}>
              {s.title ? <h3 className="text-lg text-foreground mb-2">{s.title}</h3> : null}
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function PujariTermsPage() {
  return (
    <PujariPortal>
      <PortalTermsContent />
    </PujariPortal>
  );
}

export function CustomerTermsPage() {
  return (
    <CustomerPortal>
      <PortalTermsContent />
    </CustomerPortal>
  );
}
