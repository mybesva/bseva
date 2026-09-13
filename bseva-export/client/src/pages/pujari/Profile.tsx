import { useEffect, useState } from "react";
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
import { Link } from "wouter";

const QUALS = [
  { id: "panchadasha", key: "pujari.q1" },
  { id: "kriya_kovida", key: "pujari.q2" },
  { id: "vidya_visharada", key: "pujari.q3" },
];

function ProfileForm() {
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
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!profile) return;
    const errors: Record<string, string> = {};
    const phoneErr = validatePhoneNational(countryCode, phoneNational);
    if (phoneErr) errors.mobile_number = phoneErr;
    if (!String(profile.gotra || "").trim()) errors.gotra = "Gotra is required";
    if (!String(profile.pravara || "").trim()) errors.pravara = "Pravara is required";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    try {
      const mobile = toE164(countryCode, phoneNational);
      const present = sameAddr ? profile.permanent_address : profile.present_address;
      const wa = sameWa ? mobile : profile.whatsapp_number;
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: profile.full_name,
          father_name: profile.father_name,
          gotra: String(profile.gotra || "").trim(),
          pravara: String(profile.pravara || "").trim(),
          date_of_birth: profile.date_of_birth || null,
          native_place: profile.native_place,
          permanent_address: profile.permanent_address,
          present_address: present,
          mobile_number: mobile,
          whatsapp_number: wa,
          qualifications: profile.qualifications || [],
          qualification_year: profile.qualification_year ? Number(profile.qualification_year) : null,
          sampradaya: profile.sampradaya || null,
          website_publication_consent: !!profile.website_publication_consent,
        }),
      });
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
  const yearNow = new Date().getFullYear();
  const isVerified =
    profile.profile_status === "verified" ||
    (profile.verification_status === "approved" && (!!profile.profile_submitted_at || pct >= 100));

  return (
    <form className="space-y-8" onSubmit={save}>
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
          <Label>{t("pujari.photo")}</Label>
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
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>{t("pujari.fullName")} *</Label>
            <Input value={profile.full_name || ""} onChange={(e) => setField("full_name", e.target.value)} required />
          </div>
          <div>
            <Label>{t("pujari.fatherName")}</Label>
            <Input value={profile.father_name || ""} onChange={(e) => setField("father_name", e.target.value)} />
          </div>
          <div>
            <Label>{t("pujari.dob")} *</Label>
            <Input type="date" value={(profile.date_of_birth || "").slice(0, 10)} onChange={(e) => setField("date_of_birth", e.target.value)} />
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
              Enter your family Gotra and Pravara (rishi lineage). Both are required and appear on Angikara Patram.
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

      <section className="space-y-3">
        <h2 className="text-xl">{t("pujari.qualification")} *</h2>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">{t("pujari.sampradaya")} *</h2>
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

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {t("common.save")}
        </Button>
        <Link href="/pujari/angikara">
          <Button type="button" variant="outline">
            {t("pujari.menu.angikara")}
          </Button>
        </Link>
      </div>
    </form>
  );
}

export default function PujariProfilePage() {
  const { t } = useI18n();
  const { user } = useAuth();
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
          <ProfileForm />
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
