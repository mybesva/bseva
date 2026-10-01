import { CalendarDays, Flame, Flower2, Home, Sparkles, User } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import LandingPhoneFrame from "./LandingPhoneFrame";

/** Illustrative in-hero app UI (decorative). */
export default function LandingHeroAppPreview({ className }: { className?: string }) {
  const { t } = useI18n();

  const categories = [
    { icon: Flower2, label: t("services.pujas") },
    { icon: Flame, label: t("services.havans") },
    { icon: Sparkles, label: t("services.ceremonies") },
  ];

  const tabs = [
    { icon: Home, label: t("nav.home"), active: true },
    { icon: CalendarDays, label: t("lp.hero.app.bookings") },
    { icon: User, label: t("nav.profile") },
  ];

  return (
    <LandingPhoneFrame className={className}>
      <div className="flex h-full flex-col px-3 pb-2 pt-8 text-[#0E1830]">
        <div className="flex items-center gap-2">
          <img src="/bseva-logo-transparent.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          <span className="text-[0.65rem] font-extrabold tracking-wide">B-SEVA</span>
        </div>

        <div className="mt-3 rounded-lg bg-primary py-2 text-center text-[0.62rem] font-extrabold text-primary-foreground shadow-md">
          {t("lp.cta.book")}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {categories.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-lg bg-white px-1 py-2 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon size={14} strokeWidth={1.75} />
              </span>
              <span className="line-clamp-2 text-center text-[0.45rem] font-bold leading-tight">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex-1 space-y-2">
          <div className="h-16 rounded-lg bg-white shadow-sm" />
          <div className="h-16 rounded-lg bg-white/90 shadow-sm" />
        </div>

        <div className="mt-2 flex items-center justify-around rounded-xl bg-white px-1 py-2 shadow-md">
          {tabs.map(({ icon: Icon, label, active }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-1">
              <Icon size={14} className={active ? "text-primary" : "text-[#0E1830]/45"} strokeWidth={1.75} />
              <span className={`text-[0.42rem] font-bold ${active ? "text-primary" : "text-[#0E1830]/55"}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </LandingPhoneFrame>
  );
}
