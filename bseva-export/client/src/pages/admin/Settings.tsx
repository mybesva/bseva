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
import { Calendar } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { PujariLevelRow } from "@/hooks/usePujariLevels";
import { useAuth } from "@/_core/hooks/useAuth";

const emptyRoleForm = { title: "", summary: "", examplesText: "" };

type SettingType = "string" | "number" | "boolean" | "json";

type PlatformKey = {
  key: string;
  label: string;
  type: SettingType;
  group: string;
  superOnly?: boolean;
  hint?: string;
  /** Stored as paise in the DB; edited and shown as rupees. */
  money?: boolean;
  multiline?: boolean;
};

const SETTING_GROUPS: { id: string; title: string; description?: string }[] = [
  { id: "contact", title: "Contact", description: "How customers reach BSeva." },
  { id: "features", title: "Features", description: "Platform feature flags." },
  {
    id: "service_area",
    title: "Service area unavailable message",
    description: "Message shown when a customer is outside the locations currently served by BSeva.",
  },
  { id: "booking", title: "Booking & puja day", description: "When OTP, tracking, and full booking details become available." },
  { id: "pricing", title: "Pricing & surge", description: "GST and date-based surcharges. Puja prices are set per service. Surge is added to the quoted puja total." },
  { id: "pujari", title: "Pujari", description: "Settlement, joining fee, no-show, and assignment rules." },
  { id: "email", title: "Email", description: "From-addresses used in outgoing mail." },
    { id: "invoices", title: "Invoices", description: "Company, GST, numbering, SAC/HSN, and invoice notes. Used on new invoices only — issued invoices stay unchanged." },
];

const PLATFORM_KEYS: PlatformKey[] = [
  { key: "bseva_whatsapp_number", label: "WhatsApp number (digits, with country code)", type: "string", group: "contact" },
  {
    key: "virtual_puja_enabled",
    label: "Virtual Puja",
    type: "boolean",
    group: "features",
    hint: "When off, customers cannot create Virtual Puja bookings. Admin and Super Admin can turn this on without a deployment.",
  },
  {
    key: "registration_captcha_enabled",
    label: "Registration CAPTCHA",
    type: "boolean",
    group: "features",
    hint: "Requires VITE_RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY env vars.",
  },
  {
    key: "service_area_unavailable_heading",
    label: "Unavailable service area heading",
    type: "string",
    group: "service_area",
    hint: "Short heading shown above the explanation, for example “We’re not in your area yet”.",
  },
  {
    key: "service_area_unavailable_description",
    label: "Unavailable service area description",
    type: "string",
    group: "service_area",
    multiline: true,
    hint: "Explain that service is unavailable at this location and how the customer can get help or check back later.",
  },
  { key: "puja_start_otp_before_minutes", label: "Start OTP available minutes before start", type: "number", group: "booking", hint: "Default 15." },
  {
    key: "pujari_location_tracking_before_minutes",
    label: "Pujari tracking visible minutes before start",
    type: "number",
    group: "booking",
    hint: "Default 15.",
  },
  {
    key: "pujari_full_booking_details_before_hours",
    label: "Full customer location before (hours)",
    type: "number",
    group: "booking",
    hint: "Default 20. Assigned pujari sees full address/maps after this.",
  },
  { key: "pujari_gps_update_interval_seconds", label: "Pujari GPS update interval (seconds)", type: "number", group: "booking", hint: "Default 60." },
  { key: "customer_tracking_refresh_seconds", label: "Customer tracking refresh (seconds)", type: "number", group: "booking", hint: "Default 60." },
  { key: "pujari_arrival_radius_meters", label: "Arrival geofence radius (meters)", type: "number", group: "booking", hint: "Default 100." },
  { key: "pujari_arrival_confirm_pings", label: "Arrival confirmation pings", type: "number", group: "booking", hint: "Consecutive in-radius GPS points required. Default 2." },
  { key: "puja_complete_otp_before_minutes", label: "Completion OTP minutes before expected end", type: "number", group: "booking", hint: "Default 15. Expected end = actual start + service duration." },
  { key: "puja_otp_expiry_minutes", label: "Start OTP expiry (minutes)", type: "number", group: "booking", hint: "Default 240." },
  { key: "puja_complete_otp_expiry_minutes", label: "Completion OTP expiry (minutes)", type: "number", group: "booking", hint: "Default 480. Does not auto-complete the puja." },
  { key: "puja_otp_resend_cooldown_seconds", label: "OTP resend cooldown (seconds)", type: "number", group: "booking", hint: "Default 60." },
  { key: "puja_otp_max_requests_per_hour", label: "OTP max requests per hour", type: "number", group: "booking", hint: "Default 5." },
  { key: "puja_otp_max_verify_attempts", label: "OTP max verify attempts", type: "number", group: "booking", hint: "Default 5, then a short lockout." },
  { key: "puja_otp_lock_minutes", label: "OTP lockout minutes after failed attempts", type: "number", group: "booking", hint: "Default 10." },
  { key: "pujari_settlement_days", label: "Settlement hold days", type: "number", group: "pujari", hint: "Auto-settle every N days (≈ 2 weeks)." },
  {
    key: "pujari_joining_fee_enabled",
    label: "Pujari joining fee",
    type: "boolean",
    group: "pujari",
    hint: "When on, new pujaris are asked to pay the joining fee during onboarding.",
  },
  {
    key: "pujari_joining_fee_paise",
    label: "Pujari joining fee (₹)",
    type: "number",
    group: "pujari",
    money: true,
    hint: "Amount in rupees. Example: 500.",
  },
  {
    key: "pujari_no_show_penalty_enabled",
    label: "Pujari no-show penalty",
    type: "boolean",
    group: "pujari",
    hint: "When on, 100% of that puja’s cost is deducted from the pujari wallet.",
  },
  {
    key: "assign_distance_rings_km",
    label: "Reassignment distance rings (km)",
    type: "json",
    group: "pujari",
    hint: "First number is the default nearby radius (e.g. 10). Reassign shows within that distance first, then farther pujaris.",
  },
  {
    key: "pujari_schedule_buffer_hours",
    label: "Pujari schedule buffer (hours)",
    type: "number",
    group: "pujari",
    hint: "Unavailable this many hours after a confirmed puja ends, and before the next start. Default 4.",
  },
  { key: "email_from_support", label: "Support email", type: "string", group: "email" },
  { key: "email_from_contact", label: "Contact email", type: "string", group: "email" },
  { key: "email_from_accounts", label: "Accounts email", type: "string", group: "email" },
  { key: "email_from_admin", label: "Admin email", type: "string", group: "email" },
  { key: "email_from_info", label: "Info email", type: "string", group: "email" },
  { key: "invoice_brand_name", label: "Brand name", type: "string", group: "invoices" },
  { key: "invoice_company_name", label: "Legal company name", type: "string", group: "invoices" },
  {
    key: "invoice_company_address",
    label: "Complete address",
    type: "string",
    group: "invoices",
    hint: "Use commas, e.g. 123, Banjara Hills Road No. 12, Hyderabad, Telangana – 500034, India.",
    multiline: true,
  },
  { key: "invoice_company_state", label: "State", type: "string", group: "invoices" },
  { key: "invoice_company_pincode", label: "PIN code", type: "string", group: "invoices" },
  { key: "invoice_company_email", label: "Invoice email", type: "string", group: "invoices" },
  { key: "invoice_company_phone", label: "Phone", type: "string", group: "invoices" },
  { key: "invoice_gstin", label: "GSTIN", type: "string", group: "invoices" },
  { key: "invoice_website", label: "Website", type: "string", group: "invoices" },
  { key: "invoice_prefix_customer", label: "Customer invoice prefix", type: "string", group: "invoices", hint: "Used as BSEVA/2026-27/000001." },
  { key: "invoice_prefix_settlement", label: "Settlement invoice prefix", type: "string", group: "invoices" },
  { key: "invoice_signatory_name", label: "Authorized signatory name", type: "string", group: "invoices" },
  { key: "invoice_signatory_designation", label: "Authorized signatory designation", type: "string", group: "invoices" },
  { key: "invoice_sac_code", label: "SAC code (services)", type: "string", group: "invoices", hint: "Shown on tax invoices. Default 999799. GST % is set in Pricing — invoices use the rate stored on the booking." },
  { key: "invoice_hsn_code", label: "HSN code (optional)", type: "string", group: "invoices" },
  { key: "invoice_terms", label: "Invoice terms & conditions", type: "string", group: "invoices", multiline: true },
  { key: "invoice_notes", label: "Invoice notes / footer", type: "string", group: "invoices", multiline: true },
];

const CANCEL_KEYS: { key: string; label: string; type: SettingType; hint?: string; group: "customer" | "pujari" }[] = [
    {
    key: "customer_cancel_fee_over_48h_percent",
    label: "Customer fee % when cancelling >48h before",
    type: "number",
    group: "customer",
    hint: "Default 10. Refund = 100 − this %.",
  },
  {
    key: "customer_cancel_fee_24_48h_percent",
    label: "Customer fee % when cancelling 24–48h before",
    type: "number",
    group: "customer",
    hint: "Default 50.",
  },
  {
    key: "customer_cancel_fee_under_24h_percent",
    label: "Customer fee % when cancelling under 24h",
    type: "number",
    group: "customer",
    hint: "Default 100. Full charge — no refund.",
  },
  {
    key: "pujari_cancel_fee_over_48h_percent",
    label: "Pujari penalty % when cancelling >48h before",
    type: "number",
    group: "pujari",
    hint: "Charged to pujari wallet. Customer gets full refund.",
  },
  {
    key: "pujari_cancel_fee_24_48h_percent",
    label: "Pujari penalty % when cancelling 24–48h before",
    type: "number",
    group: "pujari",
    hint: "Default 50. Charged to pujari wallet.",
  },
  {
    key: "pujari_cancel_fee_under_24h_percent",
    label: "Pujari penalty % when cancelling under 24h",
    type: "number",
    group: "pujari",
    hint: "Default 100. Same as no-show: 100% of that puja’s cost is deducted from the pujari wallet. Customer is refunded in full.",
  },
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

/** Number lists are edited as "10, 15, 20" but stored as a JSON array. */
function numberListToText(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value == null) return "";
  return String(value);
}

function textToNumberList(raw: string): number[] {
  return raw
    .replace(/[[\]]/g, "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function coerceSettingValue(type: SettingType, raw: string | boolean) {
  if (type === "boolean") return Boolean(raw);
  if (type === "number") return Number(raw);
  if (type === "json") return textToNumberList(String(raw));
  return String(raw);
}

function rupeesDraft(stored: unknown): string {
  if (stored == null || stored === "") return "";
  const n = Number(stored);
  if (!Number.isFinite(n)) return "";
  return String(n / 100);
}

function settingToDraft(
  item: { type: SettingType; money?: boolean },
  v: unknown
): string | boolean {
  if (item.type === "boolean") return Boolean(v);
  if (item.type === "json") return numberListToText(v);
  if (item.money) return rupeesDraft(v);
  return v == null ? "" : String(v);
}

function settingFromDraft(item: { type: SettingType; money?: boolean }, raw: string | boolean) {
  if (item.money) return Math.round(Number(raw || 0) * 100);
  return coerceSettingValue(item.type, raw);
}

function isSettingDirty(
  item: { type: SettingType; money?: boolean; key: string },
  draft: Record<string, string | boolean>,
  stored: Record<string, unknown>
) {
  if (item.type === "boolean") return Boolean(draft[item.key]) !== Boolean(stored[item.key]);
  if (item.type === "json") {
    return (
      textToNumberList(String(draft[item.key] ?? "")).join(",") !==
      numberListToText(stored[item.key]).replace(/\s/g, "")
    );
  }
  if (item.money) return String(draft[item.key] ?? "") !== rupeesDraft(stored[item.key]);
  return String(draft[item.key] ?? "") !== String(stored[item.key] ?? "");
}

type SurgeMode = "percent" | "amount";

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function datesFromConfig(raw: unknown): string[] {
  if (Array.isArray(raw)) return [...new Set(raw.map((x) => String(x).slice(0, 10)))].filter((s) => s.length === 10).sort();
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return datesFromConfig(parsed);
    } catch {
      return raw
        .split(/[,\s]+/)
        .map((s) => s.trim().slice(0, 10))
        .filter((s) => s.length === 10)
        .sort();
    }
  }
  return [];
}

function DateSurgeEditor({ cfg, onSaved }: { cfg: Record<string, unknown>; onSaved: () => Promise<void> }) {
  const [weekendMode, setWeekendMode] = useState<SurgeMode>("percent");
  const [weekendPercent, setWeekendPercent] = useState("0");
  const [weekendAmount, setWeekendAmount] = useState("0");
  const [festivalMode, setFestivalMode] = useState<SurgeMode>("amount");
  const [festivalPercent, setFestivalPercent] = useState("0");
  const [festivalAmount, setFestivalAmount] = useState("0");
  const [festivalDates, setFestivalDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [addDate, setAddDate] = useState("");

  useEffect(() => {
    const wMode = String(cfg.weekend_surge_mode || "percent") === "amount" ? "amount" : "percent";
    const fMode = String(cfg.festival_surge_mode || "amount") === "percent" ? "percent" : "amount";
    setWeekendMode(wMode);
    setFestivalMode(fMode);
    setWeekendPercent(String(cfg.weekend_surge_percent ?? 0));
    setWeekendAmount(rupeesDraft(cfg.weekend_surge_paise) || "0");
    setFestivalPercent(String(cfg.festival_surge_percent ?? 0));
    setFestivalAmount(rupeesDraft(cfg.festival_surge_paise) || "0");
    setFestivalDates(datesFromConfig(cfg.festival_surge_dates));
  }, [cfg]);

  const selectedDays = festivalDates.map(parseIsoDate).filter((d): d is Date => !!d);

  async function save() {
    setSaving(true);
    const payload: { key: string; value: unknown }[] = [
      { key: "weekend_surge_mode", value: weekendMode },
      { key: "weekend_surge_percent", value: Number(weekendPercent || 0) },
      { key: "weekend_surge_paise", value: Math.round(Number(weekendAmount || 0) * 100) },
      { key: "festival_surge_mode", value: festivalMode },
      { key: "festival_surge_percent", value: Number(festivalPercent || 0) },
      { key: "festival_surge_paise", value: Math.round(Number(festivalAmount || 0) * 100) },
      { key: "festival_surge_dates", value: festivalDates },
    ];
    try {
      for (const row of payload) {
        await api("/admin/config", { method: "PUT", body: JSON.stringify(row) });
      }
      toast.success("Surge settings saved");
      await onSaved();
    } catch (e: any) {
      toast.error(e.message || "Could not save surge");
    } finally {
      setSaving(false);
    }
  }

  function ModeToggle({ value, onChange }: { value: SurgeMode; onChange: (v: SurgeMode) => void }) {
    return (
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v === "percent" || v === "amount") onChange(v);
        }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="percent">Percent %</ToggleGroupItem>
        <ToggleGroupItem value="amount">Amount ₹</ToggleGroupItem>
      </ToggleGroup>
    );
  }

  function valueField(mode: SurgeMode, percent: string, setPercent: (v: string) => void, amount: string, setAmount: (v: string) => void) {
    if (mode === "percent") {
      return (
        <div className="space-y-1">
          <Label>Surge %</Label>
          <Input type="number" min={0} step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <Label>Surge amount (₹)</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input className="pl-7" type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="font-semibold text-foreground">Date surge</h3>
      <p className="text-xs text-muted-foreground">
        Added to the puja total at quote and checkout. If a festival date falls on a weekend, both surges apply.
      </p>

      <div className="space-y-3 rounded-md border border-border/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium">Weekend (Saturday & Sunday)</h4>
          <ModeToggle value={weekendMode} onChange={setWeekendMode} />
        </div>
        {valueField(weekendMode, weekendPercent, setWeekendPercent, weekendAmount, setWeekendAmount)}
      </div>

      <div className="space-y-3 rounded-md border border-border/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium">Festival dates</h4>
          <ModeToggle value={festivalMode} onChange={setFestivalMode} />
        </div>
        {valueField(festivalMode, festivalPercent, setFestivalPercent, festivalAmount, setFestivalAmount)}
        <div className="space-y-2">
          <Label>Select festival dates</Label>
          <p className="text-xs text-muted-foreground">Tap dates on the calendar. Surge applies only on the dates you select.</p>
          <div className="rounded-md border border-border w-fit bg-background">
            <Calendar
              mode="multiple"
              selected={selectedDays}
              onSelect={(days) => {
                const next = (days || []).map(isoDate);
                setFestivalDates([...new Set(next)].sort());
              }}
              captionLayout="dropdown"
              className="p-2"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="add-fest-date">Or add a date</Label>
              <Input
                id="add-fest-date"
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="w-44"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!addDate}
              onClick={() => {
                if (!addDate) return;
                setFestivalDates((prev) => [...new Set([...prev, addDate])].sort());
                setAddDate("");
              }}
            >
              Add date
            </Button>
          </div>
          {festivalDates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {festivalDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs"
                >
                  {d}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setFestivalDates((prev) => prev.filter((x) => x !== d))}
                    aria-label={`Remove ${d}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save surge"}
      </Button>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [gst, setGst] = useState("18");
  const [savedGst, setSavedGst] = useState("18");
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

  const pricingDirty = useMemo(() => gst.trim() !== savedGst.trim(), [gst, savedGst]);

  async function loadPricing() {
    const p = await api<any>("/admin/pricing");
    const gstVal = String(p.gst_percent ?? 18);
    setGst(gstVal);
    setSavedGst(gstVal);
  }

  async function loadPlatform() {
    try {
      const cfg = await api<Record<string, unknown>>("/admin/config");
      setPlatform(cfg || {});
      const draft: Record<string, string | boolean> = {};
      for (const item of [...PLATFORM_KEYS, ...CANCEL_KEYS]) {
        draft[item.key] = settingToDraft(item, cfg?.[item.key]);
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

  useEffect(() => {
    const raw = window.location.hash.replace("#", "").trim();
    if (!raw) return;
    const id = raw.startsWith("settings-") ? raw : `settings-${raw}`;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [platform]);

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
        }),
      });
      setSavedGst(gst);
      toast.success("GST saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingPricing(false);
    }
  }

  async function savePlatformKey(key: string, type: SettingType, money?: boolean) {
    setSavingKey(key);
    try {
      const value = settingFromDraft({ type, money }, platformDraft[key] ?? "");
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
    if (!role.id || role.can_delete === false) return;
    if (!confirm(`Delete Level ${role.level} — ${role.title}?`)) return;
    try {
      await api(`/admin/pujari-roles/${role.id}`, { method: "DELETE" });
      toast.success("Role deleted");
      await loadRoles();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function renderSettingRow(item: PlatformKey) {
    const dirty = isSettingDirty(item, platformDraft, platform);
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
          ) : item.money ? (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ₹
              </span>
              <Input
                type="number"
                min={0}
                step="1"
                className="pl-7"
                value={String(platformDraft[item.key] ?? "")}
                onChange={(e) =>
                  setPlatformDraft((prev) => ({ ...prev, [item.key]: e.target.value }))
                }
              />
            </div>
          ) : item.multiline ? (
            <Textarea
              rows={3}
              value={String(platformDraft[item.key] ?? "")}
              onChange={(e) =>
                setPlatformDraft((prev) => ({ ...prev, [item.key]: e.target.value }))
              }
            />
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
            onClick={() => void savePlatformKey(item.key, item.type, item.money)}
          >
            {savingKey === item.key ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <AdminLayout>
      <nav className="sticky top-16 z-30 -mx-4 -mt-4 mb-4 flex flex-wrap gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:-mt-6 lg:px-6">
        {[
          ...SETTING_GROUPS.map((group) => ({ id: `settings-${group.id}`, title: group.title })),
          { id: "settings-cancellation", title: "Cancellation" },
          { id: "settings-pujari-roles", title: "Pujari roles" },
        ].map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            {item.title}
          </Button>
        ))}
      </nav>

      <div className="space-y-8 max-w-4xl">
        {SETTING_GROUPS.map((group) => {
          const items = visiblePlatformKeys.filter((item) => item.group === group.id);
          const isPricing = group.id === "pricing";
          if (!items.length && !isPricing) return null;
          return (
            <Card key={group.id} id={`settings-${group.id}`} className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="">{group.title}</CardTitle>
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isPricing && (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <h3 className="font-semibold text-foreground">Tax</h3>
                    <div className="space-y-1">
                      <Label>GST %</Label>
                      <Input value={gst} onChange={(e) => setGst(e.target.value)} type="number" min={0} step="0.01" />
                    </div>
                    {pricingDirty && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button onClick={savePricing} disabled={savingPricing}>
                          {savingPricing ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={savingPricing}
                          onClick={() => setGst(savedGst)}
                        >
                          Discard
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {isPricing && <DateSurgeEditor cfg={platform} onSaved={loadPlatform} />}
                {items.length > 0 && (
                  <div className="space-y-4">
                    {items.map((item) => renderSettingRow(item))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card id="settings-cancellation" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="">Cancellation policy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Time-based fees for customer and pujari cancellations. Values are percentages of booking total.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {(
              [
                { id: "customer" as const, title: "Customer cancellation" },
                { id: "pujari" as const, title: "Pujari cancellation (accepted bookings)" },
              ] as const
            ).map((section) => (
              <div key={section.id} className="space-y-4 rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground">{section.title}</h3>
                {CANCEL_KEYS.filter((item) => item.group === section.id).map((item) => {
                  const dirty =
                    String(platformDraft[item.key] ?? "") !== String(platform[item.key] ?? "");
                  return (
                    <div
                      key={item.key}
                      className="flex flex-col sm:flex-row sm:items-end gap-3 border-b border-border/60 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex-1 space-y-1">
                        <Label>{item.label}</Label>
                        {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
                        <Input
                          type="number"
                          min={0}
                          max={item.key.includes("percent") ? 100 : undefined}
                          value={String(platformDraft[item.key] ?? "")}
                          onChange={(e) =>
                            setPlatformDraft((prev) => ({ ...prev, [item.key]: e.target.value }))
                          }
                        />
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
              </div>
            ))}
          </CardContent>
        </Card>

        <Card id="settings-pujari-roles" className="scroll-mt-24">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="">Pujari roles</CardTitle>
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
                          <h3 className="text-base font-semibold text-foreground">{role.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {role.summary || "No description"}
                        </p>
                        {examples.length > 0 && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground">Examples: </span>
                            {examples.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEditRole(role)}>
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <span
                          className="inline-flex"
                          title={
                            role.can_delete === false
                              ? "Cannot delete — pujaris or services still use this level"
                              : "Remove this unused level"
                          }
                        >
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          disabled={role.can_delete === false}
                          onClick={() => deleteRole(role)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                        </span>
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
            <DialogTitle className="">
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
