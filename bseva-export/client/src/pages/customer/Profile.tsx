import { useEffect, useRef, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import PhoneWithCountryCode from "@/components/PhoneWithCountryCode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, apiBase, getToken } from "@/lib/api";
import { parsePhoneParts, toE164, validatePhoneNational } from "@/lib/phone";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { PREFERRED_LANGUAGES, uiLangFromPreferred, type PreferredLang } from "@/lib/languages";
import { toast } from "sonner";
import PersonNameFields from "@/components/PersonNameFields";
import {
  splitDisplayName,
  validatePersonNameParts,
  type PersonNameParts,
} from "@/lib/personName";

const LANGS: PreferredLang[] = PREFERRED_LANGUAGES.map((l) => l.code);

export default function CustomerProfilePage() {
  const { user, refresh } = useAuth();
  const { setLang, t } = useI18n();
  const [nameParts, setNameParts] = useState<PersonNameParts>({
    first_name: "",
    middle_name: "",
    last_name: "",
  });
  const [nameErrors, setNameErrors] = useState<Partial<Record<keyof PersonNameParts, string>>>({});
  const [language, setLanguage] = useState<PreferredLang>("en");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNational, setPhoneNational] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const nameFormDirty = useRef(false);
  const syncedUserId = useRef<string | null>(null);

  function namePartsFromUser(u: typeof user): PersonNameParts {
    if (!u) return { first_name: "", middle_name: "", last_name: "" };
    const hasStructured =
      u.first_name != null || u.middle_name != null || u.last_name != null;
    if (hasStructured) {
      return {
        first_name: String(u.first_name ?? ""),
        middle_name: String(u.middle_name ?? ""),
        last_name: String(u.last_name ?? ""),
      };
    }
    return splitDisplayName(u.name);
  }

  async function loadPhoto() {
    const token = getToken();
    if (!token) {
      setPhotoUrl(null);
      return;
    }
    const res = await fetch(`${apiBase()}/api/v1/customer/profile/photo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setPhotoUrl(null);
      return;
    }
    const blob = await res.blob();
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }

  useEffect(() => {
    if (!user?.id) return;
    if (nameFormDirty.current && syncedUserId.current === user.id) return;
    setNameParts(namePartsFromUser(user));
    syncedUserId.current = user.id;
    nameFormDirty.current = false;
  }, [
    user?.id,
    user?.name,
    user?.first_name,
    user?.middle_name,
    user?.last_name,
  ]);

  useEffect(() => {
    const pref = user?.preferred_language as PreferredLang | undefined;
    if (pref && LANGS.includes(pref)) setLanguage(pref);
  }, [user?.preferred_language]);

  useEffect(() => {
    const parsed = parsePhoneParts(user?.phone || "");
    setCountryCode(parsed.countryCode);
    setPhoneNational(parsed.national);
  }, [user?.phone]);

  useEffect(() => {
    void loadPhoto().catch(() => setPhotoUrl(null));
    return () => {
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const phoneErr = validatePhoneNational(countryCode, phoneNational);
    if (phoneErr) {
      setPhoneError(phoneErr);
      toast.error(phoneErr);
      return;
    }
    setPhoneError(undefined);
    const nErrs = validatePersonNameParts(nameParts);
    if (Object.keys(nErrs).length) {
      setNameErrors(nErrs);
      toast.error(Object.values(nErrs)[0]);
      return;
    }
    setNameErrors({});
    setSaving(true);
    try {
      const phone = toE164(countryCode, phoneNational);
      await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: nameParts.first_name.trim(),
          middle_name: nameParts.middle_name.trim(),
          last_name: nameParts.last_name.trim(),
          preferred_language: language,
          phone,
        }),
      });
      // Mirror onto the customer profile record; not fatal if it is not set up yet.
      try {
        await api("/customer/profile", {
          method: "PATCH",
          body: JSON.stringify({ preferred_language: language }),
        });
      } catch {
        /* profile row may not exist yet */
      }
      setLang(uiLangFromPreferred(language));
      nameFormDirty.current = false;
      await refresh();
      toast.success(t("web.customerProfile.updated"));
    } catch (err: any) {
      toast.error(err.message || t("web.customerProfile.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onPhoto(file: File) {
    setUploading(true);
    try {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${apiBase()}/api/v1/customer/profile/photo`, {
        method: "POST",
        headers,
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { detail?: string }).detail || t("web.customerProfile.uploadFailed"));
      toast.success(t("web.customerProfile.photoUpdated"));
      await loadPhoto();
      window.dispatchEvent(new Event("bseva:customer-photo"));
    } catch (err: any) {
      toast.error(err.message || t("web.customerProfile.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setUploading(true);
    try {
      await api("/customer/profile/photo", { method: "DELETE" });
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.success(t("web.customerProfile.photoRemoved"));
      window.dispatchEvent(new Event("bseva:customer-photo"));
    } catch (err: any) {
      toast.error(err.message || t("web.customerProfile.saveFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <CustomerPortal>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="">{t("web.customerProfile.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={save} autoComplete="off">
            {user?.public_id ? (
              <div className="space-y-1">
                <Label>{t("web.customerProfile.customerId")}</Label>
                <p className="font-mono text-sm">{user.public_id}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>
                {t("web.customerProfile.photo")}{" "}
                <span className="text-muted-foreground font-normal">({t("common.optional")})</span>
              </Label>
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-28 w-28 rounded-md object-cover border" />
              ) : (
                <p className="text-sm text-muted-foreground">{t("web.customerProfile.noPhoto")}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void onPhoto(f);
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" disabled={uploading} asChild>
                    <span>{uploading ? t("web.customerProfile.uploading") : photoUrl ? t("web.customerProfile.replacePhoto") : t("web.customerProfile.uploadPhoto")}</span>
                  </Button>
                </label>
                {photoUrl ? (
                  <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={() => void removePhoto()}>
                    {t("web.customerProfile.removePhoto")}
                  </Button>
                ) : null}
              </div>
            </div>
            <PersonNameFields
              value={nameParts}
              onChange={(next) => {
                nameFormDirty.current = true;
                setNameParts(next);
                setNameErrors({});
              }}
              errors={nameErrors}
            />
            <PhoneWithCountryCode
              id="customer-phone"
              label={t("web.customerProfile.mobile")}
              required
              countryCode={countryCode}
              national={phoneNational}
              error={phoneError}
              onCountryCodeChange={(code) => {
                setCountryCode(code);
                setPhoneNational((prev) => prev.slice(0, code === "+91" ? 10 : 12));
                setPhoneError(undefined);
              }}
              onNationalChange={(digits) => {
                setPhoneNational(digits);
                setPhoneError(undefined);
              }}
            />
            <div className="space-y-2">
              <Label>{t("web.customerProfile.language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as PreferredLang)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREFERRED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("web.customerProfile.languageHint")}
              </p>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t("web.customerProfile.email")}: {user?.email || "—"}</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("web.customerProfile.saving") : t("common.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
