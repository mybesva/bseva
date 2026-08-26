import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

const QUALS = [
  { id: "panchadasha", key: "pujari.q1" },
  { id: "kriya_kovida", key: "pujari.q2" },
  { id: "vidya_visharada", key: "pujari.q3" },
];

const LANG_OPTS = ["Sanskrit", "Hindi", "English", "Telugu", "Kannada", "Tamil", "Marathi"];
const SPEC_OPTS = ["Satyanarayan Puja", "Griha Pravesh", "Wedding", "Havan", "Vastu Shanti", "Namkaran"];

export default function PujariExperiencePage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const yearNow = new Date().getFullYear();

  useEffect(() => {
    api<any>("/pujari/profile")
      .then(setProfile)
      .catch((e) => toast.error(e.message));
  }, []);

  function setField(key: string, value: unknown) {
    setProfile((prev: any) => ({ ...prev, [key]: value }));
  }

  function toggle(key: "languages" | "specializations", item: string, on: boolean) {
    const cur: string[] = profile?.[key] || [];
    setField(key, on ? Array.from(new Set([...cur, item])) : cur.filter((x) => x !== item));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api<any>("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          experience_years: profile.experience_years ? Number(profile.experience_years) : null,
          qualifications: profile.qualifications || [],
          qualification_year: profile.qualification_year ? Number(profile.qualification_year) : null,
          sampradaya: profile.sampradaya || null,
          languages: profile.languages || [],
          specializations: profile.specializations || [],
        }),
      });
      setProfile(updated);
      toast.success("Experience saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <PujariPortal>
        <p className="text-muted-foreground">Loading…</p>
      </PujariPortal>
    );
  }

  const quals: string[] = profile.qualifications || [];
  const langs: string[] = profile.languages || [];
  const specs: string[] = profile.specializations || [];

  return (
    <PujariPortal>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="font-heading">Experience</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={save}>
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
              <h3 className="font-medium">{t("pujari.qualification")}</h3>
              {QUALS.map((q) => (
                <label key={q.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={quals.includes(q.id)}
                    onCheckedChange={(v) => {
                      setField("qualifications", v ? [...quals, q.id] : quals.filter((x) => x !== q.id));
                    }}
                  />
                  {t(q.key)}
                </label>
              ))}
              <div className="max-w-xs">
                <Label>{t("pujari.year")}</Label>
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
              <h3 className="font-medium">{t("pujari.sampradaya")}</h3>
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
                    <Checkbox checked={langs.includes(l)} onCheckedChange={(v) => toggle("languages", l, !!v)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Specializations</Label>
              <div className="flex flex-wrap gap-3">
                {SPEC_OPTS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={specs.includes(s)} onCheckedChange={(v) => toggle("specializations", s, !!v)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
