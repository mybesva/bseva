import { useEffect, useState } from "react";
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
import type { Lang } from "@/i18n/translations";
import { toast } from "sonner";
import PersonNameFields from "@/components/PersonNameFields";
import {
  splitDisplayName,
  validatePersonNameParts,
  type PersonNameParts,
} from "@/lib/personName";

const LANGS: Lang[] = ["en", "hi", "te"];

export default function CustomerProfilePage() {
  const { user, refresh } = useAuth();
  const { setLang, labels } = useI18n();
  const [nameParts, setNameParts] = useState<PersonNameParts>({
    first_name: "",
    middle_name: "",
    last_name: "",
  });
  const [nameErrors, setNameErrors] = useState<Partial<Record<keyof PersonNameParts, string>>>({});
  const [language, setLanguage] = useState<Lang>("en");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNational, setPhoneNational] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    const u = user as { first_name?: string; middle_name?: string; last_name?: string; name?: string } | null;
    if (u?.first_name || u?.last_name) {
      setNameParts({
        first_name: u.first_name || "",
        middle_name: u.middle_name || "",
        last_name: u.last_name || "",
      });
    } else {
      setNameParts(splitDisplayName(u?.name));
    }
  }, [user?.name, (user as { first_name?: string })?.first_name, (user as { last_name?: string })?.last_name]);

  useEffect(() => {
    const pref = user?.preferred_language as Lang | undefined;
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
          middle_name: nameParts.middle_name.trim() || null,
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
      setLang(language);
      await refresh();
      toast.success("Profile details updated");
    } catch (err: any) {
      toast.error(err.message || "Could not save profile");
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
      if (!res.ok) throw new Error((data as { detail?: string }).detail || "Upload failed");
      toast.success("Photo updated");
      await loadPhoto();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <CustomerPortal>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="">My Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={save}>
            {user?.public_id ? (
              <div className="space-y-1">
                <Label>Customer ID</Label>
                <p className="font-mono text-sm">{user.public_id}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Profile photo</Label>
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-28 w-28 rounded-md object-cover border" />
              ) : (
                <p className="text-sm text-muted-foreground">No photo uploaded yet.</p>
              )}
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
                  <span>{uploading ? "Uploading…" : photoUrl ? "Replace photo" : "Upload photo"}</span>
                </Button>
              </label>
            </div>
            <PersonNameFields
              value={nameParts}
              onChange={(next) => {
                setNameParts(next);
                setNameErrors({});
              }}
              errors={nameErrors}
            />
            <PhoneWithCountryCode
              id="customer-phone"
              label="Mobile number"
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
              <Label>Preferred language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {labels[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Applies to the site language and your notifications.
              </p>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Email: {user?.email || "—"}</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
