import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { policyBySlug, useLegalPolicies, type LegalPolicy } from "@/hooks/useLegalPolicies";
import { cn } from "@/lib/utils";
import { Ban, FileText, Scale, Shield } from "lucide-react";

type LegalKind = "terms" | "privacy";

const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  platform_terms: Scale,
  booking_terms: FileText,
  cancellation_policy: Ban,
  privacy: Shield,
};

function PolicyPoints({ policy }: { policy: LegalPolicy }) {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      {policy.points.map((s, i) => (
        <section key={`${policy.slug}-${i}`}>
          {s.title ? <h3 className="font-medium text-foreground mb-1">{s.title}</h3> : null}
          <p>{s.body}</p>
        </section>
      ))}
    </div>
  );
}

function SectionPicker({
  policies,
  selectedSlug,
  onSelect,
}: {
  policies: LegalPolicy[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  if (policies.length <= 1) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
      {policies.map((policy) => {
        const Icon = SECTION_ICONS[policy.slug] || FileText;
        const active = selectedSlug === policy.slug;
        return (
          <button
            key={policy.slug}
            type="button"
            onClick={() => onSelect(policy.slug)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-medium transition-colors",
              active
                ? "border-primary bg-orange-50 text-sidebar"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                active ? "bg-primary text-white" : "bg-secondary text-sidebar"
              )}
            >
              <Icon size={14} />
            </span>
            <span className="leading-snug">{policy.title}</span>
          </button>
        );
      })}
    </div>
  );
}

function LegalBody({ kind }: { kind: LegalKind }) {
  const slugs =
    kind === "terms"
      ? ["platform_terms", "booking_terms", "cancellation_policy"]
      : ["privacy"];
  const { policies, loading } = useLegalPolicies(slugs);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!policies.length) return;
    setSelectedSlug((prev) => prev || policies[0].slug);
  }, [policies]);

  const selected = policyBySlug(policies, selectedSlug || policies[0]?.slug || "") || policies[0];
  const title = kind === "terms" ? "Terms & Conditions" : selected?.title || "Privacy Policy";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading">{title}</DialogTitle>
        {selected?.version && <p className="text-sm text-muted-foreground">Version {selected.version}</p>}
      </DialogHeader>
      {loading && <Skeleton className="h-32 w-full" />}
      <SectionPicker policies={policies} selectedSlug={selectedSlug} onSelect={setSelectedSlug} />
      <ScrollArea className="max-h-[50vh] pr-4">
        {selected ? <PolicyPoints policy={selected} /> : null}
      </ScrollArea>
    </>
  );
}

export function LegalModal({
  kind,
  open,
  onOpenChange,
}: {
  kind: LegalKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <LegalBody kind={kind} />
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LegalInlineLink({
  kind,
  children,
  className = "text-primary underline hover:text-primary/80",
}: {
  kind: LegalKind;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <LegalModal kind={kind} open={open} onOpenChange={setOpen} />
    </>
  );
}
