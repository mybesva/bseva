import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  ONBOARDING_STEPS,
  nextOnboardingStep,
  patchOnboardingStep,
  previousOnboardingStep,
  routeForOnboardingStep,
  stepLabel,
  validateOnboardingStep,
  type OnboardingPage,
} from "@/lib/pujariOnboarding";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type Props = {
  page: OnboardingPage;
  /** Persist the current tab to the server (no full-form validation). Return false to stop. */
  beforeContinue?: () => Promise<boolean>;
  fieldErrors?: Record<string, string>;
  onFieldErrors?: (errors: Record<string, string>) => void;
  saving?: boolean;
};

export function PujariOnboardingProgress({ step }: { step: number }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2 mb-6">
      <p className="text-sm font-medium">
        Complete profile — Step {step} of {ONBOARDING_STEPS}: {stepLabel(step)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              n === step
                ? "bg-primary text-white border-primary"
                : n < step
                  ? "bg-emerald-600/15 text-emerald-700 border-emerald-600/30"
                  : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${(step / ONBOARDING_STEPS) * 100}%` }} />
      </div>
    </div>
  );
}

export function usePujariOnboardingGate(page: OnboardingPage) {
  const [step, setStep] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(true);

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        setSubmitted(!!p.profile_submitted_at);
        setStep(Math.min(ONBOARDING_STEPS, Math.max(1, Number(p.onboarding_step || 1))));
      })
      .catch(() => setStep(null));
  }, []);

  const active =
    !submitted &&
    step != null &&
    (page === "profile"
      ? step === 1 || step === 3
      : page === "address"
        ? step === 2
        : page === "documents"
          ? step === 4
          : page === "services"
            ? step === 5
            : page === "availability"
              ? step === 5
              : page === "bank"
                ? step === 5
                : page === "review"
                  ? step === 6
                  : false);

  return { active, step: step ?? 1, submitted };
}

export default function PujariOnboardingWalkthrough({
  page,
  beforeContinue,
  fieldErrors = {},
  onFieldErrors,
  saving = false,
}: Props) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { active, step } = usePujariOnboardingGate(page);
  const [busy, setBusy] = useState(false);

  if (!active) return null;

  async function goBack() {
    const prev = previousOnboardingStep(step);
    if (page === "bank" && step === 5) {
      setLocation("/pujari/availability");
      return;
    }
    if (page === "availability" && step === 5) {
      setLocation("/pujari/services");
      return;
    }
    if (page === "services" && step === 5) {
      setLocation("/pujari/documents");
      return;
    }
    setLocation(routeForOnboardingStep(prev));
  }

  async function goContinue() {
    setBusy(true);
    try {
      if (beforeContinue && !(await beforeContinue())) {
        return;
      }
      const p = await api<any>("/pujari/profile");
      const validateStep =
        page === "profile" ? (step === 3 ? 3 : 1) : page === "review" ? 6 : step;
      const errors = await validateOnboardingStep(validateStep, p, {
        userPhone: user?.phone,
        from:
          page === "services" || page === "availability" || page === "bank" ? page : undefined,
      });
      if (onFieldErrors) onFieldErrors(errors);
      if (Object.keys(errors).length) {
        toast.error("Complete required fields marked in red, then tap Save & next again");
        document.querySelector<HTMLElement>(".border-red-500, .text-red-600")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }

      if (page === "services" && step === 5) {
        setLocation("/pujari/availability");
        return;
      }
      if (page === "availability" && step === 5) {
        setLocation("/pujari/bank");
        return;
      }

      const next = nextOnboardingStep(step, page);
      await patchOnboardingStep(next);
      setLocation(routeForOnboardingStep(next));
    } catch (e: any) {
      toast.error(e.message || "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  const errList = Object.values(fieldErrors);

  return (
    <div className="mt-8 pt-6 border-t space-y-3">
      <PujariOnboardingProgress step={step} />
      {errList.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">
          {errList.map((msg) => (
            <p key={msg}>• {msg}</p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || saving || step <= 1} onClick={() => void goBack()}>
          Back
        </Button>
        <Button type="button" disabled={busy || saving} onClick={() => void goContinue()}>
          {busy || saving ? "Saving…" : "Save & next"}
        </Button>
      </div>
    </div>
  );
}
