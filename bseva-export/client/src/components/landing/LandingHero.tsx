import { Link } from "wouter";
import { ArrowRight, Eye, Flower2, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline } from "./DevotionalPatterns";

const NAVY = "#0A1630";

/**
 * Hero: devotional family-puja scene on the right, copy on a deep-navy gradient on the left.
 * Mobile/tablet: the scene sits on top and fades into the navy copy block, so the
 * family stays visible instead of being buried under text.
 */
export default function LandingHero() {
  const { t } = useI18n();

  const trust = [
    { icon: ShieldCheck, label: t("lp.trust.pujaris") },
    { icon: Eye, label: t("lp.trust.details") },
    { icon: Flower2, label: t("lp.trust.devotion") },
  ];

  return (
    <section
      aria-labelledby="lp-hero-title"
      className="relative isolate overflow-hidden text-white lg:flex lg:min-h-[calc(100svh-4.5rem)] lg:max-h-[50rem] lg:items-center xl:min-h-[calc(100svh-5.25rem)]"
      style={{ backgroundColor: NAVY }}
    >
      {/* Scene */}
      <div className="relative h-60 sm:h-80 lg:absolute lg:inset-0 lg:h-auto">
        <img
          src="/images/landing/hero-family.jpg"
          alt=""
          width={1024}
          height={576}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-[70%_40%] lg:absolute lg:inset-y-0 lg:left-[8%] lg:h-full lg:w-[92%] lg:object-[right_center]"
        />
        {/* mobile: fade scene into the copy block */}
        <div
          className="absolute inset-0 lg:hidden"
          style={{ backgroundImage: `linear-gradient(to top, ${NAVY} 2%, ${NAVY}00 70%)` }}
        />
        {/* desktop: strong navy mask over the left, clear on the right */}
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            backgroundImage: `linear-gradient(to right, ${NAVY} 0%, ${NAVY}F2 26%, ${NAVY}B8 40%, ${NAVY}40 56%, ${NAVY}00 72%)`,
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 hidden h-24 lg:block"
          style={{ backgroundImage: `linear-gradient(to top, ${NAVY}99, ${NAVY}00)` }}
        />
      </div>

      <MandalaOutline className="absolute -bottom-40 -left-40 hidden h-[34rem] w-[34rem] text-white opacity-[0.05] lg:block" />

      <div className="container relative z-10 -mt-14 pb-10 sm:-mt-20 lg:mt-0 lg:py-14">
        <div className="max-w-[35rem] animate-in fade-in duration-700 motion-reduce:animate-none">
          <p className="flex items-center gap-3 text-[0.6875rem] font-bold uppercase leading-snug tracking-[0.18em] text-white sm:text-xs">
            <span aria-hidden className="h-0.5 w-8 shrink-0 bg-brand-orange" />
            <span>{t("lp.hero.eyebrow")}</span>
          </p>

          <h1
            id="lp-hero-title"
            className="mt-4 text-balance text-[clamp(2rem,1rem+3vw,3.35rem)] leading-[1.1] tracking-tight"
          >
            <span className="block font-display font-semibold text-white">{t("lp.hero.title1")}</span>
            <span className="mt-1 block font-display font-semibold text-white">{t("lp.hero.title2")}</span>
            <span className="mt-1 block font-bold text-brand-orange">{t("lp.hero.title3")}</span>
          </h1>

          <p className="mt-5 max-w-[31rem] text-base font-medium leading-relaxed text-white sm:text-[1.0625rem]">
            {t("lp.hero.desc")}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/services">
              <a className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-7 text-base font-bold text-primary-foreground shadow-lg shadow-black/20 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1630]">
                {t("lp.cta.book")}
                <ArrowRight size={18} aria-hidden className="lp-arrow" />
              </a>
            </Link>
            <Link href="/services">
              <a className="inline-flex h-12 items-center justify-center rounded-lg border-2 border-white px-7 text-base font-bold text-white transition-colors hover:bg-white hover:text-[#0A1630] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1630]">
                {t("lp.cta.explore")}
              </a>
            </Link>
          </div>

          <ul className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:gap-x-7 sm:gap-y-3">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm font-semibold text-white">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-orange text-brand-orange">
                  <Icon size={17} aria-hidden strokeWidth={1.75} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
