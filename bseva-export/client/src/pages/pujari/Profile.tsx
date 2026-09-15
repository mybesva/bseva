import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import SignaturePad from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { api, pujariMediaUrl, uploadPujariAsset } from "@/lib/api";
import { parsePhoneParts, toE164, validatePhoneNational } from "@/lib/phone";
import PhoneWithCountryCode from "@/components/PhoneWithCountryCode";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import PersonNameFields from "@/components/PersonNameFields";
import { isValidPujariDob } from "@/lib/fieldValidation";
import { splitDisplayName, validatePersonNameParts, type PersonNameParts } from "@/lib/personName";

const QUALS = [
  { id: "panchadasha", key: "pujari.q1" },
  { id: "kriya_kovida", key: "pujari.q2" },
  { id: "vidya_visharada", key: "pujari.q3" },
];

const LANG_OPTS = ["Sanskrit", "Hindi", "English", "Telugu", "Kannada", "Tamil", "Marathi"];

function ProfileForm({ setupBanner }: { setupBanner?: boolean }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [sameAddr, setSameAddr] = useState(false);
  const [sameWa, setSameWa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNational, setPhoneNational] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    const p = await api<any>("/pujari/profile");
    const parsed = parsePhoneParts(p.mobile_number || "");
    setCountryCode(parsed.countryCode);
    setPhoneNational(parsed.national);
    setProfile({ ...p, mobile_number: parsed.national || p.mobile_number });
    setSameAddr(!!p.permanent_address && p.permanent_address === p.present_address);
    setSameWa(!!p.mobile_number && p.mobile_number === p.whatsapp_number);
    if (p.profile_photo_path) setPhotoUrl(await pujariMediaUrl("photo"));
    else setPhotoUrl(null);
    if (p.signature_path) setSignUrl(await pujariMediaUrl("signature"));
    else setSignUrl(null);
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

  function collectNameParts(): PersonNameParts {
    return {
      first_name: String(profile.first_name ?? splitDisplayName(profile.full_name).first_name),
      middle_name: String(profile.middle_name ?? splitDisplayName(profile.full_name).middle_name),
      last_name: String(profile.last_name ?? splitDisplayName(profile.full_name).last_name),
    };
  }

  function validateForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!profile?.profile_photo_path && !photoUrl) {
      errors.profile_photo_path = "Profile photo is required";
    }
    Object.assign(errors, validatePersonNameParts(collectNameParts(), { minLastLength: 3 }));
    const dob = String(profile.date_of_birth || "").trim();
    if (!dob) errors.date_of_birth = "Date of birth is required";
    else if (!isValidPujariDob(dob)) {
      errors.date_of_birth = "You must be at least 18 years old (date cannot be in the future)";
    }
    const phoneErr = validatePhoneNational(countryCode, phoneNational);
    if (phoneErr) errors.mobile_number = phoneErr;
    if (!String(profile.gotra || "").trim()) errors.gotra = "Gotra is required";
    if (!String(profile.pravara || "").trim()) errors.pravara = "Pravara is required";
    const quals: string[] = profile.qualifications || [];
    if (quals.length === 0) errors.qualifications = "Select at least one qualification";
    if (!profile.qualification_year) errors.qualification_year = "Qualification year is required";
    if (!String(profile.sampradaya || "").trim()) errors.sampradaya = "Sampradaya is required";
    return errors;
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!profile) return;
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error("Please fill the required fields marked in red");
      return;
    }
    setSaving(true);
    try {
      const mobile = toE164(countryCode, phoneNational);
      const present = sameAddr ? profile.permanent_address : profile.present_address;
      const wa = sameWa ? mobile : profile.whatsapp_number;
      const nameParts: PersonNameParts = {
        first_name: String(profile.first_name ?? "").trim() || splitDisplayName(profile.full_name).first_name,
        middle_name: String(profile.middle_name ?? "").trim(),
        last_name: String(profile.last_name ?? "").trim() || splitDisplayName(profile.full_name).last_name,
      };
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: nameParts.first_name.trim(),
          middle_name: nameParts.middle_name.trim() || null,
          last_name: nameParts.last_name.trim(),
          father_name: profile.father_name,
          gotra: String(profile.gotra || "").trim(),
          pravara: String(profile.pravara || "").trim(),
          date_of_birth: profile.date_of_birth || null,
          native_place: profile.native_place,
          permanent_address: profile.permanent_address,
          present_address: present,
          mobile_number: mobile,
          whatsapp_number: wa,
          experience_years: profile.experience_years ? Number(profile.experience_years) : null,
          qualifications: profile.qualifications || [],
          qualification_year: profile.qualification_year ? Number(profile.qualification_year) : null,
          sampradaya: profile.sampradaya || null,
          languages: profile.languages || [],
          website_publication_consent: !!profile.website_publication_consent,
        }),
      });
      setFieldErrors({});
      toast.success(t("common.save"));
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  const pct = Number(profile.profile_completion_percentage || 0);
  const quals: string[] = profile.qualifications || [];
  const langs: string[] = profile.languages || [];
  const yearNow = new Date().getFullYear();

  function toggleLanguage(item: string, on: boolean) {
    setField(
      "languages",
      on ? Array.from(new Set([...langs, item])) : langs.filter((x) => x !== item),
    );
  }
  const isVerified =
    profile.profile_status === "verified" ||
    (profile.verification_status === "approved" && (!!profile.profile_submitted_at || pct >= 100));

  return (
    <form className="space-y-8" onSubmit={save} noValidate>
      {setupBanner ? (
        <div className="rounded-md border border-primary/30 bg-orange-50/60 px-3 py-3 text-sm space-y-2">
          <p className="font-medium text-foreground">Welcome — complete your profile once here</p>
          <p className="text-muted-foreground">
            Add photo, date of birth, Gotra, Pravara, qualifications, and the rest below, then tap Save. After that,
            open <strong>Complete Profile</strong> in the menu to finish onboarding steps (address, documents, bank).
          </p>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/pujari/onboarding">Go to Complete Profile</Link>
          </Button>
        </div>
      ) : null}
      <ErrorSummary />
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>{t("pujari.profile.completion")}</span>
          <span className={pct < 100 ? "font-semibold text-primary" : "font-semibold text-emerald-600"}>
            {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-sm mt-2 ${isVerified || pct >= 100 ? "text-muted-foreground" : "font-medium text-primary"}`}>
          {isVerified || pct >= 100 ? t("pujari.profile.done") : t("pujari.profile.prompt")}
        </p>
        {!isVerified && pct < 100 && (
          <p className="text-xs text-muted-foreground mt-1">
            Status: <span className="font-semibold text-orange-600">Not verified</span> until profile is 100% and submitted.
          </p>
        )}
        {isVerified && (
          <p className="text-xs text-muted-foreground mt-1">
            Status: <span className="font-semibold text-emerald-600">Verified</span>
          </p>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-xl">{t("pujari.personal")}</h2>
        <div>
          <Label className={fieldErrors.profile_photo_path ? "text-red-600" : undefined}>{t("pujari.photo")}</Label>
          {photoUrl && <img src={photoUrl} alt="" className="mt-2 h-28 w-28 object-cover rounded-md border" />}
          <div className="flex gap-2 mt-2">
            <label className="text-sm">
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
            {photoUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api("/pujari/profile/photo", { method: "DELETE" });
                  await load();
                }}
              >
                {t("pujari.photo.remove")}
              </Button>
            )}
          </div>
          {fieldErrors.profile_photo_path ? (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.profile_photo_path}</p>
          ) : null}
        </div>
        <PersonNameFields
          lastNameMinLength={3}
          value={{
            first_name: profile.first_name ?? splitDisplayName(profile.full_name).first_name,
            middle_name: profile.middle_name ?? splitDisplayName(profile.full_name).middle_name,
            last_name: profile.last_name ?? splitDisplayName(profile.full_name).last_name,
          }}
          onChange={(next) => {
            setProfile((prev: any) => ({
              ...prev,
              first_name: next.first_name,
              middle_name: next.middle_name,
              last_name: next.last_name,
              full_name: [next.first_name, next.middle_name, next.last_name].filter(Boolean).join(" "),
            }));
            setFieldErrors((e) => {
              const copy = { ...e };
              delete copy.first_name;
              delete copy.last_name;
              return copy;
            });
          }}
          errors={{
            first_name: fieldErrors.first_name,
            last_name: fieldErrors.last_name,
          }}
        />
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>{t("pujari.fatherName")}</Label>
            <Input value={profile.father_name || ""} onChange={(e) => setField("father_name", e.target.value)} />
          </div>
          <div>
            <Label className={fieldErrors.date_of_birth ? "text-red-600" : undefined}>{t("pujari.dob")} *</Label>
            <Input
              type="date"
              className={errClass("date_of_birth")}
              value={(profile.date_of_birth || "").slice(0, 10)}
              onChange={(e) => setField("date_of_birth", e.target.value)}
            />
            {fieldErrors.date_of_birth ? (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.date_of_birth}</p>
            ) : null}
          </div>
          <PhoneWithCountryCode
            id="pujari-mobile"
            label={t("pujari.mobile")}
            required
            countryCode={countryCode}
            national={phoneNational}
            error={fieldErrors.mobile_number}
            onCountryCodeChange={(code) => {
              setCountryCode(code);
              setPhoneNational((prev) => prev.slice(0, code === "+91" ? 10 : 12));
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.mobile_number;
                return next;
              });
            }}
            onNationalChange={(digits) => {
              setPhoneNational(digits);
              setField("mobile_number", digits);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.mobile_number;
                return next;
              });
            }}
          />
        </div>

        <div className="rounded-lg border-2 border-primary/30 bg-orange-50/50 p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground">Gotra &amp; Pravara *</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter your family Gotra and Pravara (rishi lineage). Both are required for verification.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pujari-gotra" className={fieldErrors.gotra ? "text-red-600" : undefined}>
                {t("pujari.gotra")} *
              </Label>
              <Input
                id="pujari-gotra"
                className={fieldErrors.gotra ? "border-red-500" : ""}
                value={profile.gotra || ""}
                onChange={(e) => {
                  setField("gotra", e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.gotra;
                    return next;
                  });
                }}
                placeholder="e.g. Bharadwaja"
                required
              />
              {fieldErrors.gotra ? <p className="text-xs text-red-600 mt-1">{fieldErrors.gotra}</p> : null}
            </div>
            <div>
              <Label htmlFor="pujari-pravara" className={fieldErrors.pravara ? "text-red-600" : undefined}>
                {t("pujari.pravara")} *
              </Label>
              <Input
                id="pujari-pravara"
                className={fieldErrors.pravara ? "border-red-500" : ""}
                value={profile.pravara ?? ""}
                onChange={(e) => {
                  setField("pravara", e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.pravara;
                    return next;
                  });
                }}
                placeholder="e.g. Angirasa, Barhaspatya, Bharadwaja"
                required
              />
              {fieldErrors.pravara ? <p className="text-xs text-red-600 mt-1">{fieldErrors.pravara}</p> : null}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>{t("pujari.native")}</Label>
            <Input value={profile.native_place || ""} onChange={(e) => setField("native_place", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>{t("pujari.permanent")}</Label>
            <Textarea value={profile.permanent_address || ""} onChange={(e) => setField("permanent_address", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm mb-2">
              <Checkbox checked={sameAddr} onCheckedChange={(v) => setSameAddr(!!v)} />
              {t("pujari.samePermanent")}
            </label>
            <Label>{t("pujari.present")}</Label>
            <Textarea
              value={sameAddr ? profile.permanent_address || "" : profile.present_address || ""}
              onChange={(e) => setField("present_address", e.target.value)}
              disabled={sameAddr}
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm mb-2">
              <Checkbox checked={sameWa} onCheckedChange={(v) => setSameWa(!!v)} />
              {t("pujari.sameMobile")}
            </label>
            <Label>{t("pujari.whatsapp")}</Label>
            <Input
              value={sameWa ? phoneNational || "" : profile.whatsapp_number || ""}
              onChange={(e) => setField("whatsapp_number", e.target.value)}
              disabled={sameWa}
            />
          </div>
        </div>
      </section>

      <section
        className={`space-y-3 rounded-md p-2 ${fieldErrors.qualifications ? "border border-red-500" : ""}`}
      >
        <h2 className={`text-xl ${fieldErrors.qualifications ? "text-red-600" : ""}`}>
          {t("pujari.qualification")} *
        </h2>
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
        {fieldErrors.qualifications ? (
          <p className="text-xs text-red-600">{fieldErrors.qualifications}</p>
        ) : null}
        <div className="max-w-xs">
          <Label className={fieldErrors.qualification_year ? "text-red-600" : undefined}>
            {t("pujari.year")} *
          </Label>
          <Input
            type="number"
            min={1950}
            max={yearNow}
            className={errClass("qualification_year")}
            value={profile.qualification_year || ""}
            onChange={(e) => setField("qualification_year", e.target.value)}
          />
          {fieldErrors.qualification_year ? (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.qualification_year}</p>
          ) : null}
        </div>
      </section>

      <section
        className={`space-y-3 rounded-md p-2 ${fieldErrors.sampradaya ? "border border-red-500" : ""}`}
      >
        <h2 className={`text-xl ${fieldErrors.sampradaya ? "text-red-600" : ""}`}>{t("pujari.sampradaya")} *</h2>
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
        {fieldErrors.sampradaya ? <p className="text-xs text-red-600">{fieldErrors.sampradaya}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Experience &amp; languages</h2>
        <p className="text-sm text-muted-foreground">
          Years of experience and languages are saved here only — not on a separate page.
        </p>
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
        <div className="space-y-2">
          <Label>Languages</Label>
          <div className="flex flex-wrap gap-3">
            {LANG_OPTS.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <Checkbox checked={langs.includes(l)} onCheckedChange={(v) => toggleLanguage(l, !!v)} />
                {l}
              </label>
            ))}
          </div>
        </div>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={!!profile.website_publication_consent}
          onCheckedChange={(v) => setField("website_publication_consent", !!v)}
        />
        <span>{t("pujari.consent")}</span>
      </label>

      <section>
        <h2 className="text-xl mb-2">{t("pujari.signature")}</h2>
        <SignaturePad
          existingUrl={signUrl}
          onSave={async (file) => {
            try {
              await uploadPujariAsset("signature", file);
              toast.success("Signature saved");
              await load();
            } catch (err: any) {
              toast.error(err.message);
            }
          }}
        />
      </section>

      <Button type="submit" disabled={saving}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export default function PujariProfilePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const search = useSearch();
  const fromRegister =
    (search.startsWith("?") ? search.slice(1) : search).includes("from=register");
  return (
    <PujariPortal>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="">{t("pujari.profile.title")}</CardTitle>
          {user?.public_id ? (
            <p className="text-sm text-muted-foreground font-mono">ID: {user.public_id}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          <ProfileForm setupBanner={fromRegister} />
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
