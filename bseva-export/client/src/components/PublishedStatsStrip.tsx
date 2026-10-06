import { Calendar, MapPin, Star, Users } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

/** Faint temple gopuram along the statistics strip edges. Decorative only. */
function TempleEdge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 220" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M80 8l10 16h-6l8 14h-8l10 16H46l10-16h-8l8-14h-6L80 8z" />
      <path d="M38 54h84v8H38zM34 66h92v10H34zM28 80h104v12H28z" />
      <path d="M24 96h112v124H24z" />
      <path d="M40 112h16v28H40zM72 108h16v32H72zM104 112h16v28H104z" />
      <path d="M48 160h64v60H48z" />
      <path d="M8 208h144" />
    </svg>
  );
}

/**
 * Published marketing figures already used on About, Contact, and the mobile About screen.
 * They are not live counts from the bookings API.
 */
const PUBLISHED_STATS = [
  { icon: Users, value: "500+", label: "ab.stat1" },
  { icon: Calendar, value: "10k+", label: "ab.stat2" },
  { icon: MapPin, value: "15+", label: "ab.stat3" },
  { icon: Star, value: "4.9", label: "ab.stat4" },
] as const;

export function PublishedStatsStrip() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden bg-sidebar text-white" aria-label={t("ab.stat1")}>
      <TempleEdge className="absolute -left-6 bottom-0 h-full w-36 text-white opacity-[0.14] sm:w-44" />
      <TempleEdge className="absolute -right-6 bottom-0 h-full w-36 -scale-x-100 text-white opacity-[0.14] sm:w-44" />
      <ul className="container relative grid grid-cols-2 gap-y-8 py-10 sm:py-12 lg:grid-cols-4 lg:divide-x lg:divide-white/15 lg:py-14">
        {PUBLISHED_STATS.map(({ icon: Icon, value, label }) => (
          <li key={label} className="flex flex-col items-center px-3 text-center">
            <Icon size={22} strokeWidth={1.75} className="text-[#FF7A00]" aria-hidden />
            <p className="mt-2 text-3xl font-bold tracking-tight text-[#FF7A00] sm:text-4xl">{value}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white sm:text-xs">{t(label)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
