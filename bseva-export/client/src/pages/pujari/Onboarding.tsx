import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PujariOnboardingProgress } from "@/components/PujariOnboardingWalkthrough";
import { api, rupees } from "@/lib/api";
import { routeForOnboardingStep, validateOnboardingStep } from "@/lib/pujariOnboarding";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

export default function PujariOnboardingPage() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    const p = await api<any>("/pujari/profile");
    if (p.profile_submitted_at) {
      setLocation("/pujari");
      return;
    }
    const step = Math.min(6, Math.max(1, Number(p.onboarding_step || 1)));
    if (step < 6) {
      setLocation(routeForOnboardingStep(step));
      return;
    }
    setProfile(p);
    setConsent(!!p.final_submission_consent);
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  async function payJoiningFee() {
    setPayingFee(true);
    try {
      const out = await api<{ joining_fee_status: string }>("/pujari/joining-fee/pay", { method: "POST" });
      toast.success(t(out.joining_fee_status === "paid" ? "web.onboarding.feePaid" : "web.onboarding.noFee"));
      await load();
    } catch (err: any) {
      toast.error(err.message || t("web.onboarding.feeFailed"));
    } finally {
      setPayingFee(false);
    }
  }

  async function finalSubmit() {
    if (!profile) return;
    const errors = await validateOnboardingStep(6, profile, { consent });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error(t("web.validation.finalConsent"));
      return;
    }
    setSaving(true);
    try {
      await api("/pujari/profile/submit", {
        method: "POST",
        body: JSON.stringify({
          final_submission_consent: true,
          terms_version: "2026-01",
          privacy_version: "2026-01",
        }),
      });
      toast.success(t("web.onboarding.submitted"));
      await refresh();
      setLocation("/pujari");
    } catch (err: any) {
      toast.error(err.message || t("web.onboarding.submitFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <PujariPortal>
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </PujariPortal>
    );
  }

  const feeStatus = String(profile.joining_fee_status || "not_required");
  const feeAmount = Number(profile.joining_fee_paise || 0);
  const errMsgs = Object.values(fieldErrors);

  return (
    <PujariPortal>
      {feeStatus !== "not_required" && (
        <Card className="max-w-3xl mb-6 border-primary/30 bg-orange-50/60">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("web.onboarding.joiningFee")}</p>
              <p className="font-semibold text-lg capitalize">
                {t(`status.${feeStatus}`)}
                {feeAmount > 0 ? ` · ${rupees(feeAmount)}` : ""}
              </p>
              {feeStatus === "pending" && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t("web.onboarding.feeDescription")}
                </p>
              )}
            </div>
            {feeStatus === "pending" && (
              <Button size="sm" disabled={payingFee} onClick={() => void payJoiningFee()}>
                {payingFee ? t("web.onboarding.paying") : t("web.onboarding.payFee")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t("web.onboarding.reviewSubmit")}</CardTitle>
          <PujariOnboardingProgress step={6} />
        </CardHeader>
        <CardContent className="space-y-4">
          {errMsgs.length > 0 && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">
              {errMsgs.map((msg) => (
                <p key={msg}>• {t(msg)}</p>
              ))}
            </div>
          )}
          <div className="text-sm space-y-1 border rounded-md p-4 bg-secondary/20">
            <p>
              <span className="text-muted-foreground">{t("auth.name")}:</span> {profile.full_name || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{t("auth.phone")}:</span> {profile.mobile_number || user?.phone || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{t("auth.city")}:</span> {profile.city || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{t("pujari.public.experience")}:</span> {profile.experience_years ?? "—"} {t("pujari.public.years")}
            </p>
            <p>
              <span className="text-muted-foreground">{t("pujari.public.sampradaya")}:</span>{" "}
              {profile.sampradaya ? t(`pujari.${profile.sampradaya}`) : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{t("pujari.profile.completion")}:</span> {profile.profile_completion_percentage ?? 0}%
            </p>
          </div>
          <label
            className={`flex items-start gap-2 text-sm rounded-md p-2 ${
              fieldErrors.consent ? "border border-red-500 bg-red-50" : ""
            }`}
          >
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => {
                setConsent(!!v);
                setFieldErrors((prev) => {
                  if (!prev.consent) return prev;
                  const next = { ...prev };
                  delete next.consent;
                  return next;
                });
              }}
            />
            <span>
              {t("web.onboarding.consent")} *
            </span>
          </label>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setLocation("/pujari/bank")}>
              {t("common.back")}
            </Button>
            <Button type="button" disabled={saving || !consent} onClick={() => void finalSubmit()}>
              {saving ? t("web.onboarding.submitting") : t("web.onboarding.finalSubmit")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
