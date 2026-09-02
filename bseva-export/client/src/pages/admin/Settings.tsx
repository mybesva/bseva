import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { PujariLevelRow } from "@/hooks/usePujariLevels";
import { useAuth } from "@/_core/hooks/useAuth";

const emptyRoleForm = { title: "", summary: "", examplesText: "" };

const PLATFORM_KEYS: { key: string; label: string; type: "string" | "number" | "boolean"; superOnly?: boolean; hint?: string }[] = [
  { key: "bseva_whatsapp_number", label: "WhatsApp number (digits, with country code)", type: "string" },
  {
    key: "virtual_puja_enabled",
    label: "Virtual Puja (feature flag)",
    type: "boolean",
    superOnly: true,
    hint: "When off, customers only see in-person booking. Super Admin only.",
  },
  { key: "pujari_share_percent", label: "Pujari share %", type: "number" },
  { key: "pujari_settlement_days", label: "Settlement hold days", type: "number" },
  { key: "puja_start_otp_before_minutes", label: "OTP available minutes before start", type: "number" },
  { key: "pujari_full_booking_details_before_hours", label: "Full booking details before (hours)", type: "number" },
  { key: "weekend_surge_percent", label: "Weekend surge %", type: "number" },
  { key: "weekend_surge_paise", label: "Weekend surge fixed (paise)", type: "number" },
  { key: "email_from_support", label: "Support email", type: "string" },
  { key: "email_from_contact", label: "Contact email", type: "string" },
  { key: "email_from_accounts", label: "Accounts email", type: "string" },
  { key: "email_from_admin", label: "Admin email", type: "string" },
  { key: "email_from_info", label: "Info email", type: "string" },
  { key: "invoice_company_name", label: "Invoice company name", type: "string" },
  { key: "invoice_gstin", label: "Invoice GSTIN (placeholder OK)", type: "string" },
  { key: "invoice_company_address", label: "Invoice company address", type: "string" },
  { key: "invoice_prefix_customer", label: "Customer invoice number prefix", type: "string" },
  { key: "invoice_prefix_settlement", label: "Settlement invoice number prefix", type: "string" },
];

function normalizeExamples(examples: unknown): string[] {
  if (Array.isArray(examples)) return examples.map(String).filter(Boolean);
  if (typeof examples === "string" && examples.trim()) {
    try {
      const parsed = JSON.parse(examples);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* plain text */
    }
    return examples.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function coerceSettingValue(type: "string" | "number" | "boolean", raw: string | boolean) {
  if (type === "boolean") return Boolean(raw);
  if (type === "number") return Number(raw);
  return String(raw);
}

export default function Settings() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [gst, setGst] = useState("18");
  const [peak, setPeak] = useState("0");
  const [savedGst, setSavedGst] = useState("18");
  const [savedPeak, setSavedPeak] = useState("0");
  const [savingPricing, setSavingPricing] = useState(false);

  const [platform, setPlatform] = useState<Record<string, unknown>>({});
  const [platformDraft, setPlatformDraft] = useState<Record<string, string | boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [roles, setRoles] = useState<PujariLevelRow[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PujariLevelRow | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [savingRole, setSavingRole] = useState(false);

  const visiblePlatformKeys = useMemo(
    () => PLATFORM_KEYS.filter((item) => !item.superOnly || isSuper),
    [isSuper]
  );

  const pricingDirty = useMemo(
    () => gst.trim() !== savedGst.trim() || peak.trim() !== savedPeak.trim(),
    [gst, peak, savedGst, savedPeak]
  );

  async function loadPricing() {
    const p = await api<any>("/admin/pricing");
    const gstVal = String(p.gst_percent ?? 18);
    const peakVal = String((p.peak_day_fee_paise ?? 0) / 100);
    setGst(gstVal);
    setPeak(peakVal);
    setSavedGst(gstVal);
    setSavedPeak(peakVal);
  }

  async function loadPlatform() {
    try {
      const cfg = await api<Record<string, unknown>>("/admin/config");
      setPlatform(cfg || {});
      const draft: Record<string, string | boolean> = {};
      for (const item of PLATFORM_KEYS) {
        const v = cfg?.[item.key];
        if (item.type === "boolean") draft[item.key] = Boolean(v);
        else draft[item.key] = v == null ? "" : String(v);
      }
      setPlatformDraft(draft);
    } catch (e: any) {
      toast.error(e.message || "Could not load platform config");
    }
  }

  async function loadRoles() {
    setRolesLoading(true);
    try {
      setRoles(await api<PujariLevelRow[]>("/admin/pujari-roles"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRolesLoading(false);
    }
  }

  useEffect(() => {
    void loadPricing().catch((e) => toast.error(e.message));
    void loadPlatform();
    void loadRoles();
  }, []);

  function openAddRole() {
    setEditingRole(null);
    setRoleForm(emptyRoleForm);
    setRoleOpen(true);
  }

  function openEditRole(role: PujariLevelRow) {
    setEditingRole(role);
    setRoleForm({
      title: role.title,
      summary: role.summary || "",
      examplesText: normalizeExamples(role.examples).join("\n"),
    });
    setRoleOpen(true);
  }

  async function savePricing() {
    setSavingPricing(true);
    try {
      await api("/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({
          gst_percent: Number(gst),
          peak_day_fee_paise: Math.round(Number(peak) * 100),
        }),
      });
      setSavedGst(gst);
      setSavedPeak(peak);
      toast.success("Pricing saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingPricing(false);
    }
  }

  async function savePlatformKey(key: string, type: "string" | "number" | "boolean") {
    setSavingKey(key);
    try {
      const value = coerceSettingValue(type, platformDraft[key] ?? "");
      await api("/admin/config", {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      });
      setPlatform((prev) => ({ ...prev, [key]: value }));
      toast.success(`Saved ${key}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingKey(null);
    }
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    const examples = roleForm.examplesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const payload = { title: roleForm.title, summary: roleForm.summary || null, examples };
    try {
      if (editingRole?.id) {
        await api(`/admin/pujari-roles/${editingRole.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Role updated");
      } else {
        await api("/admin/pujari-roles", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Role added");
      }
      setRoleOpen(false);
      setRoleForm(emptyRoleForm);
      setEditingRole(null);
      await loadRoles();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingRole(false);
    }
  }

  async function deleteRole(role: PujariLevelRow) {
    if (!role.id) return;
    if (!confirm(`Delete Level ${role.level} — ${role.title}?`)) return;
    try {
      await api(`/admin/pujari-roles/${role.id}`, { method: "DELETE" });
      toast.success("Role deleted");
      await loadRoles();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Settings</h1>

      <div className="space-y-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Platform settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visiblePlatformKeys.map((item) => {
              const dirty =
                item.type === "boolean"
                  ? Boolean(platformDraft[item.key]) !== Boolean(platform[item.key])
                  : String(platformDraft[item.key] ?? "") !== String(platform[item.key] ?? "");
              return (
                <div
                  key={item.key}
                  className="flex flex-col sm:flex-row sm:items-end gap-3 border-b border-border/60 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1 space-y-1">
                    <Label>{item.label}</Label>
                    {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
                    {item.type === "boolean" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={Boolean(platformDraft[item.key])}
                          onCheckedChange={(v) =>
                            setPlatformDraft((prev) => ({ ...prev, [item.key]: !!v }))
                          }
                        />
                        Enabled
                      </label>
                    ) : (
                      <Input
                        type={item.type === "number" ? "number" : "text"}
                        value={String(platformDraft[item.key] ?? "")}
                        onChange={(e) =>
                          setPlatformDraft((prev) => ({ ...prev, [item.key]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                  {dirty && (
                    <Button
                      size="sm"
                      disabled={savingKey === item.key}
                      onClick={() => void savePlatformKey(item.key, item.type)}
                    >
                      {savingKey === item.key ? "Saving…" : "Save"}
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">GST and peak-day fee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>GST %</Label>
              <Input value={gst} onChange={(e) => setGst(e.target.value)} type="number" min={0} step="0.01" />
            </div>
            <div className="space-y-1">
              <Label>Peak day fee (₹)</Label>
              <Input value={peak} onChange={(e) => setPeak(e.target.value)} type="number" min={0} step="1" />
            </div>
            {pricingDirty && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={savePricing} disabled={savingPricing}>
                  {savingPricing ? "Saving…" : "Save pricing"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingPricing}
                  onClick={() => {
                    setGst(savedGst);
                    setPeak(savedPeak);
                  }}
                >
                  Discard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="font-heading">Pujari roles</CardTitle>
            <Button size="sm" className="gap-2" onClick={openAddRole}>
              <Plus size={16} />
              Add role
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rolesLoading && <p className="text-sm text-muted-foreground">Loading roles…</p>}
            {!rolesLoading && roles.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No roles yet. Add your first pujari role.</p>
            )}
            {!rolesLoading &&
              roles.map((role) => {
                const examples = normalizeExamples(role.examples);
                return (
                  <div
                    key={role.id || role.level}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                            Level {role.level}
                          </span>
                          <h3 className="font-heading text-base font-semibold text-sidebar">{role.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {role.summary || "No description"}
                        </p>
                        {examples.length > 0 && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            <span className="font-medium text-sidebar">Examples: </span>
                            {examples.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEditRole(role)}>
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => deleteRole(role)}>
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingRole ? `Edit Level ${editingRole.level}` : "Add pujari role"}
            </DialogTitle>
          </DialogHeader>
          <form id="role-form" onSubmit={saveRole} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-title">Title</Label>
              <Input
                id="role-title"
                placeholder="e.g. Basic Pujas"
                value={roleForm.title}
                onChange={(e) => setRoleForm({ ...roleForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-summary">Description</Label>
              <Textarea
                id="role-summary"
                placeholder="What pujas or services this role covers"
                value={roleForm.summary}
                onChange={(e) => setRoleForm({ ...roleForm, summary: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-examples">Examples (one per line)</Label>
              <Textarea
                id="role-examples"
                placeholder={"Ganapathi Puja\nLakshmi Puja"}
                value={roleForm.examplesText}
                onChange={(e) => setRoleForm({ ...roleForm, examplesText: e.target.value })}
                rows={4}
              />
            </div>
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRoleOpen(false)} disabled={savingRole}>
              Cancel
            </Button>
            <Button type="submit" form="role-form" disabled={savingRole}>
              {savingRole ? "Saving…" : editingRole ? "Save changes" : "Add role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
