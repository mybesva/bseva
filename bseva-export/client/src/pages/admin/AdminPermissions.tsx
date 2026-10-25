import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCheck,
  Crown,
  Eraser,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/AdminLayout";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type AdminRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "admin" | "super_admin";
  permissions: string[];
};

type Catalog = {
  groups: { key: string; label: string; permissions: { key: string; label: string }[] }[];
  super_admin_only: string[];
};

/** What a Super Admin keeps to themselves; shown so it's clear these are not assignable. */
const SUPER_ONLY_CAPABILITIES = [
  "Settlements & payout overrides",
  "Reports & financial exports",
  "Revenue, platform fee & payout KPIs",
  "Admin Permissions",
  "Platform settings (GST, roles, email / SMS)",
];

const CARD =
  "rounded-3xl border border-[#EFE2CF] bg-white shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] dark:border-white/10 dark:bg-[#152238]";

const initials = (name: string | null) =>
  (name || "A")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

function PermissionsWorkspace() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const [a, c] = await Promise.all([api<AdminRow[]>("/admin/admins"), api<Catalog>("/admin/permissions/catalog")]);
    setAdmins(a);
    setCatalog(c);
    return a;
  }, []);

  useEffect(() => {
    load()
      .catch((e: any) => {
        setLoadError(e.message || "Failed to load admins");
        toast.error(e.message || "Failed to load admins");
      })
      .finally(() => setLoading(false));
  }, [load]);

  const selected = admins.find((a) => a.id === selectedId) || null;
  const assignable = useMemo(() => catalog?.groups.flatMap((g) => g.permissions.map((p) => p.key)) ?? [], [catalog]);
  const saved = useMemo(() => (selected?.permissions || []).filter((p) => assignable.includes(p)), [selected, assignable]);
  const dirty = !!selected && selected.role === "admin" && !sameSet(saved, draft);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const select = (id: string) => {
    const row = admins.find((a) => a.id === id);
    setSelectedId(id);
    setDraft((row?.permissions || []).filter((p) => assignable.includes(p)));
  };

  const requestSelect = (id: string) => {
    if (id === selectedId) return;
    if (dirty) setPendingSwitch(id);
    else select(id);
  };

  const toggle = (key: string, on: boolean) =>
    setDraft((prev) => (on ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((p) => p !== key)));

  const setGroup = (keys: string[], on: boolean) =>
    setDraft((prev) => (on ? Array.from(new Set([...prev, ...keys])) : prev.filter((p) => !keys.includes(p))));

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const res = await api<{ permissions: string[] }>(`/admin/users/${selected.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: draft }),
      });
      setAdmins((prev) => prev.map((a) => (a.id === selected.id ? { ...a, permissions: res.permissions } : a)));
      setDraft(res.permissions);
      toast.success(`Permissions saved for ${selected.name || selected.email}`);
    } catch (e: any) {
      toast.error(e.message || "Could not save permissions");
    } finally {
      setSaving(false);
    }
  }

  const q = query.trim().toLowerCase();
  const visibleAdmins = admins.filter(
    (a) => !q || [a.name, a.email, a.phone].some((v) => (v || "").toLowerCase().includes(q)),
  );

  return (
    <div className="soften-brand-mark space-y-6 pb-24">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#0E1830] dark:text-white">Admin Permissions</h1>
        <p className="text-sm text-[#5B6478] dark:text-white/60">
          Choose what each Admin can see and do. Changes apply on the Admin&apos;s next page load.
        </p>
      </header>

      {loadError && <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{loadError}</p>}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Admin directory */}
        <aside className={cn(CARD, "flex h-fit flex-col p-4 xl:sticky xl:top-20")}>
          <div className="relative">
            <Search size="1rem" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7F70]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search admins"
              aria-label="Search admins"
              className="h-10 w-full rounded-xl border border-[#EFE2CF] bg-[#FFFCF7] pl-9 pr-3 text-sm outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <p className="mb-2 mt-4 px-1 text-[0.7rem] font-bold uppercase tracking-wider text-[#8A7F70] dark:text-white/45">
            {visibleAdmins.length} account{visibleAdmins.length === 1 ? "" : "s"}
          </p>
          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="h-16 animate-pulse rounded-2xl bg-[#F6EEE2] dark:bg-white/5" />
              ))}
            {visibleAdmins.map((a) => {
              const active = a.id === selectedId;
              const isSuper = a.role === "super_admin";
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => requestSelect(a.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                      active
                        ? "border-[#FF7A00] bg-[#FFF4E8] shadow-[0_0_0_3px_rgba(255,122,0,0.12)] dark:bg-[#FF7A00]/10"
                        : "border-transparent hover:border-[#EFE2CF] hover:bg-[#FFF8EE] dark:hover:border-white/10 dark:hover:bg-white/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                        isSuper ? "bg-gradient-to-br from-[#F0C35A] to-[#C98A1A] text-[#071A33]" : "bg-[#071A33]",
                      )}
                    >
                      {initials(a.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#0E1830] dark:text-white">{a.name || "Unnamed admin"}</span>
                      <span className="block truncate text-xs text-[#5B6478] dark:text-white/55">{a.email || a.phone || "—"}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
                        isSuper
                          ? "bg-[#FFF1D6] text-[#9A6A00] dark:bg-[#F0C35A]/15 dark:text-[#F0C35A]"
                          : "bg-[#EEF2F8] text-[#1A2B4A] dark:bg-white/10 dark:text-white/75",
                      )}
                    >
                      {isSuper ? "Super Admin" : `${a.permissions.filter((p) => assignable.includes(p)).length} perms`}
                    </span>
                  </button>
                </li>
              );
            })}
            {!loading && visibleAdmins.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-[#5B6478] dark:text-white/55">No admins match “{query}”.</li>
            )}
          </ul>
        </aside>

        {/* Permission editor */}
        <section className="min-w-0 space-y-5">
          {!selected && (
            <div className={cn(CARD, "flex flex-col items-center px-6 py-14 text-center")}>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1E4] text-[#E86A00] dark:bg-[#FF7A00]/15">
                <UserCog size="1.625rem" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-[#0E1830] dark:text-white">Select an admin</h2>
              <p className="mt-1 max-w-sm text-sm text-[#5B6478] dark:text-white/60">
                Pick an account on the left to review and change the modules they can access.
              </p>
            </div>
          )}

          {selected && (
            <div className="relative isolate overflow-hidden rounded-3xl bg-[#071A33] px-6 py-5 text-white">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_90%_at_90%_30%,rgba(255,122,0,0.25),transparent_70%)]" />
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{initials(selected.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{selected.name || "Unnamed admin"}</p>
                  <p className="truncate text-sm text-white/70">{selected.email || selected.phone}</p>
                </div>
                {selected.role === "admin" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                      {draft.length} of {assignable.length} permissions
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraft([...assignable])}
                      disabled={saving}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
                    >
                      <CheckCheck size="0.875rem" /> Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft([])}
                      disabled={saving}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
                    >
                      <Eraser size="0.875rem" /> Clear all
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0C35A]/20 px-3 py-1 text-xs font-bold text-[#F0C35A]">
                    <Crown size="0.8125rem" /> Super Admin
                  </span>
                )}
              </div>
            </div>
          )}

          {selected?.role === "super_admin" && (
            <div className={cn(CARD, "flex items-start gap-3 p-5")}>
              <ShieldCheck className="mt-0.5 shrink-0 text-[#E86A00]" size="1.25rem" />
              <p className="text-sm text-[#1A2B4A] dark:text-white/80">
                Super Admins have unrestricted access to every module, including finance and reporting. Their access isn&apos;t configured
                here.
              </p>
            </div>
          )}

          {selected?.role === "admin" && catalog && (
            <>
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {catalog.groups.map((g) => {
                  const keys = g.permissions.map((p) => p.key);
                  const on = keys.filter((k) => draft.includes(k)).length;
                  const state: boolean | "indeterminate" = on === 0 ? false : on === keys.length ? true : "indeterminate";
                  return (
                    <div key={g.key} className={cn(CARD, "p-4", on > 0 && "border-[#FFD3A8] dark:border-[#FF7A00]/30")}>
                      <label className="flex cursor-pointer items-center gap-3 border-b border-[#F3E8D8] pb-3 dark:border-white/10">
                        <Checkbox
                          checked={state}
                          disabled={saving}
                          onCheckedChange={(v) => setGroup(keys, v === true)}
                          aria-label={`Select all ${g.label} permissions`}
                        />
                        <span className="min-w-0 flex-1 text-sm font-bold text-[#0E1830] dark:text-white">{g.label}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[0.7rem] font-bold tabular-nums",
                            on ? "bg-[#FFF1E4] text-[#C25400] dark:bg-[#FF7A00]/15 dark:text-[#FFB35C]" : "bg-[#F3EEE6] text-[#8A7F70] dark:bg-white/10 dark:text-white/50",
                          )}
                        >
                          {on}/{keys.length}
                        </span>
                      </label>
                      <ul className="mt-2 space-y-0.5">
                        {g.permissions.map((p) => (
                          <li key={p.key}>
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1.5 py-1.5 hover:bg-[#FFF8EE] dark:hover:bg-white/5">
                              <Checkbox
                                className="mt-0.5"
                                checked={draft.includes(p.key)}
                                disabled={saving}
                                onCheckedChange={(v) => toggle(p.key, v === true)}
                              />
                              <span className="text-sm text-[#1A2B4A] dark:text-white/85">{p.label}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className={cn(CARD, "border-dashed p-5")}>
                <p className="flex items-center gap-2 text-sm font-bold text-[#0E1830] dark:text-white">
                  <Lock size="0.9375rem" className="text-[#E86A00]" /> Super Admin only (not assignable)
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {SUPER_ONLY_CAPABILITIES.map((c) => (
                    <li key={c} className="rounded-full bg-[#F3EEE6] px-3 py-1 text-xs font-medium text-[#5B6478] dark:bg-white/10 dark:text-white/60">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Sticky action bar */}
      {selected?.role === "admin" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EFE2CF] bg-white/95 backdrop-blur lg:left-64 dark:border-white/10 dark:bg-[#0B1424]/95">
          <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 lg:px-6">
            <p className={cn("mr-auto text-sm", dirty ? "font-semibold text-[#C25400] dark:text-[#FFB35C]" : "text-[#5B6478] dark:text-white/55")}>
              {dirty ? "You have unsaved changes" : "All changes saved"}
            </p>
            <button
              type="button"
              onClick={() => setDraft(saved)}
              disabled={!dirty || saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#EFE2CF] px-4 text-sm font-semibold text-[#1A2B4A] hover:bg-[#FFF8EE] disabled:opacity-40 dark:border-white/15 dark:text-white"
            >
              <RotateCcw size="0.9375rem" /> Reset
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF8A1F] to-[#E86A00] px-5 text-sm font-bold text-white shadow-[0_10px_20px_-12px_rgba(232,106,0,0.9)] disabled:opacity-40"
            >
              {saving ? <Loader2 size="0.9375rem" className="animate-spin" /> : <Save size="0.9375rem" />}
              {saving ? "Saving…" : "Save Permissions"}
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingSwitch} onOpenChange={(o) => !o && setPendingSwitch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed permissions for {selected?.name || "this admin"} without saving. Switching admins will discard those changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSwitch) select(pendingSwitch);
                setPendingSwitch(null);
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminPermissionsPage() {
  // Data loads inside the layout, so non–Super Admins (blocked by the layout) never request it.
  return (
    <AdminLayout>
      <PermissionsWorkspace />
    </AdminLayout>
  );
}
