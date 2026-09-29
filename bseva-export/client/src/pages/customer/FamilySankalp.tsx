import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import type { FamilyMember } from "@bseva/types";

const emptyMember = (): Omit<FamilyMember, "id"> => ({
  name: "",
  gotra: "",
  gotra_unknown: false,
  relationship: "other",
  date_of_birth: null,
  notes: null,
});

export default function FamilySankalpPage() {
  const { t } = useI18n();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<FamilyMember, "id">>(emptyMember());

  async function loadAll() {
    setLoading(true);
    try {
      const list = await api<FamilyMember[]>("/customer/family-members");
      setMembers(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function startAdd() {
    setEditId(null);
    setForm(emptyMember());
    setMode("add");
  }

  function startEdit(member: FamilyMember) {
    setEditId(member.id || null);
    setForm({
      name: member.name || "",
      gotra: member.gotra || "",
      gotra_unknown: Boolean(member.gotra_unknown),
      relationship: member.relationship || "other",
      date_of_birth: member.date_of_birth || null,
      notes: member.notes || null,
    });
    setMode("edit");
  }

  function cancelForm() {
    setMode("list");
    setEditId(null);
    setForm(emptyMember());
  }

  async function saveMember(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t("auth.name"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        gotra: form.gotra_unknown ? null : form.gotra?.trim() || null,
        gotra_unknown: form.gotra_unknown,
        relationship: form.relationship,
        date_of_birth: form.date_of_birth || null,
        notes: form.notes?.trim() || null,
      };
      if (mode === "edit" && editId) {
        await api(`/customer/family-members/${encodeURIComponent(editId)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/customer/family-members", { method: "POST", body: JSON.stringify(body) });
      }
      toast.success(t("common.saved"));
      cancelForm();
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(id: string) {
    if (!window.confirm(t("common.delete"))) return;
    try {
      await api(`/customer/family-members/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success(t("common.saved"));
      if (editId === id) cancelForm();
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
    }
  }

  return (
    <CustomerPortal>
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{t("seva.familySankalp")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t("seva.familyMembers")}</p>
            </div>
            {mode === "list" ? (
              <Button type="button" onClick={startAdd}>
                {t("seva.addMember")}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">{t("common.loading")}</p>
            ) : mode === "list" ? (
              members.length === 0 ? (
                <p className="text-muted-foreground">{t("common.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="rounded-lg border border-border p-4 space-y-2">
                      <p className="font-semibold">{member.name}</p>
                      {member.gotra_unknown ? (
                        <p className="text-sm text-muted-foreground">{t("seva.gotraUnknown")}</p>
                      ) : member.gotra ? (
                        <p className="text-sm text-muted-foreground">
                          {t("seva.gotra")}: {member.gotra}
                        </p>
                      ) : null}
                      <div className="flex gap-2 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(member)}>
                          {t("common.edit")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => member.id && void removeMember(member.id)}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <form className="space-y-4" onSubmit={saveMember}>
                <div className="space-y-2">
                  <Label htmlFor="member-name">{t("auth.name")}</Label>
                  <Input
                    id="member-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-gotra">{t("seva.gotra")}</Label>
                  <Input
                    id="member-gotra"
                    value={form.gotra || ""}
                    onChange={(e) => setForm((f) => ({ ...f, gotra: e.target.value }))}
                    disabled={form.gotra_unknown}
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.gotra_unknown}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, gotra_unknown: v === true }))
                      }
                    />
                    {t("seva.gotraUnknown")}
                  </label>
                </div>
                <input type="hidden" name="relationship" value={form.relationship} />
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? t("web.customerProfile.saving") : t("common.save")}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelForm}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerPortal>
  );
}
