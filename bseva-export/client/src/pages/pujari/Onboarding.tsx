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
import { api, pujariMediaUrl, uploadPujariAsset } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

const QUALS = [
  { id: "panchadasha", key: "pujari.q1" },
  { id: "kriya_kovida", key: "pujari.q2" },
  { id: "vidya_visharada", key: "pujari.q3" },
];

const LANG_OPTS = ["Sanskrit", "Hindi", "English", "Telugu", "Kannada", "Tamil", "Marathi"];
const SPEC_OPTS = ["Satyanarayan Puja", "Griha Pravesh", "Wedding", "Havan", "Vastu Shanti", "Namkaran"];

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
    if (step === 1) {
      await saveStep(2, {
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth || null,
        gender: profile.gender || null,
        mobile_number: profile.mobile_number || user?.phone,
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

  async function finalSubmit() {
    if (!consent) {
      toast.error("Please confirm final submission consent");
      return;
    }
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

  return (
    <PujariPortal>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="font-heading">Complete onboarding</CardTitle>
          <p className="text-sm text-muted-foreground">Step {step} of 6</p>
          <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${(step / 6) * 100}%` }} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <section className="space-y-4">
              <h2 className="font-heading text-xl">Personal details</h2>
              <div>
                <Label>{t("pujari.photo")}</Label>
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
                        await load();
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" asChild>
                    <span>{photoUrl ? t("pujari.photo.replace") : t("pujari.photo")}</span>
                  </Button>
                </label>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>{t("pujari.fullName")} *</Label>
                  <Input
                    value={profile.full_name || ""}
                    onChange={(e) => setField("full_name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>{t("pujari.dob")} *</Label>
                  <Input
                    type="date"
                    value={(profile.date_of_birth || "").slice(0, 10)}
                    onChange={(e) => setField("date_of_birth", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={profile.gender || ""}
                    onChange={(e) => setField("gender", e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>{t("pujari.mobile")} *</Label>
                  <Input
                    value={profile.mobile_number || user?.phone || ""}
                    onChange={(e) => setField("mobile_number", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} readOnly disabled />
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="font-heading text-xl">Address</h2>
              <AddressFields
                value={addressValue}
                onChange={(next) => setProfile((prev: any) => ({ ...prev, ...next }))}
              />
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <h2 className="font-heading text-xl">Professional details</h2>
              <div className="max-w-xs">
                <Label>Years of experience</Label>
                <Input
                  type="number"
                  min={0}
                  max={80}
                  value={profile.experience_years ?? ""}
                  onChange={(e) => setField("experience_years", e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <h3 className="font-medium">{t("pujari.qualification")} *</h3>
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
                <div className="max-w-xs">
                  <Label>{t("pujari.year")} *</Label>
                  <Input
                    type="number"
                    min={1950}
                    max={yearNow}
                    value={profile.qualification_year || ""}
                    onChange={(e) => setField("qualification_year", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-medium">{t("pujari.sampradaya")} *</h3>
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
              </div>
              <div className="space-y-2">
                <Label>Languages</Label>
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
                  onChange={(e) => setLangCustom(e.target.value)}
                />
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
              <h2 className="font-heading text-xl">Documents</h2>
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
              <h2 className="font-heading text-xl">Availability & bank</h2>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!profile.available} onCheckedChange={(v) => setField("available", !!v)} />
                Available for new bookings
              </label>
              <div className="max-w-xs">
                <Label>Service radius (km)</Label>
                <Input
                  type="number"
                  min={1}
                  step="0.1"
                  value={profile.service_radius_km ?? ""}
                  onChange={(e) => setField("service_radius_km", e.target.value)}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Account holder name</Label>
                  <Input
                    value={profile.bank_holder_name || ""}
                    onChange={(e) => setField("bank_holder_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>IFSC</Label>
                  <Input value={profile.bank_ifsc || ""} onChange={(e) => setField("bank_ifsc", e.target.value)} />
                </div>
                <div>
                  <Label>Account number (last 4)</Label>
                  <Input
                    maxLength={4}
                    value={profile.bank_account_last4 || ""}
                    onChange={(e) => setField("bank_account_last4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
              </div>
            </section>
          )}

          {step === 6 && (
            <section className="space-y-4">
              <h2 className="font-heading text-xl">Review & submit</h2>
              <div className="text-sm space-y-1 border rounded-md p-4 bg-secondary/20">
                <p>
                  <span className="text-muted-foreground">Name:</span> {profile.full_name || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> {profile.mobile_number || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">City:</span> {profile.city || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Experience:</span> {profile.experience_years ?? "—"} years
                </p>
                <p>
                  <span className="text-muted-foreground">Sampradaya:</span>{" "}
                  {profile.sampradaya ? t(`pujari.${profile.sampradaya}`) : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Completion:</span> {profile.profile_completion_percentage ?? 0}%
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span> {profile.profile_status || "—"}
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
                <span>
                  I confirm that the information provided is accurate and I consent to final profile submission for
                  verification under BSeva Terms & Privacy Policy.
                </span>
              </label>
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
