import { BookOpen, CalendarCheck, HandHeart, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const NAVY = "#091526";

/**
 * Cinematic devotional hero for the public Services page.
 * Desktop sizes are fluid (vw-based) so the composition holds from 1280px to 1920px+
 * instead of snapping between breakpoints; tuned against the 1470px reference.
 */
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
      className="relative isolate overflow-hidden text-white lg:h-[clamp(440px,35.3vw,680px)]"
      style={{ backgroundColor: NAVY }}
    >
      {/* Background: kalash photo anchored right, full height, never stretched */}
      <div className="relative h-56 sm:h-72 md:h-80 lg:absolute lg:inset-0 lg:h-auto">
        <img
          src="/images/services-hero-puja.webp"
          alt={t("sv.hero.imgAlt")}
          width={832}
          height={768}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-[55%_62%] lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[62%] lg:object-[50%_74%]"
        />
        <div
          className="absolute inset-0 lg:hidden"
          style={{ backgroundImage: `linear-gradient(to top, ${NAVY} 4%, ${NAVY}CC 38%, ${NAVY}66 62%, ${NAVY}00 88%)` }}
        />
        {/* Navy → transparent so text side and photo read as one surface */}
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            backgroundImage: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 39%, ${NAVY}E0 45%, ${NAVY}99 52%, ${NAVY}40 60%, ${NAVY}10 68%, ${NAVY}00 74%)`,
          }}
        />
        {/* Soft floor shade keeps the benefit row legible where it crosses the photo */}
        <div
          className="absolute inset-0 hidden lg:block"
          style={{ backgroundImage: `linear-gradient(0deg, ${NAVY}B3 0%, ${NAVY}59 18%, ${NAVY}00 38%)` }}
        />
      </div>

      <div className="relative z-10 -mt-10 px-5 pb-8 sm:-mt-14 sm:px-8 sm:pb-10 lg:mt-0 lg:flex lg:h-full lg:flex-col lg:px-[6.5%] lg:pb-0 lg:pt-[4.3vw]">
        <p className="text-[11px] font-extrabold uppercase leading-[1.5] tracking-[0.22em] text-white/95 lg:leading-none lg:text-[clamp(12px,1.02vw,18px)] lg:tracking-[0.23em]">
          {t("sv.hero.eyebrow")}
        </p>

        <h1
          id="services-hero-title"
          className="mt-4 font-sans font-extrabold tracking-[-0.02em] lg:mt-[1.55vw]"
        >
          <span className="block text-[clamp(2rem,7vw,2.6rem)] leading-[1.08] text-white lg:text-[clamp(45px,3.76vw,70px)] lg:leading-[1.06]">
            {t("sv.hero.title1")}
          </span>
          <span className="block text-[clamp(2.3rem,8vw,3rem)] leading-[1.08] text-[#FF6A00] lg:text-[clamp(58px,4.95vw,92px)] lg:leading-[1.02]">
            {t("sv.hero.title2")}
          </span>
        </h1>

        <p className="mt-4 max-w-[34rem] text-[15px] font-medium leading-[1.6] text-white/90 sm:text-base lg:mt-[1.85vw] lg:max-w-[29.8em] lg:text-[clamp(17px,1.4vw,26px)] lg:leading-[1.58]">
          {t("sv.hero.desc")}
        </p>

        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:mt-auto lg:mb-[3.1vw] lg:grid-cols-[19.05vw_21.15vw_19.95vw_auto] lg:gap-0">
          {trust.map(({ icon: Icon, title, sub }) => (
            <li key={title} className="flex min-w-0 items-center gap-3 lg:gap-[0.95vw]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D89018]/70 bg-[#091526]/50 lg:h-[clamp(54px,4.9vw,90px)] lg:w-[clamp(54px,4.9vw,90px)]">
                <span className="flex h-[58%] w-[58%] items-center justify-center rounded-full bg-gradient-to-b from-[#FFA21F] to-[#E57A00] text-[#091526] shadow-[0_0_14px_rgba(255,140,0,0.35)]">
                  <Icon aria-hidden strokeWidth={2.1} className="h-[55%] w-[55%]" />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-bold leading-tight text-white lg:text-[clamp(14px,1.2vw,21px)]">
                  {title}
                </span>
                <span className="mt-0.5 block whitespace-nowrap text-xs font-medium leading-snug text-white/70 lg:mt-[0.2vw] lg:text-[clamp(12px,1.02vw,18px)]">
                  {sub}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
