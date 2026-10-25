import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/** Shared building blocks for the Super Admin and operational Admin dashboards. */

export const STATUS_META: Record<string, { label: string; bar: string; chip: string }> = {
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

export const statusMeta = (s: string) =>
  STATUS_META[s] ?? {
    label: s.replace(/_/g, " "),
    bar: "bg-slate-300",
    chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  };

export const fmt = (n: number | undefined | null) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));

export function compactRupees(paise: number) {
  const r = Number(paise || 0) / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(2)} L`;
  return `₹${Math.round(r).toLocaleString("en-IN")}`;
}

export function pctChange(now: number, prev: number): number | null {
  if (!prev) return now ? null : 0;
  return Math.round(((now - prev) / prev) * 100);
}

export function formatTime(t: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const CARD =
  "rounded-3xl border border-[#EFE2CF] bg-white shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] dark:border-white/10 dark:bg-[#152238]";

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(CARD, "flex flex-col p-5 sm:p-6", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-bold text-[#0E1830] dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
            <Icon size="1rem" />
          </span>
          {title}
        </h2>
        {action && (
          <Link href={action.href}>
            <a className="inline-flex items-center gap-1 text-xs font-semibold text-[#E86A00] hover:underline">
              {action.label} <ArrowRight size="0.8125rem" />
            </a>
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export function Kpi({
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
  icon: ComponentType<{ size?: number | string; className?: string }>;
  href: string;
}) {
  return (
    <Link href={href}>
      <a className={cn(CARD, "group block p-5 transition hover:-translate-y-0.5 hover:border-[#FF7A00]/40")}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.8rem] font-semibold text-[#5B6478] dark:text-white/60">{label}</p>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF8A1F] to-[#E86A00] text-white shadow-[0_8px_18px_-10px_rgba(255,122,0,0.9)]">
            <Icon size="1.1875rem" />
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
              {trend >= 0 ? <ArrowUpRight size="0.75rem" /> : <ArrowDownRight size="0.75rem" />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub && <span className="truncate text-[#5B6478] dark:text-white/55">{sub}</span>}
        </div>
      </a>
    </Link>
  );
}
