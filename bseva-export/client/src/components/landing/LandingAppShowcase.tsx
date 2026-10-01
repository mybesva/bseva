import { CalendarCheck, ClipboardList, Download, Languages, Lock, Search, Smartphone } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { APP_STORE_URL, CATEGORY_CARD_IMAGES, PLAY_STORE_URL } from "@/lib/landingConfig";
import type { LandingCategory } from "./LandingServices";
import { MandalaOutline } from "./DevotionalPatterns";

/** Decorative phone frame; its contents are illustrative UI built from live labels. */
function Phone({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={`relative aspect-[9/18.5] w-[10.5rem] shrink-0 overflow-hidden rounded-[2rem] border-[7px] border-[#05080F] bg-[#FFF8E7] shadow-2xl shadow-black/50 ring-1 ring-white/15 sm:w-[11.5rem] ${className ?? ""}`}
    >
      <span className="absolute left-1/2 top-1.5 z-10 h-3 w-14 -translate-x-1/2 rounded-full bg-[#05080F]" />
      {children}
    </div>
  );
}

function HomeScreen({ categories, brand }: { categories: LandingCategory[]; brand: string }) {
  const { t } = useI18n();
  const chips = categories.slice(0, 3);
  return (
    <div className="flex h-full flex-col px-2.5 pb-2 pt-6 text-[#0E1830]">
      <div className="flex items-center gap-1.5">
        <img src="/bseva-mark.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
        <span className="text-[0.6rem] font-extrabold tracking-wide">{brand}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-[0.5rem] font-semibold text-[#0E1830]/70 shadow-sm">
        <Search size={9} />
        <span className="truncate">{t("services.searchPujas")}</span>
      </div>
      <div className="mt-2 flex gap-1 overflow-hidden">
        {chips.map((c) => (
          <span key={c.slug} className="shrink-0 rounded-full bg-[#FF7A00] px-1.5 py-0.5 text-[0.45rem] font-bold text-[#0E1830]">
            {c.name}
          </span>
        ))}
      </div>
      <div className="mt-2 grid flex-1 grid-cols-2 gap-1.5">
        {[CATEGORY_CARD_IMAGES.popular, CATEGORY_CARD_IMAGES["home-property"], CATEGORY_CARD_IMAGES["homam-havan"], CATEGORY_CARD_IMAGES.festivals].map(
          (src) => (
            <div key={src} className="overflow-hidden rounded-md bg-white shadow-sm">
              <img src={src} alt="" loading="lazy" className="h-2/3 w-full object-cover" />
              <div className="m-1 h-1 w-3/4 rounded bg-[#0E1830]/25" />
              <div className="m-1 h-1 w-1/2 rounded bg-[#0E1830]/15" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function BookingScreen() {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col px-2.5 pb-3 pt-6 text-[#0E1830]">
      <span className="text-[0.62rem] font-extrabold">{t("lp.cta.book")}</span>
      <div className="mt-2 space-y-1.5">
        {[t("lp.how.s1t"), t("lp.how.s2t"), t("lp.how.s3t")].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 shadow-sm">
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#FF7A00] text-[0.45rem] font-extrabold">
              {i + 1}
            </span>
            <span className="truncate text-[0.5rem] font-bold">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 overflow-hidden rounded-md bg-white shadow-sm">
        <img src={CATEGORY_CARD_IMAGES.popular} alt="" loading="lazy" className="h-14 w-full object-cover" />
        <div className="m-1.5 h-1 w-2/3 rounded bg-[#0E1830]/25" />
        <div className="m-1.5 h-1 w-1/3 rounded bg-[#FF7A00]" />
      </div>
      <div className="mt-auto rounded-md bg-[#FF7A00] py-1.5 text-center text-[0.55rem] font-extrabold">{t("lp.cta.book")}</div>
    </div>
  );
}

function StoreBadge({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/40 bg-black px-4 text-sm font-bold text-white transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1630]"
    >
      <Download size={18} aria-hidden />
      {label}
    </a>
  );
}

type Props = { categories: LandingCategory[] };

/**
 * Mobile app promo. Store badges are rendered ONLY when real URLs are configured
 * (VITE_APP_STORE_URL / VITE_PLAY_STORE_URL) so there are never dead or fake download links.
 */
export default function LandingAppShowcase({ categories }: Props) {
  const { t } = useI18n();
  const features = [
    { icon: CalendarCheck, title: t("lp.app.f1t"), desc: t("lp.app.f1d") },
    { icon: Lock, title: t("lp.app.f2t"), desc: t("lp.app.f2d") },
    { icon: ClipboardList, title: t("lp.app.f3t"), desc: t("lp.app.f3d") },
    { icon: Languages, title: t("lp.app.f4t"), desc: t("lp.app.f4d") },
  ];

  return (
    <section
      aria-labelledby="lp-app-title"
      className="relative overflow-hidden py-16 text-white md:py-20"
      style={{ backgroundColor: "#0A1630" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(60% 70% at 50% 100%, rgba(255,122,0,0.28), rgba(255,122,0,0) 70%)" }}
      />
      <MandalaOutline className="absolute -right-40 -top-40 hidden h-[34rem] w-[34rem] text-white opacity-[0.05] md:block" />

      <div className="container relative z-10 grid items-center gap-12 lg:grid-cols-[1fr_1.05fr_1fr] lg:gap-8">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">
            <Smartphone size={16} aria-hidden />
            {t("lp.app.eyebrow")}
          </p>
          <h2
            id="lp-app-title"
            className="mt-3 text-balance font-display text-3xl font-bold leading-tight text-white md:text-4xl"
          >
            {t("lp.app.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-white lg:mx-0">{t("lp.app.desc")}</p>
          {APP_STORE_URL || PLAY_STORE_URL ? (
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              {APP_STORE_URL ? <StoreBadge href={APP_STORE_URL} label={t("lp.app.appStore")} /> : null}
              {PLAY_STORE_URL ? <StoreBadge href={PLAY_STORE_URL} label={t("lp.app.googlePlay")} /> : null}
            </div>
          ) : null}
        </div>

        <div className="relative flex min-h-[22rem] items-center justify-center py-2 sm:min-h-[26rem]" aria-hidden>
          <div className="relative flex items-end justify-center">
            <Phone className="-rotate-6 translate-x-3 sm:translate-x-4">
              <HomeScreen categories={categories} brand="B-SEVA" />
            </Phone>
            <Phone className="z-10 -translate-x-3 translate-y-6 rotate-6 sm:-translate-x-4">
              <BookingScreen />
            </Phone>
          </div>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {features.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-4 text-left">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-orange/70 text-brand-orange"
              >
                <Icon size={21} strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold leading-snug text-white">{title}</h3>
                <p className="mt-0.5 text-sm font-medium leading-snug text-white">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
