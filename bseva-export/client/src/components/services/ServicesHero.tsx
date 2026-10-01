import { BookOpen, CalendarCheck, HandHeart, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

const NAVY = "#0A1630";

/** Cinematic devotional hero for the public Services page. */
export default function ServicesHero() {
  const { t } = useI18n();

  const trust = [
    { icon: ShieldCheck, title: t("sv.trust.authentic"), sub: t("sv.trust.authenticSub") },
    { icon: HandHeart, title: t("sv.trust.pujaris"), sub: t("sv.trust.pujarisSub") },
    { icon: CalendarCheck, title: t("sv.trust.booking"), sub: t("sv.trust.bookingSub") },
    { icon: BookOpen, title: t("sv.trust.occasion"), sub: t("sv.trust.occasionSub") },
  ];

  return (
    <section
      aria-labelledby="services-hero-title"
      className="relative isolate overflow-hidden text-white lg:flex lg:min-h-[22rem] lg:max-h-[36rem] lg:items-center"
      style={{ backgroundColor: NAVY }}
    >
      <div className="relative h-56 sm:h-72 md:h-80 lg:absolute lg:inset-0 lg:h-auto">
        <img
          src="/images/services-hero-puja.webp"
          alt={t("sv.hero.imgAlt")}
          width={1280}
          height={720}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-[55%_45%] lg:absolute lg:inset-y-0 lg:left-[10%] lg:h-full lg:w-[90%] lg:object-[right_center]"
        />
        <div
          className="absolute inset-0 lg:hidden"
          style={{ backgroundImage: `linear-gradient(to top, ${NAVY} 4%, ${NAVY}CC 38%, ${NAVY}66 62%, ${NAVY}00 88%)` }}
        />
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            backgroundImage: `linear-gradient(to right, ${NAVY} 0%, ${NAVY}F0 28%, ${NAVY}C8 42%, ${NAVY}55 58%, ${NAVY}18 72%, ${NAVY}00 86%)`,
          }}
        />
      </div>

      <MandalaOutline className="absolute -bottom-32 -left-32 hidden h-[28rem] w-[28rem] text-white opacity-[0.04] lg:block" />

      <div className="container relative z-10 -mt-10 pb-8 sm:-mt-14 sm:pb-10 lg:mt-0 lg:py-12">
        <div className="max-w-[40rem]">
          <p className="flex items-center gap-3 text-[0.625rem] font-bold uppercase leading-snug tracking-[0.2em] text-white/95 sm:text-[0.6875rem]">
            <span aria-hidden className="h-0.5 w-8 shrink-0 bg-brand-orange" />
            <span>{t("sv.hero.eyebrow")}</span>
          </p>

          <h1
            id="services-hero-title"
            className="mt-4 text-balance text-[clamp(2rem,1.1rem+3.2vw,3.25rem)] leading-[1.1] tracking-tight"
          >
            <span className="block font-display font-semibold text-white">{t("sv.hero.title1")}</span>
            <span className="mt-1 block font-bold text-brand-orange">{t("sv.hero.title2")}</span>
          </h1>

          <p className="mt-4 max-w-[34rem] text-sm font-medium leading-relaxed text-white/95 sm:text-base">
            {t("sv.hero.desc")}
          </p>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
            {trust.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-brand-orange/90 bg-[#0A1630]/40 text-brand-orange">
                  <Icon size={18} aria-hidden strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight text-white">{title}</span>
                  <span className="block text-xs font-medium leading-snug text-white/80">{sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
