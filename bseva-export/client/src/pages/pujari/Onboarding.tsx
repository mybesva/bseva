import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import PriestOnboardingPanel from "@/components/PriestOnboardingPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { api, rupees } from "@/lib/api";
import { isValidPujariDob, validateAddress } from "@/lib/fieldValidation";
import { parsePhoneParts, validatePhoneNational } from "@/lib/phone";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { splitDisplayName, validatePersonNameParts } from "@/lib/personName";

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`text-sm flex gap-2 ${ok ? "text-emerald-700" : "text-muted-foreground"}`}>
      <span aria-hidden>{ok ? "✓" : "○"}</span>
      <span>{label}</span>
    </li>
  );
}

function GateCard({
  title,
  description,
  href,
  linkLabel,
  children,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {children}
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href={href}>{linkLabel}</Link>
      </Button>
    </div>
  );
}

export default function PujariOnboardingPage() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function mergeProfileRow(p: any) {
    const fullName = String(p.full_name || user?.name || "").replace(/\s+Reddy\s*$/i, "").trim() || user?.name || "";
    const split = splitDisplayName(fullName);
    return {
      ...p,
      full_name: fullName,
      first_name: p.first_name ?? split.first_name,
      middle_name: p.middle_name ?? split.middle_name,
      last_name: p.last_name ?? split.last_name,
    };
  }

  async function load() {
    const p = await api<any>("/pujari/profile");
    if (p.profile_submitted_at) {
      setLocation("/pujari");
      return;
    }
    setProfile(mergeProfileRow(p));
    const s = Number(p.onboarding_step || 1);
    setStep(Math.min(6, Math.max(1, s)));
    setConsent(!!p.final_submission_consent);
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  async function refreshProfile(): Promise<any | null> {
    try {
      const p = await api<any>("/pujari/profile");
      const merged = mergeProfileRow(p);
      setProfile(merged);
      return merged;
    } catch (e: any) {
      toast.error(e.message || "Could not refresh profile");
      return null;
    }
  }

  function Err({ name }: { name: string }) {
    if (!fieldErrors[name]) return null;
    return <p className="text-xs text-red-600 mt-1">{fieldErrors[name]}</p>;
  }

  function ErrorSummary() {
    const msgs = Object.values(fieldErrors);
    if (!msgs.length) return null;
    return (
      <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2 space-y-0.5">
        <p className="font-semibold">Please fix the following:</p>
        {msgs.map((msg) => (
          <p key={msg}>• {msg}</p>
        ))}
      </div>
    );
  }

  async function validateStep(current: number): Promise<boolean> {
    let p = profile;
    if (current <= 5) {
      const merged = await refreshProfile();
      if (!merged) return false;
      p = merged;
    } else if (!p) {
      return false;
    }
    const errors: Record<string, string> = {};
    const req = (key: string, label: string, ok: boolean) => {
      if (!ok) errors[key] = `${label} is required`;
    };

    if (current === 1) {
      req("profile_photo_path", "Profile photo (My Profile)", !!p.profile_photo_path);
      Object.assign(
        errors,
        validatePersonNameParts({
          first_name: String(p.first_name ?? splitDisplayName(p.full_name).first_name),
          middle_name: String(p.middle_name ?? ""),
          last_name: String(p.last_name ?? splitDisplayName(p.full_name).last_name),
        }),
      );
      const dob = String(p.date_of_birth || "").trim();
      req("date_of_birth", "Date of birth (My Profile)", !!dob);
      if (dob && !isValidPujariDob(dob)) {
        errors.date_of_birth = "Pujari must be at least 18 years old (date cannot be in the future)";
      }
      const parsed = parsePhoneParts(p.mobile_number || user?.phone || "");
      const phoneErr = validatePhoneNational(parsed.countryCode, parsed.national);
      if (phoneErr) errors.mobile_number = phoneErr;
      req("gotra", "Gotra (My Profile)", !!String(p.gotra || "").trim());
      req("pravara", "Pravara (My Profile)", !!String(p.pravara || "").trim());
    }
    if (current === 2) {
      const addrErrs = validateAddress({
        address_line1: p.address_line1,
        city: p.city,
        district: p.district,
        state: p.state,
        pincode: p.pincode,
      });
      Object.assign(errors, addrErrs);
      req("latitude", "Map pin (Address)", p.latitude != null && p.longitude != null);
    }
    if (current === 3) {
      const quals: string[] = p.qualifications || [];
      req("qualifications", "Qualifications (My Profile)", quals.length > 0);
      req("qualification_year", "Qualification year (My Profile)", !!p.qualification_year);
      req("sampradaya", "Sampradaya (My Profile)", !!String(p.sampradaya || "").trim());
    }
    if (current === 4) {
      try {
        const docs = await api<any[]>("/pujari/documents");
        const hasAadhaar = docs.some((d) => d.document_type === "identity");
        req("identity", "Aadhaar upload", hasAadhaar);
        // Re-read flag from server (checkbox saves licence_type on the profile)
        let licenceType = String(p.licence_type || "").toLowerCase();
        try {
          const fresh = await api<any>("/pujari/profile");
          licenceType = String(fresh.licence_type || "").toLowerCase();
        } catch {
          /* keep local */
        }
        if (licenceType === "driving_licence" || licenceType === "cab_commercial") {
          const hasDl = docs.some((d) => d.document_type === "driving_licence");
          req("driving_licence", "Driving Licence upload", hasDl);
        }
      } catch {
        errors.identity = "Could not verify documents — upload Aadhaar and try again";
      }
    }
    if (current === 5) {
      req("service_radius_km", "Service radius (Availability)", !!p.service_radius_km);
      req("bank_holder_name", "Bank details (Bank / Settlement)", !!String(p.bank_holder_name || "").trim());
      req("bank_ifsc", "Bank IFSC", !!String(p.bank_ifsc || "").trim());
      req(
        "bank_account_number",
        "Bank account number",
        !!String(p.bank_account_number || "").replace(/\D/g, ""),
      );
    }
    if (current === 6) {
      req("consent", "Final submission consent", consent);
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fill the required fields marked in red");
      return false;
    }
    return true;
  }

  async function saveStep(nextStep: number, extra: Record<string, unknown> = {}) {
    if (!profile) return;
    setSaving(true);
    try {
      const body = { ...extra, onboarding_step: nextStep };
      const updated = await api<any>("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setProfile(updated);
      setStep(nextStep);
      setFieldErrors({});
      toast.success("Saved");
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndContinue() {
    if (!profile) return;
    if (!(await validateStep(step))) return;
    if (step >= 1 && step <= 5) {
      await saveStep(step + 1, {});
    }
  }

  async function payJoiningFee() {
    setPayingFee(true);
    try {
      const out = await api<{ joining_fee_status: string }>("/pujari/joining-fee/pay", { method: "POST" });
      toast.success(
        out.joining_fee_status === "paid" ? "Joining fee paid" : "No joining fee is due"
      );
      await load();
    } catch (err: any) {
      toast.error(err.message || "Could not pay joining fee");
    } finally {
      setPayingFee(false);
    }
  }

  async function finalSubmit() {
    if (!(await validateStep(6))) return;
    setSaving(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({ onboarding_step: 6 }),
      });
      await api("/pujari/profile/submit", {
        method: "POST",
        body: JSON.stringify({
          final_submission_consent: true,
          terms_version: "2026-01",
          privacy_version: "2026-01",
        }),
      });
      toast.success("Profile submitted for review");
      await refresh();
      setLocation("/pujari");
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
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

  const quals: string[] = profile.qualifications || [];
  const nameOk =
    Object.keys(
      validatePersonNameParts({
        first_name: String(profile.first_name ?? splitDisplayName(profile.full_name).first_name),
        middle_name: String(profile.middle_name ?? ""),
        last_name: String(profile.last_name ?? splitDisplayName(profile.full_name).last_name),
      }),
    ).length === 0;
  const parsedPhone = parsePhoneParts(profile.mobile_number || user?.phone || "");
  const phoneOk = !validatePhoneNational(parsedPhone.countryCode, parsedPhone.national);
  const dobOk = !!String(profile.date_of_birth || "").trim() && isValidPujariDob(String(profile.date_of_birth));

  const feeStatus = String(profile.joining_fee_status || "not_required");
  const feeAmount = Number(profile.joining_fee_paise || 0);

  return (
    <PujariPortal>
      {feeStatus !== "not_required" && (
        <Card className="max-w-3xl mb-6 border-primary/30 bg-orange-50/60">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Joining fee</p>
              <p className="font-semibold text-lg capitalize">
                {feeStatus.replace(/_/g, " ")}
                {feeAmount > 0 ? ` · ${rupees(feeAmount)}` : ""}
              </p>
              {feeStatus === "pending" && (
                <p className="text-sm text-muted-foreground mt-1">
                  The fee is deducted from your BSeva wallet. Top up your wallet if the balance is short.
                </p>
              )}
            </div>
            {feeStatus === "pending" && (
              <Button size="sm" disabled={payingFee} onClick={() => void payJoiningFee()}>
                {payingFee ? "Paying…" : "Pay joining fee"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="">Complete onboarding</CardTitle>
          <p className="text-sm text-muted-foreground">
            Step {step} of 6 — update details in My Profile and linked pages (no duplicate forms here). Refresh, then
            Save &amp; Continue.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span
                key={n}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  n === step
                    ? Object.keys(fieldErrors).length
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-primary text-white border-primary"
                    : n < step
                      ? "bg-emerald-600/15 text-emerald-700 border-emerald-600/30"
                      : "bg-muted text-muted-foreground border-border"
                }`}
              >
                Step {n}
              </span>
            ))}
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${(step / 6) * 100}%` }} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <section className="space-y-4">
              <h2 className="text-xl">My Profile</h2>
              <ErrorSummary />
              <GateCard
                title="Personal details &amp; Angikara fields"
                description="Photo, name, date of birth, phone, Gotra, Pravara, addresses, qualifications, experience, and signature are saved only in My Profile. Angikara Patram reads from there — it is not required to finish onboarding."
                href="/pujari/profile"
                linkLabel="Open My Profile"
              >
                <ul className="space-y-1">
                  <ChecklistItem ok={!!profile.profile_photo_path} label="Profile photo" />
                  <ChecklistItem ok={nameOk} label="Name (first & last)" />
                  <ChecklistItem ok={dobOk} label="Date of birth" />
                  <ChecklistItem ok={phoneOk} label="Mobile number" />
                  <ChecklistItem ok={!!String(profile.gotra || "").trim()} label="Gotra" />
                  <ChecklistItem ok={!!String(profile.pravara || "").trim()} label="Pravara" />
                </ul>
              </GateCard>
              <Button type="button" size="sm" variant="ghost" onClick={() => void refreshProfile()}>
                Refresh checklist
              </Button>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="text-xl">Service address</h2>
              <ErrorSummary />
              <GateCard
                title="Address &amp; map pin"
                description="Set your service location and map pin on the Address page. This is used for nearby booking offers."
                href="/pujari/address"
                linkLabel="Open Address"
              >
                <ul className="space-y-1">
                  <ChecklistItem ok={!!String(profile.address_line1 || "").trim()} label="Address line" />
                  <ChecklistItem ok={!!String(profile.city || "").trim()} label="City" />
                  <ChecklistItem ok={!!String(profile.pincode || "").trim()} label="Pincode" />
                  <ChecklistItem
                    ok={profile.latitude != null && profile.longitude != null}
                    label="Map location pinned"
                  />
                </ul>
              </GateCard>
              <Button type="button" size="sm" variant="ghost" onClick={() => void refreshProfile()}>
                Refresh checklist
              </Button>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <h2 className="text-xl">Professional details</h2>
              <ErrorSummary />
              <GateCard
                title="Qualifications &amp; experience"
                description="Qualifications, sampradaya, years of experience, and languages are edited in My Profile — not on a separate onboarding form."
                href="/pujari/profile"
                linkLabel="Open My Profile"
              >
                <ul className="space-y-1">
                  <ChecklistItem ok={quals.length > 0} label="At least one qualification" />
                  <ChecklistItem ok={!!profile.qualification_year} label="Qualification year" />
                  <ChecklistItem ok={!!String(profile.sampradaya || "").trim()} label="Sampradaya" />
                </ul>
              </GateCard>
              <div className="rounded-lg border border-primary/20 bg-orange-50/40 p-4 text-sm space-y-2">
                <p className="font-medium text-foreground">Services &amp; Dakshina</p>
                <p className="text-muted-foreground">
                  After onboarding, open{" "}
                  <Link href="/pujari/services" className="text-primary underline">
                    Services
                  </Link>{" "}
                  to choose catalog pujas (Admin approval required).
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => void refreshProfile()}>
                Refresh checklist
              </Button>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <h2 className="text-xl">Documents</h2>
              <ErrorSummary />
              <PriestOnboardingPanel />
              <p className="text-sm text-muted-foreground">
                Angikara Patram is optional during onboarding. When you are ready, preview and submit it from{" "}
                <Link href="/pujari/angikara" className="text-primary underline">
                  Angikara Patram
                </Link>{" "}
                (data comes from My Profile).
              </p>
            </section>
          )}

          {step === 5 && (
            <section className="space-y-4">
              <h2 className="text-xl">Availability &amp; bank</h2>
              <ErrorSummary />
              <GateCard
                title="Availability"
                description="Turn on availability and set your service radius (km)."
                href="/pujari/availability"
                linkLabel="Open Availability"
              >
                <ul className="space-y-1">
                  <ChecklistItem ok={!!profile.service_radius_km} label="Service radius set" />
                </ul>
              </GateCard>
              <GateCard
                title="Bank account"
                description="Settlement account details are saved on the Bank page."
                href="/pujari/bank"
                linkLabel="Open Bank / Settlement"
              >
                <ul className="space-y-1">
                  <ChecklistItem ok={!!String(profile.bank_holder_name || "").trim()} label="Account holder name" />
                  <ChecklistItem ok={!!String(profile.bank_ifsc || "").trim()} label="IFSC" />
                  <ChecklistItem
                    ok={!!String(profile.bank_account_number || "").replace(/\D/g, "")}
                    label="Account number"
                  />
                </ul>
              </GateCard>
              <Button type="button" size="sm" variant="ghost" onClick={() => void refreshProfile()}>
                Refresh checklist
              </Button>
            </section>
          )}

          {step === 6 && (
            <section className="space-y-4">
              <h2 className="text-xl">Review & submit</h2>
              <ErrorSummary />
              <div className="text-sm space-y-1 border rounded-md p-4 bg-secondary/20">
                <p>
                  <span className="text-muted-foreground">Name:</span> {profile.full_name ||"—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> {profile.mobile_number || user?.phone || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">City:</span> {profile.city ||"—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Experience:</span> {profile.experience_years ??"—"} years
                </p>
                <p>
                  <span className="text-muted-foreground">Sampradaya:</span>{""}
                  {profile.sampradaya ? t(`pujari.${profile.sampradaya}`) : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Completion:</span> {profile.profile_completion_percentage ?? 0}%
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span> {profile.profile_status ||"—"}
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
                  I confirm that the information provided is accurate and I consent to final profile submission for
                  verification under BSeva Terms & Privacy Policy. *
                </span>
              </label>
              <Err name="consent" />
            </section>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button type="button" variant="outline" disabled={step <= 1 || saving} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < 6 ? (
              <Button type="button" disabled={saving} onClick={() => void saveAndContinue()}>
                {saving ? "Saving…" : "Save & Continue"}
              </Button>
            ) : (
              <Button type="button" disabled={saving || !consent} onClick={() => void finalSubmit()}>
                {saving ? "Submitting…" : "Final Submit"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
