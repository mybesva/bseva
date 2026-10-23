import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Clock,
  Clock3,
  LayoutGrid,
  LifeBuoy,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  UserX,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { adminPath } from "@/const";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";
import { CARD, Kpi, Panel, fmt, formatTime, greeting, statusMeta, timeAgo } from "@/components/admin/dashboardKit";

/**
 * GET /admin/dashboard/ops: sections are present only for modules the admin may access, and
 * the payload never contains money (no revenue, fees, payouts or settlements).
 */
type OpsDashboardData = {
  role: string;
  sections: string[];
  customers?: {
    total: number;
    new_this_month: number;
    new_last_7_days: number;
    recent: { id: string; name: string | null; created_at: string; city: string | null }[];
  };
  pujaris?: {
    total: number;
    approved: number;
    pending_verification: number;
    correction_required: number;
    recent: { id: string; name: string | null; verification_status: string | null; city: string | null; created_at: string }[];
  };
  bookings?: {
    today: number;
    upcoming: number;
    pending_acceptance: number;
    unassigned: number;
    needs_reassignment: number;
    in_progress: number;
    completed_this_month: number;
    cancelled_this_month: number;
    status_breakdown: Record<string, number>;
    last_7_days: { day: string; count: number }[];
    today_schedule: {
      id: string;
      booking_number: string;
      start_time: string | null;
      status: string;
      mode: string | null;
      location_label: string | null;
      service_name: string | null;
      customer_name: string | null;
      pujari_name: string | null;
    }[];
    recent: {
      id: string;
      booking_number: string;
      booking_date: string | null;
      status: string;
      mode: string | null;
      created_at: string;
      service_name: string | null;
      customer_name: string | null;
    }[];
  };
  top_services?: { name: string; count: number }[];
  virtual_puja?: { today: number; upcoming: number; unassigned: number };
  services?: { active: number; inactive: number };
  reviews?: { pending: number };
  muhurtham?: { requested: number; in_progress: number };
  seva_events?: { upcoming: number };
  support?: { open: number; overdue: number };
};

const TONE: Record<string, string> = {
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
};

type AttentionItem = {
  label: string;
  value: number;
  sub?: string;
  icon: typeof Clock;
  tone: keyof typeof TONE;
  href: string;
};

const PUJARI_STATUS: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  under_review: "bg-sky-50 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  correction_required: "bg-orange-50 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
};

export default function OpsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<OpsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return api<OpsDashboardData>("/admin/dashboard/ops")
      .then(setData)
      .catch((e: any) => {
        setLoadError(e.message || "Failed to load dashboard");
        toast.error(e.message || "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = (user?.name || "Admin").trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const b = data?.bookings;
  const has = (s: string) => !!data?.sections.includes(s);

  const attention: AttentionItem[] = [];
  if (b) {
    attention.push(
      { label: "Awaiting pujari acceptance", value: b.pending_acceptance, icon: Clock, tone: "amber", href: adminPath("/bookings?status=pending_acceptance") },
      { label: "Unassigned bookings", value: b.unassigned, icon: UserX, tone: "rose", href: adminPath("/bookings?assignment=unassigned") },
      { label: "Needs reassignment", value: b.needs_reassignment, icon: RefreshCw, tone: "rose", href: adminPath("/bookings?status=needs_reassignment") },
    );
  }
  if (data?.virtual_puja) {
    attention.push({ label: "Virtual pujas without a pujari", value: data.virtual_puja.unassigned, icon: Video, tone: "violet", href: adminPath("/virtual-puja") });
  }
  if (data?.pujaris) {
    attention.push({ label: "Pujaris to verify", value: data.pujaris.pending_verification, icon: ShieldCheck, tone: "amber", href: adminPath("/pujaris?status=pending") });
  }
  if (data?.reviews) {
    attention.push({ label: "Reviews awaiting moderation", value: data.reviews.pending, icon: Star, tone: "sky", href: adminPath("/reviews") });
  }
  if (data?.muhurtham) {
    attention.push({ label: "New muhurtham requests", value: data.muhurtham.requested, icon: Clock3, tone: "violet", href: adminPath("/muhurtham") });
  }
  if (data?.support) {
    attention.push({
      label: "Open support tickets",
      value: data.support.open,
      sub: data.support.overdue ? `${data.support.overdue} past SLA` : undefined,
      icon: LifeBuoy,
      tone: data.support.overdue ? "rose" : "sky",
      href: adminPath("/support"),
    });
  }
  const actionCount = attention.reduce((n, a) => n + (a.value || 0), 0);

  const bannerStats = [
    b && { label: "Today's pujas", value: fmt(b.today), icon: CalendarCheck },
    b && { label: "In progress", value: fmt(b.in_progress), icon: Loader2 },
    data?.support && { label: "Open tickets", value: fmt(data.support.open), icon: LifeBuoy },
    !b && data?.customers && { label: "Customers", value: fmt(data.customers.total), icon: Users },
    !b && data?.pujaris && { label: "Pujaris", value: fmt(data.pujaris.total), icon: UserCog },
  ].filter(Boolean).slice(0, 3) as { label: string; value: string; icon: typeof Clock }[];

  const kpis = [
    data?.customers && {
      label: "Customers",
      value: fmt(data.customers.total),
      sub: `+${fmt(data.customers.new_this_month)} joined this month`,
      icon: Users,
      href: adminPath("/customers"),
    },
    data?.pujaris && {
      label: "Pujaris",
      value: fmt(data.pujaris.total),
      sub: `${fmt(data.pujaris.approved)} approved · ${fmt(data.pujaris.pending_verification)} pending`,
      icon: UserCog,
      href: adminPath("/pujaris"),
    },
    b && {
      label: "Upcoming bookings",
      value: fmt(b.upcoming),
      sub: `${fmt(b.today)} today`,
      icon: CalendarClock,
      href: adminPath("/bookings"),
    },
    b && {
      label: "Completed this month",
      value: fmt(b.completed_this_month),
      sub: `${fmt(b.cancelled_this_month)} cancelled this month`,
      icon: CalendarCheck,
      href: adminPath("/bookings?status=completed"),
    },
    data?.virtual_puja && {
      label: "Virtual & online pujas",
      value: fmt(data.virtual_puja.upcoming),
      sub: `${fmt(data.virtual_puja.today)} today`,
      icon: Video,
      href: adminPath("/virtual-puja"),
    },
    data?.services && {
      label: "Active services",
      value: fmt(data.services.active),
      sub: `${fmt(data.services.inactive)} inactive`,
      icon: Sparkles,
      href: adminPath("/services"),
    },
    data?.seva_events && {
      label: "Upcoming seva events",
      value: fmt(data.seva_events.upcoming),
      icon: CalendarClock,
      href: adminPath("/seva-events"),
    },
  ].filter(Boolean) as { label: string; value: string; sub?: string; icon: typeof Clock; href: string }[];

  const breakdown = Object.entries(b?.status_breakdown || {}).sort((x, y) => y[1] - x[1]);
  const breakdownTotal = breakdown.reduce((s, [, n]) => s + n, 0) || 1;
  const trend = b?.last_7_days || [];
  const trendMax = Math.max(1, ...trend.map((d) => d.count));
  const trendTotal = trend.reduce((s, d) => s + d.count, 0);
  const topMax = Math.max(1, ...(data?.top_services || []).map((s) => s.count));
  const noModules = !!data && data.sections.length === 0;

  return (
    <div className="soften-brand-mark space-y-6">
      {loadError && (
        <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertTriangle size={16} /> {loadError}
        </p>
      )}

      {/* Welcome banner */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#071A33] px-6 py-7 text-white sm:px-8 sm:py-8">
        <MandalaOutline className="pointer-events-none absolute -right-24 -top-28 -z-10 h-[26rem] w-[26rem] text-[#E8B15A] opacity-[0.13]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_80%_at_85%_40%,rgba(255,122,0,0.22),transparent_70%)]" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/50 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#E8C46A]">
              <LayoutGrid size={13} /> Operations console
            </p>
            <h1 className="mt-3 text-[1.75rem] font-bold leading-tight sm:text-[2rem]">
              {greeting()}, <span className="text-[#FF9A2E]">{firstName}</span>
            </h1>
            <p className="mt-1.5 text-sm text-white/70">
              {today}
              {data && attention.length > 0 && (
                <>
                  {" · "}
                  {actionCount > 0 ? (
                    <span className="font-semibold text-[#FFB35C]">{fmt(actionCount)} items need your attention</span>
                  ) : (
                    <span className="font-semibold text-emerald-300">All caught up</span>
                  )}
                </>
              )}
            </p>
          </div>
          {bannerStats.length > 0 && (
            <div className={cn("grid gap-2.5 sm:gap-3 lg:min-w-[27rem]", bannerStats.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {bannerStats.map((st) => (
                <div key={st.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm sm:p-4">
                  <st.icon size={16} className="text-[#FF9A2E]" />
                  <p className="mt-2 text-xl font-bold sm:text-2xl">{st.value}</p>
                  <p className="text-[0.7rem] text-white/65 sm:text-xs">{st.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          aria-label="Refresh dashboard"
          title="Refresh"
        >
          <RefreshCw size={16} className={cn(loading && "animate-spin")} />
        </button>
      </section>

      {noModules && (
        <section className={cn(CARD, "p-8 text-center")}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E4] text-[#E86A00] dark:bg-[#FF7A00]/15">
            <ShieldCheck size={22} />
          </span>
          <h2 className="mt-3 text-lg font-bold text-[#0E1830] dark:text-white">No modules assigned yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5B6478] dark:text-white/60">
            Your account doesn&apos;t have any back-office permissions. Ask a Super Admin to assign the modules you work on.
          </p>
        </section>
      )}

      {kpis.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.slice(0, 8).map((k) => (
            <Kpi key={k.label} label={k.label} value={k.value} sub={k.sub} icon={k.icon} href={k.href} />
          ))}
        </div>
      )}

      {(attention.length > 0 || b) && (
        <div className={cn("grid gap-6", attention.length > 0 && b && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]")}>
          {attention.length > 0 && (
            <Panel title="Needs attention" icon={AlertTriangle}>
              <ul className="space-y-2">
                {attention.map((it) => (
                  <li key={it.label}>
                    <Link href={it.href}>
                      <a
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-[#EFE2CF] hover:bg-[#FFF8EE] dark:hover:border-white/10 dark:hover:bg-white/5",
                          !it.value && "opacity-60",
                        )}
                      >
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE[it.tone])}>
                          <it.icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#0E1830] dark:text-white">{it.label}</span>
                          {it.sub && <span className="block text-xs font-semibold text-rose-600 dark:text-rose-300">{it.sub}</span>}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-[#0E1830] dark:text-white">{fmt(it.value)}</span>
                        <ArrowRight size={15} className="shrink-0 text-[#B9A58A]" />
                      </a>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {b && (
            <Panel title={`Today's schedule · ${fmt(b.today)}`} icon={CalendarCheck} action={{ label: "All bookings", href: adminPath("/bookings") }}>
              {b.today_schedule.length === 0 ? (
                <p className="flex flex-1 items-center justify-center rounded-2xl bg-[#FFF8EE] py-10 text-sm text-[#5B6478] dark:bg-white/5 dark:text-white/60">
                  No pujas scheduled for today.
                </p>
              ) : (
                <ul className="divide-y divide-[#F3E8D8] dark:divide-white/10">
                  {b.today_schedule.map((row) => {
                    const m = statusMeta(row.status);
                    return (
                      <li key={row.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="w-[4.5rem] shrink-0 rounded-xl bg-[#071A33] px-2 py-1.5 text-center text-xs font-bold text-white">
                          {formatTime(row.start_time)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#0E1830] dark:text-white">
                            {row.service_name || "Puja"}
                            <span className="ml-1.5 font-normal text-[#5B6478] dark:text-white/50">· {row.customer_name || "Customer"}</span>
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#5B6478] dark:text-white/55">
                            {row.mode === "virtual" ? <Video size={12} /> : <MapPin size={12} />}
                            <span className="truncate">{row.mode === "virtual" ? "Virtual" : row.location_label || "On-site"}</span>
                            <span>·</span>
                            {row.pujari_name ? (
                              <span className="truncate">{row.pujari_name}</span>
                            ) : (
                              <span className="font-semibold text-rose-600 dark:text-rose-300">No pujari assigned</span>
                            )}
                          </p>
                        </div>
                        <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold sm:inline", m.chip)}>{m.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}

      {b && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Bookings · last 7 days" icon={TrendingUp}>
            <p className="-mt-2 mb-4 text-xs text-[#5B6478] dark:text-white/55">{fmt(trendTotal)} new bookings this week</p>
            <div className="flex h-40 items-end gap-2">
              {trend.map((d, i) => {
                const isToday = i === trend.length - 1;
                return (
                  <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[0.7rem] font-bold text-[#0E1830] dark:text-white">{d.count}</span>
                    <div
                      className={cn("w-full max-w-[2.5rem] rounded-t-lg", isToday ? "bg-gradient-to-t from-[#E86A00] to-[#FF9A2E]" : "bg-[#071A33]/85 dark:bg-white/25")}
                      style={{ height: `${Math.max(4, (d.count / trendMax) * 100)}%` }}
                    />
                    <span className={cn("text-[0.7rem]", isToday ? "font-bold text-[#E86A00]" : "text-[#5B6478] dark:text-white/55")}>
                      {new Date(`${d.day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Booking status" icon={CalendarClock} action={{ label: "View", href: adminPath("/bookings") }}>
            <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-[#F3E8D8] dark:bg-white/10">
              {breakdown.map(([st, n]) => (
                <div key={st} className={statusMeta(st).bar} style={{ width: `${(n / breakdownTotal) * 100}%` }} title={`${statusMeta(st).label}: ${n}`} />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {breakdown.map(([st, n]) => (
                <li key={st}>
                  <Link href={adminPath(`/bookings?status=${st}`)}>
                    <a className="flex items-center gap-2 text-sm hover:underline">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusMeta(st).bar)} />
                      <span className="min-w-0 flex-1 truncate text-[#5B6478] dark:text-white/65">{statusMeta(st).label}</span>
                      <span className="font-bold tabular-nums text-[#0E1830] dark:text-white">{fmt(n)}</span>
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {(b || has("top_services")) && (
        <div className={cn("grid gap-6", b && has("top_services") && "xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
          {b && (
            <Panel title="Recent bookings" icon={UserPlus} action={{ label: "All bookings", href: adminPath("/bookings") }}>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="text-left text-[0.7rem] uppercase tracking-wider text-[#8A7F70] dark:text-white/45">
                      <th className="px-2 pb-2 font-semibold">Booking</th>
                      <th className="px-2 pb-2 font-semibold">Customer</th>
                      <th className="px-2 pb-2 font-semibold">Puja date</th>
                      <th className="px-2 pb-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3E8D8] dark:divide-white/10">
                    {b.recent.map((row) => {
                      const m = statusMeta(row.status);
                      return (
                        <tr key={row.id}>
                          <td className="px-2 py-2.5">
                            <p className="max-w-[14rem] truncate font-semibold text-[#0E1830] dark:text-white">{row.service_name || "Puja"}</p>
                            <p className="text-xs text-[#8A7F70] dark:text-white/45">
                              {row.booking_number} · {timeAgo(row.created_at)}
                            </p>
                          </td>
                          <td className="max-w-[10rem] truncate px-2 py-2.5 text-[#1A2B4A] dark:text-white/80">{row.customer_name || "—"}</td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-[#1A2B4A] dark:text-white/80">
                            {row.booking_date
                              ? new Date(`${row.booking_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                              : "—"}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", m.chip)}>{m.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {has("top_services") && (
            <Panel title="Top pujas · 30 days" icon={TrendingUp}>
              <ol className="space-y-3.5">
                {(data?.top_services || []).map((s, i) => (
                  <li key={s.name}>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          i === 0 ? "bg-gradient-to-br from-[#F0C35A] to-[#C98A1A] text-[#071A33]" : "bg-[#071A33] text-white dark:bg-white/15",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0E1830] dark:text-white">{s.name}</span>
                      <span className="text-xs font-semibold text-[#5B6478] dark:text-white/55">{fmt(s.count)} bookings</span>
                    </div>
                    <div className="ml-10 mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3E8D8] dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#FF8A1F] to-[#E86A00]" style={{ width: `${(s.count / topMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {(data?.top_services || []).length === 0 && (
                  <p className="text-sm text-[#5B6478] dark:text-white/60">No bookings in the last 30 days.</p>
                )}
              </ol>
            </Panel>
          )}
        </div>
      )}

      {(data?.customers || data?.pujaris) && (
        <div className={cn("grid gap-6", data?.customers && data?.pujaris && "lg:grid-cols-2")}>
          {data?.customers && (
            <Panel title="Newest customers" icon={Users} action={{ label: "All customers", href: adminPath("/customers") }}>
              <ul className="divide-y divide-[#F3E8D8] dark:divide-white/10">
                {data.customers.recent.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#071A33] text-xs font-bold text-white">
                      {(c.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#0E1830] dark:text-white">{c.name || "Customer"}</span>
                      <span className="block truncate text-xs text-[#5B6478] dark:text-white/55">{c.city || "—"}</span>
                    </span>
                    <span className="shrink-0 text-xs text-[#8A7F70] dark:text-white/45">{timeAgo(c.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {data?.pujaris && (
            <Panel title="Recently registered pujaris" icon={UserCog} action={{ label: "All pujaris", href: adminPath("/pujaris") }}>
              <ul className="divide-y divide-[#F3E8D8] dark:divide-white/10">
                {data.pujaris.recent.map((p) => {
                  const st = p.verification_status || "pending";
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8A1F] to-[#E86A00] text-xs font-bold text-white">
                        {(p.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#0E1830] dark:text-white">{p.name || "Pujari"}</span>
                        <span className="block truncate text-xs text-[#5B6478] dark:text-white/55">{p.city || "—"}</span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold capitalize", PUJARI_STATUS[st] || PUJARI_STATUS.pending)}>
                        {st.replace(/_/g, " ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
