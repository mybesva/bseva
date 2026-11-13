import { displayTokenLabel } from "@bseva/config";
import type { SevaEvent } from "@bseva/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { AppText, ChoiceChips, ErrorBanner, Field } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export type PickerOption = { id: string; label: string; subtitle?: string };

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: T[] } | null | undefined)?.items;
  return Array.isArray(items) ? items : [];
}

/** Tap-to-open searchable list for picking one row (service, temple, pujari). */
export function OptionPicker({
  label,
  options,
  value,
  onChange,
  placeholder = "Select",
  allowClear,
  loading,
}: {
  label: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  loading?: boolean;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.subtitle || ""}`.toLowerCase().includes(q));
  }, [options, query]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small" style={{ fontWeight: "600" }} color={colors.mutedForeground}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || placeholder}`}
        disabled={loading}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 14,
          paddingHorizontal: 14,
          minHeight: 48,
          backgroundColor: colors.card,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <AppText style={{ flex: 1 }} numberOfLines={2} color={selected ? colors.foreground : colors.mutedForeground}>
          {loading ? "Loading..." : selected?.label || placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setOpen(false)} />
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.background, maxHeight: "78%" }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 10 }}>
              <AppText variant="h3">{label}</AppText>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  minHeight: 48,
                  backgroundColor: colors.card,
                }}
              >
                <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, color: colors.foreground, fontSize: 16, paddingVertical: 10 }}
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
                {allowClear && value ? (
                  <Pressable onPress={() => pick("")} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 4 }}>
                    <AppText color={colors.mutedForeground}>None</AppText>
                  </Pressable>
                ) : null}
                {filtered.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <AppText color={colors.mutedForeground}>No matches.</AppText>
                  </View>
                ) : (
                  filtered.map((o) => {
                    const active = o.id === value;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => pick(o.id)}
                        style={{
                          minHeight: 52,
                          paddingVertical: 10,
                          paddingHorizontal: 4,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText style={{ fontWeight: active ? "700" : "400" }}>{o.label}</AppText>
                          {o.subtitle ? (
                            <AppText variant="small" color={colors.mutedForeground}>
                              {o.subtitle}
                            </AppText>
                          ) : null}
                        </View>
                        {active ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

type FormState = {
  service_id: string;
  temple_id: string;
  assigned_pujari_id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  booking_cutoff_at: string;
  capacity: string;
  participation_mode: string;
  puja_event_kind: string;
  is_free: boolean;
  price_paise: string;
  online_enabled: boolean;
  language_code: string;
  published: boolean;
};

const EMPTY: FormState = {
  service_id: "",
  temple_id: "",
  assigned_pujari_id: "",
  title: "",
  description: "",
  start_at: "",
  end_at: "",
  booking_cutoff_at: "",
  capacity: "",
  participation_mode: "offline",
  puja_event_kind: "",
  is_free: false,
  price_paise: "",
  online_enabled: false,
  language_code: "",
  published: false,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → "YYYY-MM-DD HH:mm" in local time (what web's datetime-local input shows). */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DD HH:mm" (local) → Date, or null when it does not parse. */
function parseLocalInput(text: string): Date | null {
  const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formFromEvent(ev: SevaEvent): FormState {
  return {
    service_id: String(ev.service_id || ""),
    temple_id: String(ev.temple_id || ""),
    assigned_pujari_id: String(ev.assigned_pujari_id || ""),
    title: ev.title || "",
    description: ev.description || "",
    start_at: toLocalInput(ev.start_at),
    end_at: toLocalInput(ev.end_at),
    booking_cutoff_at: toLocalInput(ev.booking_cutoff_at),
    capacity: ev.capacity != null ? String(ev.capacity) : "",
    participation_mode: String(ev.participation_mode || "offline"),
    puja_event_kind: String(ev.puja_event_kind || ""),
    is_free: Boolean(ev.is_free),
    price_paise: ev.price_paise != null && !ev.is_free ? String(Number(ev.price_paise) / 100) : "",
    online_enabled: Boolean(ev.online_enabled),
    language_code: ev.language_code || "",
    published: Boolean(ev.published),
  };
}

/** Create (POST /admin/seva/events) or edit (PATCH /admin/seva/events/:id) a seva event. */
export function SevaEventFormModal({
  visible,
  event,
  onClose,
  onSaved,
}: {
  visible: boolean;
  event?: SevaEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useAppTheme();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(event ? formFromEvent(event) : EMPTY);
    setError(null);
    // Reset only when opened or switched to another event, not when a refetch hands a new object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, event?.id]);

  const services = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => apiClient.api<unknown>("/admin/services"),
    enabled: visible,
  });
  const temples = useQuery({
    queryKey: ["admin-temples-picker"],
    queryFn: () => apiClient.api<unknown>("/admin/temples"),
    enabled: visible,
  });
  const pujaris = useQuery({
    queryKey: ["admin-pujaris-approved-picker"],
    queryFn: () => apiClient.api<unknown>("/admin/pujaris?status=approved&page_size=100"),
    enabled: visible,
  });

  const serviceOptions = useMemo(
    () =>
      asList<{ id: string; name: string; service_type?: string }>(services.data).map((s) => ({
        id: String(s.id),
        label: `${s.name} (${displayTokenLabel(s.service_type || "puja")})`,
      })),
    [services.data]
  );
  const templeOptions = useMemo(
    () => asList<{ id: string; name: string; city?: string }>(temples.data).map((t) => ({ id: String(t.id), label: t.name, subtitle: t.city })),
    [temples.data]
  );
  const pujariOptions = useMemo(
    () => asList<{ id: string; name: string }>(pujaris.data).map((p) => ({ id: String(p.id), label: p.name })),
    [pujaris.data]
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.service_id) {
      setError("Select a service");
      return;
    }
    const start = parseLocalInput(form.start_at);
    if (!start) {
      setError("Enter a valid start (YYYY-MM-DD HH:mm)");
      return;
    }
    const end = form.end_at.trim() ? parseLocalInput(form.end_at) : null;
    if (form.end_at.trim() && !end) {
      setError("Enter a valid end (YYYY-MM-DD HH:mm)");
      return;
    }
    const cutoff = form.booking_cutoff_at.trim() ? parseLocalInput(form.booking_cutoff_at) : null;
    if (form.booking_cutoff_at.trim() && !cutoff) {
      setError("Enter a valid booking cutoff (YYYY-MM-DD HH:mm)");
      return;
    }
    const payload = {
      service_id: form.service_id,
      temple_id: form.temple_id || null,
      assigned_pujari_id: form.assigned_pujari_id || null,
      title: form.title || null,
      description: form.description || null,
      start_at: start.toISOString(),
      end_at: end ? end.toISOString() : null,
      booking_cutoff_at: cutoff ? cutoff.toISOString() : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      participation_mode: form.participation_mode,
      puja_event_kind: form.puja_event_kind || null,
      is_free: form.is_free,
      price_paise: form.is_free ? 0 : form.price_paise ? Math.round(Number(form.price_paise) * 100) : null,
      online_enabled: form.online_enabled,
      language_code: form.language_code || null,
      published: form.published,
      status: form.published ? "published" : "draft",
    };
    setSaving(true);
    setError(null);
    try {
      if (event?.id) {
        await apiClient.api(`/admin/seva/events/${event.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiClient.api("/admin/seva/events", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const toggle = (label: string, key: "is_free" | "online_enabled" | "published") => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <AppText>{label}</AppText>
      <Switch value={form[key]} onValueChange={(v) => set(key, v)} />
    </View>
  );

  return (
    <AdminFormModal
      visible={visible}
      title={event?.id ? "Edit Seva Event" : "Create Seva Event"}
      onClose={onClose}
      submitLabel="Save"
      onSubmit={() => void save()}
      loading={saving}
    >
      <ErrorBanner message={error} />
      <OptionPicker
        label="Service *"
        options={serviceOptions}
        value={form.service_id}
        onChange={(v) => set("service_id", v)}
        placeholder="Select service"
        loading={services.isLoading}
      />
      <OptionPicker
        label="Temple"
        options={templeOptions}
        value={form.temple_id}
        onChange={(v) => set("temple_id", v)}
        placeholder="Optional"
        allowClear
        loading={temples.isLoading}
      />
      <OptionPicker
        label="Assigned Pujari"
        options={pujariOptions}
        value={form.assigned_pujari_id}
        onChange={(v) => set("assigned_pujari_id", v)}
        placeholder="Optional"
        allowClear
        loading={pujaris.isLoading}
      />
      <Field label="Title Override" value={form.title} onChangeText={(v) => set("title", v)} />
      <Field label="Description" value={form.description} onChangeText={(v) => set("description", v)} multiline />
      <Field
        label="Start * (YYYY-MM-DD HH:mm)"
        placeholder="2026-12-01 07:30"
        value={form.start_at}
        onChangeText={(v) => set("start_at", v)}
        autoCapitalize="none"
      />
      <Field
        label="End (YYYY-MM-DD HH:mm)"
        placeholder="Optional"
        value={form.end_at}
        onChangeText={(v) => set("end_at", v)}
        autoCapitalize="none"
      />
      <Field
        label="Booking Cutoff (YYYY-MM-DD HH:mm)"
        placeholder="Optional"
        value={form.booking_cutoff_at}
        onChangeText={(v) => set("booking_cutoff_at", v)}
        autoCapitalize="none"
      />
      <Field label="Capacity" value={form.capacity} onChangeText={(v) => set("capacity", v)} keyboardType="number-pad" />
      <AppText variant="small" color={colors.mutedForeground}>
        Participation Mode
      </AppText>
      <ChoiceChips
        options={[
          { id: "offline", label: "Offline" },
          { id: "online", label: "Online" },
          { id: "hybrid", label: "Hybrid" },
        ]}
        value={form.participation_mode}
        onChange={(v) => set("participation_mode", String(v))}
      />
      <AppText variant="small" color={colors.mutedForeground}>
        Puja Event Kind
      </AppText>
      <ChoiceChips
        options={[
          { id: "", label: "None" },
          { id: "group_live", label: "Group Live" },
          { id: "proxy", label: "Proxy / Temple" },
        ]}
        value={form.puja_event_kind}
        onChange={(v) => set("puja_event_kind", String(v))}
      />
      {toggle("Free Event", "is_free")}
      {!form.is_free ? (
        <Field label="Price (₹)" value={form.price_paise} onChangeText={(v) => set("price_paise", v)} keyboardType="decimal-pad" />
      ) : null}
      {toggle("Online Joining Enabled", "online_enabled")}
      {toggle(event?.id ? "Published" : "Publish Immediately", "published")}
    </AdminFormModal>
  );
}
