import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  CalendarCheck,
  CalendarClock,
  CheckCircle,
  Clock,
  FileWarning,
  HandCoins,
  IndianRupee,
  LifeBuoy,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  UserX,
  Video,
} from "lucide-react";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { adminPath } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

type Stats = {
  totalCustomers: number;
  activePriests: number;
  totalBookings: number;
  monthlyRevenue: number;
  pujariStatus: Record<string, number>;
};

type Overview = {
  todayBookings: number;
  month: { revenue: number; revenueLastMonth: number; bookings: number; bookingsLastMonth: number; newCustomers: number };
  attention: Record<
    | "awaitingPujari"
    | "unassigned"
    | "needsReassignment"
    | "inProgress"
    | "openTickets"
    | "overdueTickets"
    | "pendingVerification"
    | "pendingSettlements",
    number
  >;
  statusBreakdown: Record<string, number>;
  last7Days: { day: string; count: number }[];
  todaySchedule: {
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
  recentBookings: {
    id: string;
    booking_number: string;
    booking_date: string | null;
    status: string;
    total_paise: number;
    created_at: string;
    service_name: string | null;
    customer_name: string | null;
  }[];
  topServices: { name: string; count: number; revenue: number }[];
};

const STATUS_META: Record<string, { label: string; bar: string; chip: string }> = {
  pending: { label: "Pending", bar: "bg-amber-400", chip: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" },
  pending_acceptance: {
    label: "Awaiting pujari",
    bar: "bg-orange-400",
    chip: "bg-orange-50 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  },
  confirmed: { label: "Confirmed", bar: "bg-sky-500", chip: "bg-sky-50 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300" },
  in_progress: {
    label: "In progress",
    bar: "bg-violet-500",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  },
  completed: {
    label: "Completed",
    bar: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  cancelled: { label: "Cancelled", bar: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
  rejected: { label: "Rejected", bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300" },
};

const statusMeta = (s: string) =>
  STATUS_META[s] ?? {
    label: s.replace(/_/g, " "),
    bar: "bg-slate-300",
    chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  };

const fmt = (n: number | undefined | null) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));

function compactRupees(paise: number) {
  const r = Number(paise || 0) / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(2)} L`;
  return `₹${Math.round(r).toLocaleString("en-IN")}`;
}

function pctChange(now: number, prev: number): number | null {
  if (!prev) return now ? null : 0;
  return Math.round(((now - prev) / prev) * 100);
}

function formatTime(t: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const CARD =
  "rounded-3xl border border-[#EFE2CF] bg-white shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] dark:border-white/10 dark:bg-[#152238]";

function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(CARD, "flex flex-col p-5 sm:p-6", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-bold text-[#0E1830] dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
            <Icon size={16} />
          </span>
          {title}
        </h2>
        {action && (
          <Link href={action.href}>
            <a className="inline-flex items-center gap-1 text-xs font-semibold text-[#E86A00] hover:underline">
              {action.label} <ArrowRight size={13} />
            </a>
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  icon: ComponentType<{ size?: number; className?: string }>;
  href: string;
}) {
  return (
    <Link href={href}>
      <a className={cn(CARD, "group block p-5 transition hover:-translate-y-0.5 hover:border-[#FF7A00]/40")}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.8rem] font-semibold text-[#5B6478] dark:text-white/60">{label}</p>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF8A1F] to-[#E86A00] text-white shadow-[0_8px_18px_-10px_rgba(255,122,0,0.9)]">
            <Icon size={19} />
          </span>
        </div>
        <p className="mt-1 text-[1.7rem] font-bold leading-none tracking-tight text-[#0E1830] dark:text-white">{value}</p>
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {trend != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold",
                trend >= 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300"
              )}
            >
              {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub && <span className="truncate text-[#5B6478] dark:text-white/55">{sub}</span>}
        </div>
      </a>
    </Link>
  );
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([api<Stats>("/admin/stats"), api<Overview>("/admin/stats/overview")])
      .then(([s, o]) => {
        setStats(s);
        setOv(o);
      })
      .catch((e: any) => {
        setLoadError(e.message || "Failed to load dashboard stats");
        toast.error(e.message || "Failed to load dashboard stats");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void load();
  }, [authLoading, user?.id, load]);

  const a = ov?.attention;
  const ps = stats?.pujariStatus || {};
  const firstName = (user?.name || "Admin").trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const attention = [
    {
      label: "Awaiting pujari acceptance",
      value: a?.awaitingPujari,
      icon: Clock,
      tone: "amber",
      href: adminPath("/bookings?status=pending_acceptance"),
    },
    {
      label: "Unassigned bookings",
      value: a?.unassigned,
      icon: UserX,
      tone: "rose",
      href: adminPath("/bookings?assignment=unassigned"),
    },
    {
      label: "Needs reassignment",
      value: a?.needsReassignment,
      icon: RefreshCw,
      tone: "rose",
      href: adminPath("/bookings?status=needs_reassignment"),
    },
    {
      label: "Pujas in progress",
      value: a?.inProgress,
      icon: Loader2,
      tone: "violet",
      href: adminPath("/bookings?status=in_progress"),
    },
    {
      label: "Open support tickets",
      value: a?.openTickets,
      sub: a?.overdueTickets ? `${a.overdueTickets} past SLA` : undefined,
      icon: LifeBuoy,
      tone: a?.overdueTickets ? "rose" : "sky",
      href: adminPath("/support"),
    },
    {
      label: "Pujaris to verify",
      value: a?.pendingVerification,
      icon: ShieldCheck,
      tone: "amber",
      href: adminPath("/pujaris?status=pending"),
    },
    {
      label: "Settlements pending",
      value: a?.pendingSettlements,
      icon: HandCoins,
      tone: "emerald",
      href: adminPath("/settlements?status=pending"),
    },
  ] as const;

  const TONE: Record<string, string> = {
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  };

  const actionCount = a
    ? a.awaitingPujari + a.unassigned + a.needsReassignment + a.overdueTickets + a.pendingVerification
    : 0;

  const pujariStatus = [
    { label: "Approved", value: ps.active, icon: CheckCircle, cls: "text-emerald-600", href: "/pujaris?status=approved" },
    { label: "Pending", value: ps.pendingVerification, icon: Clock, cls: "text-amber-600", href: "/pujaris?status=pending" },
    {
      label: "Correction",
      value: ps.correctionRequired,
      icon: Pencil,
      cls: "text-orange-600",
      href: "/pujaris?status=correction_required",
    },
    { label: "Rejected", value: ps.rejected, icon: FileWarning, cls: "text-rose-600", href: "/pujaris?status=rejected" },
    { label: "Blocked", value: ps.blocked, icon: Ban, cls: "text-slate-500", href: "/pujaris?status=blocked" },
  ];

  const breakdown = Object.entries(ov?.statusBreakdown || {}).sort((x, y) => y[1] - x[1]);
  const breakdownTotal = breakdown.reduce((s, [, n]) => s + n, 0) || 1;
  const trend = ov?.last7Days || [];
  const trendMax = Math.max(1, ...trend.map((d) => d.count));
  const trendTotal = trend.reduce((s, d) => s + d.count, 0);
  const topMax = Math.max(1, ...(ov?.topServices || []).map((s) => s.count));

  return (
    <AdminLayout>
      <div className="soften-brand-mark space-y-6">
        {loadError && (
          <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            <AlertTriangle size={16} /> {loadError}
          </p>
        )}

        {/* ── Welcome banner ── */}
        <section className="relative isolate overflow-hidden rounded-3xl bg-[#071A33] px-6 py-7 text-white sm:px-8 sm:py-8">
          <MandalaOutline className="pointer-events-none absolute -right-24 -top-28 -z-10 h-[26rem] w-[26rem] text-[#E8B15A] opacity-[0.13]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_80%_at_85%_40%,rgba(255,122,0,0.22),transparent_70%)]" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/50 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#E8C46A]">
                <ShieldCheck size={13} /> Admin console
              </p>
              <h1 className="mt-3 text-[1.75rem] font-bold leading-tight sm:text-[2rem]">
                {greeting()}, <span className="text-[#FF9A2E]">{firstName}</span>
              </h1>
              <p className="mt-1.5 text-sm text-white/70">
                {today}
                {a && (
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
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:min-w-[27rem]">
              {[
                { label: "Today's pujas", value: fmt(ov?.todayBookings), icon: CalendarCheck },
                { label: "In progress", value: fmt(a?.inProgress), icon: Loader2 },
                { label: "Open tickets", value: fmt(a?.openTickets), icon: LifeBuoy },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm sm:p-4">
                  <s.icon size={16} className="text-[#FF9A2E]" />
                  <p className="mt-2 text-xl font-bold sm:text-2xl">{s.value}</p>
                  <p className="text-[0.7rem] text-white/65 sm:text-xs">{s.label}</p>
                </div>
              ))}
            </div>
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

        {/* ── KPIs ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Revenue this month"
            value={ov ? compactRupees(ov.month.revenue) : "—"}
            trend={ov ? pctChange(ov.month.revenue, ov.month.revenueLastMonth) : undefined}
            sub={ov ? `vs ${compactRupees(ov.month.revenueLastMonth)} last month` : undefined}
            icon={IndianRupee}
            href={adminPath("/payments")}
          />
          <Kpi
            label="Bookings this month"
            value={fmt(ov?.month.bookings)}
            trend={ov ? pctChange(ov.month.bookings, ov.month.bookingsLastMonth) : undefined}
            sub={stats ? `${fmt(stats.totalBookings)} all time` : undefined}
            icon={CalendarClock}
            href={adminPath("/bookings")}
          />
          <Kpi
            label="Customers"
            value={fmt(stats?.totalCustomers)}
            sub={ov ? `+${fmt(ov.month.newCustomers)} joined this month` : undefined}
            icon={Users}
            href={adminPath("/customers")}
          />
          <Kpi
            label="Active pujaris"
            value={fmt(stats?.activePriests)}
            sub={a ? `${fmt(a.pendingVerification)} awaiting verification` : undefined}
            icon={UserCog}
            href={adminPath("/pujaris?status=approved")}
          />
        </div>

        {/* ── Attention + today's schedule ── */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <Panel title="Needs attention" icon={AlertTriangle}>
            <ul className="space-y-2">
              {attention.map((it) => {
                const zero = !it.value;
                return (
                  <li key={it.label}>
                    <Link href={it.href}>
                      <a
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-[#EFE2CF] hover:bg-[#FFF8EE] dark:hover:border-white/10 dark:hover:bg-white/5",
                          zero && "opacity-60"
                        )}
                      >
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE[it.tone])}>
                          <it.icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#0E1830] dark:text-white">{it.label}</span>
                          {"sub" in it && it.sub && (
                            <span className="block text-xs font-semibold text-rose-600 dark:text-rose-300">{it.sub}</span>
                          )}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-[#0E1830] dark:text-white">{fmt(it.value)}</span>
                        <ArrowRight size={15} className="shrink-0 text-[#B9A58A]" />
                      </a>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            title={`Today's schedule${ov ? ` · ${fmt(ov.todayBookings)}` : ""}`}
            icon={CalendarCheck}
            action={{ label: "All bookings", href: adminPath("/bookings") }}
          >
            {ov && ov.todaySchedule.length === 0 ? (
              <p className="flex flex-1 items-center justify-center rounded-2xl bg-[#FFF8EE] py-10 text-sm text-[#5B6478] dark:bg-white/5 dark:text-white/60">
                No pujas scheduled for today.
              </p>
            ) : (
              <ul className="divide-y divide-[#F3E8D8] dark:divide-white/10">
                {(ov?.todaySchedule || []).map((b) => {
                  const m = statusMeta(b.status);
                  return (
                    <li key={b.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="w-[4.5rem] shrink-0 rounded-xl bg-[#071A33] px-2 py-1.5 text-center text-xs font-bold text-white">
                        {formatTime(b.start_time)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#0E1830] dark:text-white">
                          {b.service_name || "Puja"}
                          <span className="ml-1.5 font-normal text-[#5B6478] dark:text-white/50">· {b.customer_name || "Customer"}</span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#5B6478] dark:text-white/55">
                          {b.mode === "virtual" ? <Video size={12} /> : <MapPin size={12} />}
                          <span className="truncate">{b.mode === "virtual" ? "Virtual" : b.location_label || "On-site"}</span>
                          <span>·</span>
                          {b.pujari_name ? (
                            <span className="truncate">{b.pujari_name}</span>
                          ) : (
                            <span className="font-semibold text-rose-600 dark:text-rose-300">No pujari assigned</span>
                          )}
                        </p>
                      </div>
                      <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold sm:inline", m.chip)}>
                        {m.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── Trend · status breakdown · pujari status ── */}
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="Bookings · last 7 days" icon={TrendingUp}>
            <p className="-mt-2 mb-4 text-xs text-[#5B6478] dark:text-white/55">{fmt(trendTotal)} new bookings this week</p>
            <div className="flex h-40 items-end gap-2">
              {trend.map((d) => {
                const date = new Date(`${d.day}T00:00:00`);
                const isToday = d.day === trend[trend.length - 1]?.day;
                return (
                  <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[0.7rem] font-bold text-[#0E1830] dark:text-white">{d.count}</span>
                    <div
                      className={cn(
                        "w-full max-w-[2.5rem] rounded-t-lg",
                        isToday ? "bg-gradient-to-t from-[#E86A00] to-[#FF9A2E]" : "bg-[#071A33]/85 dark:bg-white/25"
                      )}
                      style={{ height: `${Math.max(4, (d.count / trendMax) * 100)}%` }}
                    />
                    <span className={cn("text-[0.7rem]", isToday ? "font-bold text-[#E86A00]" : "text-[#5B6478] dark:text-white/55")}>
                      {date.toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Booking status" icon={CalendarClock} action={{ label: "View", href: adminPath("/bookings") }}>
            <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-[#F3E8D8] dark:bg-white/10">
              {breakdown.map(([s, n]) => (
                <div key={s} className={statusMeta(s).bar} style={{ width: `${(n / breakdownTotal) * 100}%` }} title={`${statusMeta(s).label}: ${n}`} />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {breakdown.map(([s, n]) => (
                <li key={s}>
                  <Link href={adminPath(`/bookings?status=${s}`)}>
                    <a className="flex items-center gap-2 text-sm hover:underline">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusMeta(s).bar)} />
                      <span className="min-w-0 flex-1 truncate capitalize text-[#5B6478] dark:text-white/65">{statusMeta(s).label}</span>
                      <span className="font-bold tabular-nums text-[#0E1830] dark:text-white">{fmt(n)}</span>
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Pujari verification"
            icon={ShieldCheck}
            action={{ label: "Manage", href: adminPath("/pujaris") }}
            className="lg:col-span-2 xl:col-span-1"
          >
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 xl:grid-cols-2">
              {pujariStatus.map((p, i) => (
                <li key={p.label} className={cn(i === 0 && "xl:col-span-2")}>
                  <Link href={adminPath(p.href)}>
                    <a className="flex items-center gap-2.5 rounded-2xl bg-[#FFF8EE] px-3 py-2.5 transition hover:bg-[#FFF1E4] dark:bg-white/5 dark:hover:bg-white/10">
                      <p.icon size={18} className={p.cls} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#5B6478] dark:text-white/65">{p.label}</span>
                      <span className="text-base font-bold tabular-nums text-[#0E1830] dark:text-white">{fmt(p.value)}</span>
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* ── Recent bookings · top services ── */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Panel title="Recent bookings" icon={UserPlus} action={{ label: "All bookings", href: adminPath("/bookings") }}>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="text-left text-[0.7rem] uppercase tracking-wider text-[#8A7F70] dark:text-white/45">
                    <th className="px-2 pb-2 font-semibold">Booking</th>
                    <th className="px-2 pb-2 font-semibold">Customer</th>
                    <th className="px-2 pb-2 font-semibold">Puja date</th>
                    <th className="px-2 pb-2 font-semibold">Status</th>
                    <th className="px-2 pb-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3E8D8] dark:divide-white/10">
                  {(ov?.recentBookings || []).map((b) => {
                    const m = statusMeta(b.status);
                    return (
                      <tr key={b.id}>
                        <td className="px-2 py-2.5">
                          <p className="max-w-[13rem] truncate font-semibold text-[#0E1830] dark:text-white">{b.service_name || "Puja"}</p>
                          <p className="text-xs text-[#8A7F70] dark:text-white/45">
                            {b.booking_number} · {timeAgo(b.created_at)}
                          </p>
                        </td>
                        <td className="max-w-[9rem] truncate px-2 py-2.5 text-[#1A2B4A] dark:text-white/80">{b.customer_name || "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-[#1A2B4A] dark:text-white/80">
                          {b.booking_date
                            ? new Date(`${b.booking_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                            : "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", m.chip)}>{m.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-bold text-[#0E1830] dark:text-white">
                          {compactRupees(b.total_paise)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Top pujas · 30 days" icon={TrendingUp} action={{ label: "Services", href: adminPath("/services") }}>
            <ol className="space-y-3.5">
              {(ov?.topServices || []).map((s, i) => (
                <li key={s.name}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        i === 0 ? "bg-gradient-to-br from-[#F0C35A] to-[#C98A1A] text-[#071A33]" : "bg-[#071A33] text-white dark:bg-white/15"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0E1830] dark:text-white">{s.name}</span>
                    <span className="text-xs text-[#5B6478] dark:text-white/55">{fmt(s.count)} bookings</span>
                  </div>
                  <div className="ml-10 mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F3E8D8] dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#FF8A1F] to-[#E86A00]" style={{ width: `${(s.count / topMax) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs font-bold text-[#0E1830] dark:text-white">{compactRupees(s.revenue)}</span>
                  </div>
                </li>
              ))}
              {ov && ov.topServices.length === 0 && (
                <p className="text-sm text-[#5B6478] dark:text-white/60">No bookings in the last 30 days.</p>
              )}
            </ol>
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}
