import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import AddressFields, { type AddressValue } from "@/components/AddressFields";
import PujariLevelApply from "@/components/PujariLevelApply";
import PriestOnboardingPanel from "@/components/PriestOnboardingPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, pujariMediaUrl, rupees, uploadPujariAsset } from "@/lib/api";
import { isValidMobile, isValidPujariDob, validateAddress, validateBank } from "@/lib/fieldValidation";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

import { PUJARI_SPECIALIZATIONS } from "@/lib/pujariSpecializations";

const QUALS = [
  { id: "panchadasha", key: "pujari.q1" },
  { id: "kriya_kovida", key: "pujari.q2" },
  { id: "vidya_visharada", key: "pujari.q3" },
];

const LANG_OPTS = ["Sanskrit", "Hindi", "English", "Telugu", "Kannada", "Tamil", "Marathi"];
const SPEC_OPTS = [...PUJARI_SPECIALIZATIONS];

function csvToList(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function PujariOnboardingPage() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [langCustom, setLangCustom] = useState("");
  const [specCustom, setSpecCustom] = useState("");
  const [payingFee, setPayingFee] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    const p = await api<any>("/pujari/profile");
    if (p.profile_submitted_at) {
      setLocation("/pujari");
      return;
    }
    setProfile(p);
    const s = Number(p.onboarding_step || 1);
    setStep(Math.min(6, Math.max(1, s)));
    setConsent(!!p.final_submission_consent);
    if (p.profile_photo_path) setPhotoUrl(await pujariMediaUrl("photo"));
    else setPhotoUrl(null);
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  function setField(key: string, value: unknown) {
    setProfile((prev: any) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function errClass(key: string) {
    return fieldErrors[key] ? "border-red-500 focus-visible:ring-red-500" : "";
  }

  function Err({ name }: { name: string }) {
    if (!fieldErrors[name]) return null;
    return <p className="text-xs text-red-600 mt-1">{fieldErrors[name]}</p>;
  }

  async function validateStep(current: number): Promise<boolean> {
    if (!profile) return false;
    const errors: Record<string, string> = {};
    const req = (key: string, label: string, ok: boolean) => {
      if (!ok) errors[key] = `${label} is required`;
    };

    if (current === 1) {
      req("profile_photo_path", "Profile photo", !!profile.profile_photo_path || !!photoUrl);
      req("full_name", "Full name", !!String(profile.full_name || "").trim());
      const dob = String(profile.date_of_birth || "").trim();
      req("date_of_birth", "Date of birth", !!dob);
      if (dob && !isValidPujariDob(dob)) {
        errors.date_of_birth = "Pujari must be at least 18 years old";
      }
      const mobile = String(profile.mobile_number || user?.phone || "").trim();
      req("mobile_number", "Mobile number", !!mobile);
      if (mobile && !isValidMobile(mobile)) {
        errors.mobile_number = "Enter a valid 10-digit Indian mobile number";
      }
    }
    if (current === 2) {
      const addrErrs = validateAddress({
        address_line1: profile.address_line1,
        city: profile.city,
        district: profile.district,
        state: profile.state,
        pincode: profile.pincode,
      });
      Object.assign(errors, addrErrs);
      req("latitude", "Map location", profile.latitude != null && profile.longitude != null);
    }
    if (current === 3) {
      const quals: string[] = profile.qualifications || [];
      req("qualifications", "At least one qualification", quals.length > 0);
      req("qualification_year", "Qualification year", !!profile.qualification_year);
      req("sampradaya", "Sampradaya", !!String(profile.sampradaya || "").trim());
      req("experience_years", "Experience (years)", profile.experience_years != null && profile.experience_years !== "");
      const langs = [...(profile.languages || []), ...csvToList(langCustom)];
      req("languages", "At least one language", langs.length > 0);
    }
    if (current === 4) {
      try {
        const docs = await api<any[]>("/pujari/documents");
        const hasAadhaar = docs.some((d) => d.document_type === "identity");
        req("identity", "Aadhaar upload", hasAadhaar);
      } catch {
        errors.identity = "Could not verify documents — upload Aadhaar and try again";
      }
    }
    if (current === 5) {
      req("service_radius_km", "Service radius", !!profile.service_radius_km);
      const bankErrs = validateBank({
        holder: profile.bank_holder_name,
        ifsc: profile.bank_ifsc,
        last4: profile.bank_account_last4,
      });
      if (bankErrs.holder) errors.bank_holder_name = bankErrs.holder;
      if (bankErrs.ifsc) errors.bank_ifsc = bankErrs.ifsc;
      if (bankErrs.last4) errors.bank_account_last4 = bankErrs.last4;
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

  function toggleList(key: "languages" | "specializations", item: string, on: boolean) {
    const cur: string[] = profile?.[key] || [];
    setField(key, on ? Array.from(new Set([...cur, item])) : cur.filter((x) => x !== item));
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
    if (step === 1) {
      await saveStep(2, {
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth || null,
        mobile_number: profile.mobile_number || user?.phone,
        gotra: profile.gotra || null,
        pravara: profile.pravara || null,
      });
      return;
    }
    if (step === 2) {
      await saveStep(3, {
        address_line1: profile.address_line1,
        address_line2: profile.address_line2,
        city: profile.city,
        district: profile.district,
        state: profile.state,
        pincode: profile.pincode,
        country: profile.country || "India",
        location_label: profile.location_label,
        latitude: profile.latitude,
        longitude: profile.longitude,
        present_address: [
          profile.address_line1,
          profile.address_line2,
          profile.city,
          profile.district,
          profile.state,
          profile.pincode,
        ]
          .filter(Boolean)
          .join(", "),
      });
      return;
    }
    if (step === 3) {
      const langs = [...(profile.languages || []), ...csvToList(langCustom)];
      const specs = [...(profile.specializations || []), ...csvToList(specCustom)];
      await saveStep(4, {
        experience_years: profile.experience_years ? Number(profile.experience_years) : null,
        qualifications: profile.qualifications || [],
        qualification_year: profile.qualification_year ? Number(profile.qualification_year) : null,
        sampradaya: profile.sampradaya || null,
        languages: Array.from(new Set(langs)),
        specializations: Array.from(new Set(specs)),
      });
      return;
    }
    if (step === 4) {
      await saveStep(5, {});
      return;
    }
    if (step === 5) {
      await saveStep(6, {
        available: !!profile.available,
        service_radius_km: profile.service_radius_km ? Number(profile.service_radius_km) : null,
        bank_account_last4: profile.bank_account_last4 || null,
        bank_ifsc: profile.bank_ifsc || null,
        bank_holder_name: profile.bank_holder_name || null,
      });
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
  const langs: string[] = profile.languages || [];
  const specs: string[] = profile.specializations || [];
  const yearNow = new Date().getFullYear();
  const addressValue: AddressValue = {
    address_line1: profile.address_line1 || "",
    address_line2: profile.address_line2 || "",
    city: profile.city || "",
    district: profile.district || "",
    state: profile.state || "",
    pincode: profile.pincode || "",
    country: profile.country || "India",
    location_label: profile.location_label || "",
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
  };

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
          <p className="text-sm text-muted-foreground">Step {step} of 6 — fill required fields before Save & Continue</p>
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
              <h2 className="text-xl">Personal details</h2>
              <div>
                <Label className={fieldErrors.profile_photo_path ? "text-red-600" : undefined}>
                  {t("pujari.photo")}
                </Label>
                {photoUrl && <img src={photoUrl} alt="" className="mt-2 h-28 w-28 object-cover rounded-md border" />}
                <label className="inline-block mt-2">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        await uploadPujariAsset("photo", f);
                        toast.success("Photo saved");
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.profile_photo_path;
                          return next;
                        });
                        await load();
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    className={fieldErrors.profile_photo_path ? "border-red-500 text-red-600" : undefined}
                  >
                    <span>{photoUrl ? t("pujari.photo.replace") : t("pujari.photo")}</span>
                  </Button>
                </label>
                <Err name="profile_photo_path" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className={fieldErrors.full_name ? "text-red-600" : undefined}>{t("pujari.fullName")} *</Label>
                  <Input
                    className={errClass("full_name")}
                    value={profile.full_name || ""}
                    onChange={(e) => setField("full_name", e.target.value)}
                    required
                  />
                  <Err name="full_name" />
                </div>
                <div>
                  <Label className={fieldErrors.date_of_birth ? "text-red-600" : undefined}>{t("pujari.dob")} *</Label>
                  <Input
                    className={errClass("date_of_birth")}
                    type="date"
                    value={(profile.date_of_birth || "").slice(0, 10)}
                    onChange={(e) => setField("date_of_birth", e.target.value)}
                  />
                  <Err name="date_of_birth" />
                </div>
                <div>
                  <Label className={fieldErrors.mobile_number ? "text-red-600" : undefined}>{t("pujari.mobile")} *</Label>
                  <Input
                    className={errClass("mobile_number")}
                    value={profile.mobile_number || user?.phone || ""}
                    onChange={(e) => setField("mobile_number", e.target.value)}
                  />
                  <Err name="mobile_number" />
                </div>
                <div className="md:col-span-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} readOnly disabled />
                </div>
              </div>

              <div className="rounded-lg border-2 border-primary/30 bg-orange-50/50 p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground">Gotra &amp; Pravara</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enter your family Gotra and Pravara (rishi lineage).
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="onboarding-gotra">{t("pujari.gotra")}</Label>
                    <Input
                      id="onboarding-gotra"
                      value={profile.gotra || ""}
                      onChange={(e) => setField("gotra", e.target.value)}
                      placeholder="e.g. Bharadwaja"
                    />
                  </div>
                  <div>
                    <Label htmlFor="onboarding-pravara">{t("pujari.pravara")}</Label>
                    <Input
                      id="onboarding-pravara"
                      value={profile.pravara ?? ""}
                      onChange={(e) => setField("pravara", e.target.value)}
                      placeholder="e.g. Angirasa, Barhaspatya, Bharadwaja"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="text-xl">Address</h2>
              {Object.keys(fieldErrors).length > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2 space-y-0.5">
                  {Object.values(fieldErrors).map((msg) => (
                    <p key={msg}>{msg}</p>
                  ))}
                </div>
              )}
              <AddressFields
                value={addressValue}
                onChange={(next) => {
                  setProfile((prev: any) => ({ ...prev, ...next }));
                  setFieldErrors((prev) => {
                    const nextErr = { ...prev };
                    for (const k of Object.keys(next)) delete nextErr[k];
                    if (next.latitude != null) delete nextErr.latitude;
                    return nextErr;
                  });
                }}
              />
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <h2 className="text-xl">Professional details</h2>
              {Object.keys(fieldErrors).length > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2 space-y-0.5">
                  {Object.values(fieldErrors).map((msg) => (
                    <p key={msg}>{msg}</p>
                  ))}
                </div>
              )}
              <div className="max-w-xs">
                <Label className={fieldErrors.experience_years ? "text-red-600" : undefined}>
                  Years of experience *
                </Label>
                <Input
                  className={errClass("experience_years")}
                  type="number"
                  min={0}
                  max={80}
                  value={profile.experience_years ?? ""}
                  onChange={(e) => setField("experience_years", e.target.value)}
                />
                <Err name="experience_years" />
              </div>
              <div className={`space-y-3 rounded-md p-2 ${fieldErrors.qualifications ? "border border-red-500" : ""}`}>
                <h3 className={`font-medium ${fieldErrors.qualifications ? "text-red-600" : ""}`}>
                  {t("pujari.qualification")} *
                </h3>
                {QUALS.map((q) => (
                  <label key={q.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={quals.includes(q.id)}
                      onCheckedChange={(v) => {
                        const next = v ? [...quals, q.id] : quals.filter((x) => x !== q.id);
                        setField("qualifications", next);
                      }}
                    />
                    {t(q.key)}
                  </label>
                ))}
                <Err name="qualifications" />
                <div className="max-w-xs">
                  <Label className={fieldErrors.qualification_year ? "text-red-600" : undefined}>
                    {t("pujari.year")} *
                  </Label>
                  <Input
                    className={errClass("qualification_year")}
                    type="number"
                    min={1950}
                    max={yearNow}
                    value={profile.qualification_year || ""}
                    onChange={(e) => setField("qualification_year", e.target.value)}
                  />
                  <Err name="qualification_year" />
                </div>
              </div>
              <div className={`space-y-3 rounded-md p-2 ${fieldErrors.sampradaya ? "border border-red-500" : ""}`}>
                <h3 className={`font-medium ${fieldErrors.sampradaya ? "text-red-600" : ""}`}>
                  {t("pujari.sampradaya")} *
                </h3>
                {(["smartha", "madhwa", "vaishnava"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="sampradaya"
                      checked={profile.sampradaya === s}
                      onChange={() => setField("sampradaya", s)}
                    />
                    {t(`pujari.${s}`)}
                  </label>
                ))}
                <Err name="sampradaya" />
              </div>
              <div className={`space-y-2 rounded-md p-2 ${fieldErrors.languages ? "border border-red-500" : ""}`}>
                <Label className={fieldErrors.languages ? "text-red-600" : undefined}>Languages *</Label>
                <div className="flex flex-wrap gap-3">
                  {LANG_OPTS.map((l) => (
                    <label key={l} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={langs.includes(l)} onCheckedChange={(v) => toggleList("languages", l, !!v)} />
                      {l}
                    </label>
                  ))}
                </div>
                <Input
                  placeholder="Other languages (comma-separated)"
                  value={langCustom}
                  onChange={(e) => {
                    setLangCustom(e.target.value);
                    setFieldErrors((prev) => {
                      if (!prev.languages) return prev;
                      const next = { ...prev };
                      delete next.languages;
                      return next;
                    });
                  }}
                />
                <Err name="languages" />
              </div>
              <div className="space-y-2">
                <Label>Specializations</Label>
                <div className="flex flex-wrap gap-3">
                  {SPEC_OPTS.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={specs.includes(s)}
                        onCheckedChange={(v) => toggleList("specializations", s, !!v)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
                <Input
                  placeholder="Other specializations (comma-separated)"
                  value={specCustom}
                  onChange={(e) => setSpecCustom(e.target.value)}
                />
              </div>
              <PujariLevelApply
                approvedLevel={profile.approved_level}
                requestedLevel={profile.requested_level}
                onUpdated={setProfile}
              />
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <h2 className="text-xl">Documents</h2>
              {fieldErrors.identity && (
                <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">
                  {fieldErrors.identity}
                </div>
              )}
              <PriestOnboardingPanel />
              <p className="text-sm">
                After uploading documents, complete{" "}
                <Link href="/pujari/angikara" className="text-primary underline">
                  Angikara Patram
                </Link>
                .
              </p>
            </section>
          )}

          {step === 5 && (
            <section className="space-y-4">
              <h2 className="text-xl">Availability & bank</h2>
              {Object.keys(fieldErrors).length > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2 space-y-0.5">
                  {Object.values(fieldErrors).map((msg) => (
                    <p key={msg}>{msg}</p>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!profile.available} onCheckedChange={(v) => setField("available", !!v)} />
                Available for new bookings
              </label>
              <div className="max-w-xs">
                <Label className={fieldErrors.service_radius_km ? "text-red-600" : undefined}>
                  Service radius (km) *
                </Label>
                <Input
                  className={errClass("service_radius_km")}
                  type="number"
                  min={1}
                  step="0.1"
                  value={profile.service_radius_km ?? ""}
                  onChange={(e) => setField("service_radius_km", e.target.value)}
                />
                <Err name="service_radius_km" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className={fieldErrors.bank_holder_name ? "text-red-600" : undefined}>
                    Account holder name *
                  </Label>
                  <Input
                    className={errClass("bank_holder_name")}
                    value={profile.bank_holder_name || ""}
                    onChange={(e) => setField("bank_holder_name", e.target.value)}
                  />
                  <Err name="bank_holder_name" />
                </div>
                <div>
                  <Label className={fieldErrors.bank_ifsc ? "text-red-600" : undefined}>IFSC *</Label>
                  <Input
                    className={errClass("bank_ifsc")}
                    value={profile.bank_ifsc || ""}
                    onChange={(e) => setField("bank_ifsc", e.target.value)}
                  />
                  <Err name="bank_ifsc" />
                </div>
                <div>
                  <Label className={fieldErrors.bank_account_last4 ? "text-red-600" : undefined}>
                    Account number (last 4) *
                  </Label>
                  <Input
                    className={errClass("bank_account_last4")}
                    maxLength={4}
                    value={profile.bank_account_last4 || ""}
                    onChange={(e) => setField("bank_account_last4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <Err name="bank_account_last4" />
                </div>
              </div>
            </section>
          )}

          {step === 6 && (
            <section className="space-y-4">
              <h2 className="text-xl">Review & submit</h2>
              <div className="text-sm space-y-1 border rounded-md p-4 bg-secondary/20">
                <p>
                  <span className="text-muted-foreground">Name:</span> {profile.full_name ||"—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> {profile.mobile_number ||"—"}
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
