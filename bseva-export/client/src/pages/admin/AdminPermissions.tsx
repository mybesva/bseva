import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

export default function AdminPermissionsPage() {
  const { t } = useI18n();
  const [admins, setAdmins] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [a, c] = await Promise.all([
      api<any[]>("/admin/admins"),
      api<{ permissions: string[] }>("/admin/permissions/catalog"),
    ]);
    setAdmins(a);
    setCatalog(c.permissions || []);
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  function pick(admin: any) {
    setSelected(admin.id);
    setPerms([...(admin.permissions || [])]);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/admin/users/${selected}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms }),
      });
      toast.success(t("admin.permissions.saved"));
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const current = admins.find((a) => a.id === selected);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-4">{t("admin.permissions.title")}</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">{t("admin.permissions.admins")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {admins.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`w-full text-left border rounded-md p-3 text-sm ${
                  selected === a.id ? "border-primary bg-orange-50" : "border-border"
                }`}
                onClick={() => pick(a)}
              >
                <div className="font-medium">{a.name}</div>
                <div className="text-muted-foreground text-xs">
                  {a.email} · {a.role}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              {current ? current.name : t("admin.permissions.select")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!current && <p className="text-sm text-muted-foreground">{t("admin.permissions.select")}</p>}
            {current?.role === "super_admin" && (
              <p className="text-sm text-muted-foreground">{t("admin.permissions.superNote")}</p>
            )}
            {current && current.role !== "super_admin" && (
              <>
                <div className="max-h-[50vh] overflow-y-auto space-y-2">
                  {catalog.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={perms.includes(p)}
                        onCheckedChange={(v) => {
                          setPerms((prev) => (v ? [...prev, p] : prev.filter((x) => x !== p)));
                        }}
                      />
                      {p}
                    </label>
                  ))}
                </div>
                <Button disabled={saving} onClick={() => void save()}>
                  {saving ? t("common.loading") : t("admin.permissions.save")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
