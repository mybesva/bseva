import { BookOpen, CalendarCheck, HandHeart, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const NAVY = "#091526";

/**
 * Cinematic devotional hero for the public Services page.
 * Desktop sizes are fluid (cqw: share of the hero's own width) so the composition holds from
 * 1024px to 1920px+ wide, on the public page or inside a portal; tuned against the 1470px reference.
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
    // Sized by its own width (container query), not the viewport, so it also fits beside a portal sidebar.
    <div className="@container">
      <section
        aria-labelledby="services-hero-title"
        className="relative isolate overflow-hidden text-white @5xl:h-[clamp(440px,35.3cqw,680px)]"
        style={{ backgroundColor: NAVY }}
      >
        {/* Background: kalash photo anchored right, full height, never stretched */}
        <div className="relative h-56 sm:h-72 md:h-80 @5xl:absolute @5xl:inset-0 @5xl:h-auto">
          <img
            src="/images/services-hero-puja.webp"
            alt={t("sv.hero.imgAlt")}
            width={832}
            height={768}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-[55%_62%] @5xl:absolute @5xl:inset-y-0 @5xl:left-auto @5xl:right-0 @5xl:w-[62%] @5xl:object-[50%_74%]"
          />
          <div
            className="absolute inset-0 @5xl:hidden"
            style={{ backgroundImage: `linear-gradient(to top, ${NAVY} 4%, ${NAVY}CC 38%, ${NAVY}66 62%, ${NAVY}00 88%)` }}
          />
          {/* Navy → transparent so text side and photo read as one surface */}
          <div
            className="absolute inset-0 hidden @5xl:block"
            style={{
              backgroundImage: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 39%, ${NAVY}E0 45%, ${NAVY}99 52%, ${NAVY}40 60%, ${NAVY}10 68%, ${NAVY}00 74%)`,
            }}
          />
          {/* Soft floor shade keeps the benefit row legible where it crosses the photo */}
          <div
            className="absolute inset-0 hidden @5xl:block"
            style={{ backgroundImage: `linear-gradient(0deg, ${NAVY}B3 0%, ${NAVY}59 18%, ${NAVY}00 38%)` }}
          />
        </div>

        <div className="relative z-10 -mt-10 px-5 pb-8 sm:-mt-14 sm:px-8 sm:pb-10 @5xl:mt-0 @5xl:flex @5xl:h-full @5xl:flex-col @5xl:px-[6.5%] @5xl:pb-0 @5xl:pt-[4.3cqw]">
          <p className="text-[0.6875rem] font-extrabold uppercase leading-[1.5] tracking-[0.22em] text-white/95 @5xl:leading-none @5xl:text-[clamp(12px,1.02cqw,18px)] @5xl:tracking-[0.23em]">
            {t("sv.hero.eyebrow")}
          </p>

          <h1
            id="services-hero-title"
            className="mt-4 font-sans font-extrabold tracking-[-0.02em] @5xl:mt-[1.55cqw]"
          >
            <span className="block text-[clamp(2rem,7cqw,2.6rem)] leading-[1.08] text-white @5xl:text-[clamp(45px,3.76cqw,70px)] @5xl:leading-[1.06]">
              {t("sv.hero.title1")}
            </span>
            <span className="block text-[clamp(2.3rem,8cqw,3rem)] leading-[1.08] text-[#FF6A00] @5xl:text-[clamp(58px,4.95cqw,92px)] @5xl:leading-[1.02]">
              {t("sv.hero.title2")}
            </span>
          </h1>

          <p className="mt-4 max-w-[34rem] text-[0.9375rem] font-medium leading-[1.6] text-white/90 sm:text-base @5xl:mt-[1.85cqw] @5xl:max-w-[29.8em] @5xl:text-[clamp(17px,1.4cqw,26px)] @5xl:leading-[1.58]">
            {t("sv.hero.desc")}
          </p>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2 @5xl:mt-auto @5xl:mb-[3.1cqw] @5xl:grid-cols-[19.05cqw_21.15cqw_19.95cqw_auto] @5xl:gap-0">
            {trust.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex min-w-0 items-center gap-3 @5xl:gap-[0.95cqw]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D89018]/70 bg-[#091526]/50 @5xl:h-[clamp(54px,4.9cqw,90px)] @5xl:w-[clamp(54px,4.9cqw,90px)]">
                  <span className="flex h-[58%] w-[58%] items-center justify-center rounded-full bg-gradient-to-b from-[#FFA21F] to-[#E57A00] text-[#091526] shadow-[0_0_14px_rgba(255,140,0,0.35)]">
                    <Icon aria-hidden strokeWidth={2.1} className="h-[55%] w-[55%]" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-sm font-bold leading-tight text-white @5xl:text-[clamp(14px,1.2cqw,21px)]">
                    {title}
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap text-xs font-medium leading-snug text-white/70 @5xl:mt-[0.2cqw] @5xl:text-[clamp(12px,1.02cqw,18px)]">
                    {sub}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
