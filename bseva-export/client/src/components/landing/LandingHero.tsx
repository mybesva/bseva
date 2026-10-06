import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { LotusMark, MandalaOutline } from "./DevotionalPatterns";

const NAVY = "#071A33";
const HERO = "/images/landing/hero-approved.jpg?v=4";

/**
 * Full-bleed cinematic hero. The photograph already contains the family,
 * Pujari, havan, and the grounded B-SEVA phone — do not overlay another device.
 * A navy wash covers the left of that artwork so the real (translated) copy
 * sits on top without doubling the type baked into the picture.
 */
export default function LandingHero() {
  const { t, lang } = useI18n();
  const lockLines = lang === "en";

  const trust = [
    { icon: "shield" as const, label: t("lp.trust.pujaris") },
    { icon: "lotus" as const, label: t("lp.trust.details") },
    { icon: "people" as const, label: t("lp.trust.devotion") },
  ];

  return (
    <section
      aria-labelledby="lp-hero-title"
      className="relative isolate overflow-hidden text-white"
      style={{ backgroundColor: NAVY }}
    >
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        <img
          src={HERO}
          alt=""
          width={2048}
          height={1152}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-[62%_46%] xl:object-[50%_50%] 2xl:object-[50%_64%]"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 46%, ${NAVY}59 56%, ${NAVY}00 68%)`,
          }}
        />
        <MandalaOutline className="absolute -bottom-48 -left-40 h-[36rem] w-[36rem] text-white opacity-[0.055]" />
      </div>

      <div className="relative z-10 flex lg:min-h-[calc(100svh-4.5rem)] lg:items-center xl:min-h-[calc(100svh-5.25rem)]">
        <div className="w-full py-10 sm:py-12 lg:py-10 pl-[clamp(1.25rem,5.5vw,7.5rem)] pr-[clamp(1.25rem,4vw,4rem)]">
          <div className="max-w-[40rem]">
            <p className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase leading-snug tracking-[0.16em] text-white sm:text-xs">
              <span aria-hidden className="h-[2px] w-8 shrink-0 bg-[#FF7A00]" />
              <span>{t("lp.hero.eyebrow")}</span>
            </p>

            <h1
              id="lp-hero-title"
              className="mt-4 font-display text-[clamp(2.15rem,4.15vw,3.9rem)] font-semibold leading-[1.04] tracking-tight"
            >
              <span className={cn("block text-white", lockLines && "lg:whitespace-nowrap")}>{t("lp.hero.title1")}</span>
              <span className={cn("block text-[#FF7A00]", lockLines && "lg:whitespace-nowrap")}>{t("lp.hero.title2")}</span>
              <span className={cn("block text-white", lockLines && "lg:whitespace-nowrap")}>{t("lp.hero.title3")}</span>
            </h1>

            <p className="mt-5 max-w-[32rem] text-[0.98rem] font-medium leading-relaxed text-white sm:text-[1.0625rem]">
              {t("lp.hero.desc")}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/services">
                <a className="inline-flex h-12 min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#FF7A00] px-6 text-base font-bold text-[#0E1830] shadow-[0_8px_22px_-8px_rgba(255,122,0,0.75)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-8px_rgba(255,122,0,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071A33]">
                  {t("lp.cta.book")}
                  <ArrowRight size={18} aria-hidden className="lp-arrow" />
                </a>
              </Link>
              <Link href="/services">
                <a className="inline-flex h-12 min-h-11 items-center justify-center rounded-[10px] border-2 border-white bg-transparent px-6 text-base font-bold text-white transition-colors hover:bg-white hover:text-[#071A33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071A33]">
                  {t("lp.cta.explore")}
                </a>
              </Link>
            </div>

            <TrustRow items={trust} className="mt-8 hidden lg:flex" />
          </div>
        </div>
      </div>

      <div className="relative h-[min(78vw,26rem)] sm:h-[22rem] lg:hidden" aria-hidden>
        <img
          src={HERO}
          alt=""
          width={2048}
          height={1152}
          decoding="async"
          className="h-full w-full object-cover object-[76%_46%]"
        />
        <div
          className="absolute inset-x-0 top-0 h-16"
          style={{ backgroundImage: `linear-gradient(to bottom, ${NAVY}, ${NAVY}00)` }}
        />
      </div>

      <TrustRow items={trust} className="flex flex-wrap gap-x-6 gap-y-4 px-[clamp(1.25rem,5.5vw,7.5rem)] pb-8 pt-5 lg:hidden" />
    </section>
  );
}

function TrustRow({
  items,
  className,
}: {
  items: { icon: "shield" | "lotus" | "people"; label: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex-wrap gap-x-8 gap-y-4", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3 text-sm font-semibold text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#FF7A00] text-[#FF7A00]">
            {item.icon === "shield" ? (
              <ShieldCheck size={18} aria-hidden strokeWidth={1.75} />
            ) : item.icon === "lotus" ? (
              <LotusMark className="h-[18px] w-[18px]" />
            ) : (
              <Users size={18} aria-hidden strokeWidth={1.75} />
            )}
          </span>
          <TrustLabel text={item.label} />
        </li>
      ))}
    </ul>
  );
}

function TrustLabel({ text }: { text: string }) {
  const split = text.indexOf(" ");
  if (split < 0) return <span className="leading-tight">{text}</span>;
  return (
    <span className="leading-[1.15]">
      <span className="block">{text.slice(0, split)}</span>
      <span className="block">{text.slice(split + 1)}</span>
    </span>
  );
}
