import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { policyBySlug, useLegalPolicies } from "@/hooks/useLegalPolicies";
import { cn } from "@/lib/utils";
import { ArrowLeft, Ban, FileText, Scale } from "lucide-react";
import { Link } from "wouter";

const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  platform_terms: Scale,
  booking_terms: FileText,
  cancellation_policy: Ban,
};

export default function TermsPage() {
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
    <Layout>
      <div className="container py-12 max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="font-heading text-3xl font-bold mb-2">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose a section to read. Only one section is shown at a time.
        </p>

        {loading && <Skeleton className="h-40 w-full mb-6" />}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
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
                    active ? "bg-primary text-white" : "bg-secondary text-sidebar"
                  )}
                >
                  <Icon size={20} />
                </span>
                <span className={cn("text-sm font-medium leading-snug", active ? "text-sidebar" : "text-muted-foreground")}>
                  {policy.title}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="space-y-5 text-muted-foreground leading-relaxed">
            <div>
              <h2 className="font-heading text-xl text-foreground mb-1">{selected.title}</h2>
              {selected.version && (
                <p className="text-sm text-muted-foreground mb-4">Version {selected.version}</p>
              )}
            </div>
            {selected.points.map((s, i) => (
              <section key={i}>
                {s.title ? <h3 className="font-heading text-lg text-foreground mb-2">{s.title}</h3> : null}
                <p>{s.body}</p>
              </section>
            ))}
          </div>
        )}

        <p className="mt-12 text-xs text-muted-foreground">© BSeva. All rights reserved.</p>
      </div>
    </Layout>
  );
}
