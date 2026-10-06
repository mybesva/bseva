import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { LotusMark, MandalaOutline } from "./DevotionalPatterns";
import LandingHeroAppPreview from "./LandingHeroAppPreview";

const NAVY = "#071A33";
const HERO = "/images/landing/hero-approved.jpg?v=9";

/**
 * Full-bleed cinematic hero. The photograph already contains the family,
 * Pujari, havan, and the grounded B-SEVA phone. On desktop that phone is redrawn
 * in vector exactly over itself (see LandingHeroAppPreview) so its border and UI stay
 * crisp — never add a second device elsewhere.
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
        <HeroPhotoStage />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 22%, ${NAVY}73 32%, ${NAVY}00 42%)`,
          }}
        />
        <MandalaOutline className="absolute -bottom-48 -left-40 h-[36rem] w-[36rem] text-white opacity-[0.055]" />
      </div>

      <div className="relative z-10 flex lg:min-h-[calc(100svh-5rem)] lg:items-center xl:min-h-[calc(100svh-6.25rem)]">
        <div className="w-full py-10 sm:py-12 lg:-translate-y-[4.5svh] lg:py-8 pl-[clamp(1.25rem,5.55vw,12rem)] pr-[clamp(1.25rem,4vw,4rem)]">
          <div className="max-w-[37.5rem] lg:max-w-none">
            <p className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase leading-snug tracking-[0.18em] text-white sm:text-xs lg:text-[clamp(12px,0.84vw,19px)]">
              <span aria-hidden className="h-[2px] w-7 shrink-0 bg-[#FF7A00] lg:w-[clamp(28px,1.95vw,44px)]" />
              <span>{t("lp.hero.eyebrow")}</span>
            </p>

            <h1
              id="lp-hero-title"
              className="mt-3.5 font-display text-[clamp(2rem,4vw,62px)] font-semibold leading-[1.02] tracking-tight lg:mt-[clamp(20px,1.39vw,32px)] lg:text-[clamp(46px,3.92vw,112px)] lg:leading-[1.14]"
            >
              <span className={cn("block text-white", lockLines && "lg:whitespace-nowrap")}>{t("lp.hero.title1")}</span>
              <span className={cn("block text-[#FF7A00]", lockLines && "lg:whitespace-nowrap")}>{t("lp.hero.title2")}</span>
              <span className={cn("block text-white", lockLines && "lg:whitespace-nowrap")}>{t("lp.hero.title3")}</span>
            </h1>

            <p className="mt-4 max-w-[33rem] text-base font-medium leading-normal text-white sm:text-[1.125rem] sm:leading-[1.5] lg:mt-3 lg:max-w-[29.5em] lg:text-[clamp(16px,1.18vw,30px)] lg:leading-[1.7]">
              {t("lp.hero.desc")}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center lg:mt-[clamp(26px,1.8vw,44px)] lg:gap-[clamp(14px,0.97vw,24px)]">
              <Link href="/services">
                <a className="inline-flex h-12 min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#FF7A00] px-6 text-base font-bold lg:h-[clamp(53px,3.68vw,84px)] lg:px-[clamp(40px,2.78vw,64px)] lg:text-[clamp(17px,1.18vw,27px)] text-[#0E1830] shadow-[0_6px_14px_-8px_rgba(255,122,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071A33]">
                  {t("lp.cta.book")}
                  <ArrowRight size={18} aria-hidden className="lp-arrow lg:h-[1.06em] lg:w-[1.06em]" />
                </a>
              </Link>
              <Link href="/services">
                <a className="inline-flex h-12 min-h-11 items-center justify-center rounded-[10px] border-2 border-white bg-transparent px-6 text-base font-bold lg:h-[clamp(53px,3.68vw,84px)] lg:px-[clamp(32px,2.22vw,52px)] lg:text-[clamp(17px,1.18vw,27px)] text-white transition-colors hover:bg-white hover:text-[#071A33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071A33]">
                  {t("lp.cta.explore")}
                </a>
              </Link>
            </div>

            <TrustRow items={trust} large className="mt-7 hidden lg:mt-[clamp(41px,2.85vw,66px)] lg:flex lg:gap-x-[clamp(36px,2.5vw,58px)]" />
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
  large,
}: {
  items: { icon: "shield" | "lotus" | "people"; label: string }[];
  className?: string;
  /** Desktop hero sizing from the approved reference (56px rings). */
  large?: boolean;
}) {
  return (
    <ul className={cn("flex-wrap gap-x-8 gap-y-4", className)}>
      {items.map((item) => (
        <li key={item.label} className={cn("flex items-center gap-3 text-sm font-semibold text-white", large && "text-[clamp(15px,1.04vw,24px)] gap-[0.8em]")}>
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#FF7A00] text-[#FF7A00]",
              large && "h-[clamp(56px,3.9vw,90px)] w-[clamp(56px,3.9vw,90px)]",
            )}
          >
            {item.icon === "shield" ? (
              <ShieldCheck size={18} aria-hidden strokeWidth={1.75} className={cn(large && "h-[43%] w-[43%]")} />
            ) : item.icon === "lotus" ? (
              <LotusMark className={large ? "h-[43%] w-[43%]" : "h-[18px] w-[18px]"} />
            ) : (
              <Users size={18} aria-hidden strokeWidth={1.75} className={cn(large && "h-[43%] w-[43%]")} />
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

const PHOTO_W = 2048;
const PHOTO_H = 1150;
/** Vertical focus: keep the grounded phone and its stand fully in frame on wide screens. */
const FOCUS_Y = 0.78;

/**
 * Behaves like `object-cover` for the hero photo, but exposes the photo's own pixel
 * space so the vector phone can be pinned to the photographed device at any size.
 */
function HeroPhotoStage() {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<{ s: number; x: number; y: number } | null>(null);
  // Reveal photo + phone together so the vector phone never floats on bare navy while loading.
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const s = Math.max(width / PHOTO_W, height / PHOTO_H);
      setBox({ s, x: (width - PHOTO_W * s) / 2, y: (height - PHOTO_H * s) * FOCUS_Y });
    };
    fit();
    if (imgRef.current?.complete) setLoaded(true);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: PHOTO_W,
          height: PHOTO_H,
          transform: box ? `translate(${box.x}px, ${box.y}px) scale(${box.s})` : undefined,
          visibility: box && loaded ? "visible" : "hidden",
        }}
      >
        <img
          ref={imgRef}
          src={HERO}
          alt=""
          width={PHOTO_W}
          height={PHOTO_H}
          fetchPriority="high"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className="block h-full w-full"
        />
        <LandingHeroAppPreview />
      </div>
    </div>
  );
}
