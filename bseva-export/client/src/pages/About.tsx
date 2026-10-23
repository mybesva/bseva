import { Link } from "wouter";
import { BookOpen, Globe, Heart, Shield, Sparkles, Users } from "lucide-react";
import { AboutEssenceCards } from "@/components/AboutEssenceCards";
import Layout from "@/components/Layout";
import { PublishedStatsStrip } from "@/components/PublishedStatsStrip";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/_core/hooks/useAuth";

export default function About() {
  const { user } = useAuth();
  const role = user?.role;
  const isPujariUser = role === "pujari" || role === "head_pujari";
  // Signed-in users only see the call to action that fits their role.
  const showBookCta = !isPujariUser;
  const showJoinCta = !(role === "customer" || isPujariUser);
  const { t } = useI18n();

  const principles = [
    { icon: BookOpen, title: "ab.v1", body: "ab.v1d" },
    { icon: Users, title: "ab.v2", body: "ab.v2d" },
    { icon: Sparkles, title: "ab.v3", body: "ab.v3d" },
    { icon: Shield, title: "ab.v4", body: "ab.v4d" },
    { icon: Globe, title: "ab.v5", body: "ab.v5d" },
    { icon: Heart, title: "ab.v6", body: "ab.v6d" },
  ];

  return (
    <Layout>
      <section
        aria-labelledby="about-hero-title"
        className="about-hero-banner relative isolate overflow-hidden text-white"
        style={{ backgroundColor: "#051831" }}
      >
        {/* Photo fades into the navy instead of starting on a hard edge */}
        <img
          src="/images/about-hero-temple.webp"
          alt={t("ab.heroAlt")}
          width={1292}
          height={740}
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[88%] max-w-none object-cover object-[62%_40%] [mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.55)_25%,#000_45%)] sm:w-[72%] lg:w-[50%] lg:object-[100%_50%] lg:[mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.55)_9%,#000_22%)]"
        />
        <div
          className="absolute inset-0 lg:hidden"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(5,24,49,0.97) 0%, rgba(5,24,49,0.9) 45%, rgba(5,24,49,0.6) 70%, rgba(5,24,49,0.25) 100%)",
          }}
        />

        <div className="relative z-10 mx-auto flex h-[440px] w-full max-w-[1920px] items-center px-5 sm:h-[460px] sm:px-8 lg:h-[clamp(350px,26.6vw,500px)] lg:px-[7.2%]">
          <div className="w-full max-w-[40rem] lg:max-w-[58%]">
            <p className="inline-flex rounded-full border border-white/25 bg-white/[0.06] px-3.5 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-[#FF7A00] lg:px-[1em] lg:py-[0.3em] lg:text-[clamp(13px,0.95vw,16px)]">
              {t("ab.eyebrow")}
            </p>
            <h1 id="about-hero-title" className="mt-5 font-sans text-[clamp(2rem,6vw,2.5rem)] font-extrabold leading-[1.1] tracking-[-0.02em] lg:mt-[1.15vw] lg:text-[clamp(44px,4vw,72px)] lg:leading-[1.08]">
              <span className="block text-white lg:whitespace-nowrap">{t("ab.hero1")}</span>
              <span className="block text-[#FF7A00] lg:whitespace-nowrap">{t("ab.hero2")}</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-[17px] font-medium leading-[1.6] text-white/90 antialiased lg:mt-[1.35vw] lg:max-w-none lg:whitespace-pre-line lg:text-[clamp(16px,1.3vw,22px)] lg:leading-[1.65]">
              {t("ab.heroDesc")}
            </p>
          </div>
        </div>
      </section>

      <AboutEssenceCards />

      <section className="relative overflow-hidden bg-[#FDF6EC] dark:bg-[#0B1424]" aria-labelledby="about-story-title">
        {/* Faint mandala behind the photo's upper-right corner, cropped by the section edge */}
        <MandalaOutline className="pointer-events-none absolute -right-[6vw] top-[2%] hidden h-[clamp(18rem,24vw,30rem)] w-[clamp(18rem,24vw,30rem)] text-[#E8B15A] opacity-[0.16] lg:block dark:opacity-[0.08]" />
        <div className="relative mx-auto grid w-full max-w-[1920px] items-center gap-10 px-5 py-12 sm:px-8 md:py-14 lg:grid-cols-[minmax(0,515fr)_minmax(0,886fr)] lg:gap-[2.35vw] lg:pl-[3.7vw] lg:pr-[2.75vw] lg:py-[clamp(3rem,4.6vw,6rem)]">
          <div>
            <p className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF7A00] lg:text-[clamp(12px,1.04vw,18px)]">
              <span aria-hidden className="h-[2px] w-4 bg-[#FF7A00] lg:w-[1.1em]" />
              {t("ab.storyEyebrow")}
              <span aria-hidden className="h-[2px] w-4 bg-[#FF7A00] lg:w-[1.1em]" />
            </p>
            <h2
              id="about-story-title"
              className="mt-4 text-[clamp(1.9rem,7vw,2.6rem)] font-extrabold leading-[1.1] tracking-[-0.03em] lg:mt-[1.9vw] lg:text-[clamp(34px,3.26vw,62px)] lg:leading-[1.1]"
            >
              <span className="block text-[#071A33] dark:text-white">{t("ab.story1")}</span>
              <span className="block text-[#FF7A00] lg:whitespace-pre-line">{t("ab.story2")}</span>
            </h2>
            <div className="mt-5 space-y-[1.15em] text-base font-medium leading-[1.5] text-[#071A33] dark:text-[#E8ECF0] lg:mt-[2.4vw] lg:max-w-[27em] lg:text-[clamp(15px,1.24vw,23px)] lg:leading-[1.45]">
              <p>{renderEmphasis(t("ab.storyP1"))}</p>
              <p>{renderEmphasis(t("ab.storyP2"))}</p>
              <p>{renderEmphasis(t("ab.storyP3"))}</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
            {/* Orange L-brackets sitting just outside the photo's top-left and bottom-right corners */}
            <span aria-hidden className="pointer-events-none absolute -left-3 -top-3 h-16 w-16 rounded-tl-[18px] border-l-[3px] border-t-[3px] border-[#FF7A00] lg:-left-[1.25vw] lg:-top-[1.1vw] lg:h-[clamp(4rem,5.6vw,7rem)] lg:w-[clamp(4rem,5.8vw,7.25rem)] lg:rounded-tl-[22px] lg:border-l-4 lg:border-t-4" />
            <span aria-hidden className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 rounded-br-[18px] border-b-[3px] border-r-[3px] border-[#FF7A00] lg:-bottom-[1.3vw] lg:-right-[1.05vw] lg:h-[clamp(4rem,5.6vw,7rem)] lg:w-[clamp(4rem,6.2vw,7.75rem)] lg:rounded-br-[22px] lg:border-b-4 lg:border-r-4" />
            <img
              src="/images/about-story-guidance.webp"
              alt={t("ab.storyAlt")}
              width={1796}
              height={1412}
              loading="lazy"
              decoding="async"
              className="relative aspect-[898/706] w-full rounded-[18px] object-cover object-[58%_center] lg:rounded-[22px]"
            />
          </div>
        </div>
      </section>

      {/* ── Principles: centered heading + six accent cards ── */}
      <section className="relative overflow-hidden bg-[#FDF6EC] dark:bg-[#0B1424]" aria-labelledby="about-principles-title">
        <MandalaOutline className="pointer-events-none absolute -left-28 top-10 h-72 w-72 text-[#E8B15A] opacity-[0.14] dark:opacity-[0.08]" />
        <MandalaOutline className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 text-[#E8B15A] opacity-[0.12] dark:opacity-[0.08]" />
        <div className="container relative py-12 md:py-14 lg:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#FF7A00]/30 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF7A00] sm:text-xs dark:bg-transparent">
              <Sparkles size={13} aria-hidden />
              {t("ab.principlesEyebrow")}
            </p>
            <h2 id="about-principles-title" className="mt-4 text-[clamp(1.75rem,1rem+1.6vw,2.6rem)] font-bold leading-[1.12] tracking-tight">
              <span className="text-[#0E1830] dark:text-white">{t("ab.principles1")} </span>
              <span className="text-[#FF7A00]">{t("ab.principles2")}</span>
            </h2>
            <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gradient-to-r from-[#FF7A00] to-[#D4AF37]" />
          </div>

          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {principles.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#F0E2D2] bg-white p-6 shadow-[0_18px_40px_-32px_rgba(120,70,20,0.6)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FFCF9E] hover:shadow-[0_26px_50px_-30px_rgba(255,122,0,0.45)] lg:p-7 dark:border-white/10 dark:bg-[#152238]"
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FF7A00] via-[#FFA43D] to-[#D4AF37] opacity-80 transition-opacity group-hover:opacity-100" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-1 -top-3 font-display text-[5.5rem] font-semibold leading-none text-[#FF7A00]/[0.07] transition-colors group-hover:text-[#FF7A00]/[0.12]"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF9A3C] to-[#E86400] text-white shadow-[0_10px_20px_-10px_rgba(255,122,0,0.8)]">
                  <Icon size={24} strokeWidth={1.8} aria-hidden />
                </span>
                <h3 className="relative mt-5 text-[1.1rem] font-bold leading-snug text-[#0E1830] dark:text-white">{t(title)}</h3>
                <p className="relative mt-2.5 text-[14.5px] font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0]">{t(body)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PublishedStatsStrip />

      {/* ── Join: one saffron card with both paths ── */}
      <section className="bg-[#FDF6EC] py-12 dark:bg-[#0B1424] md:py-14" aria-labelledby="about-cta-title">
        <div className="container">
          <div className="relative grid items-center gap-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#FF8A1F] to-[#E86400] p-7 text-white shadow-[0_30px_60px_-34px_rgba(232,100,0,0.8)] sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-10 lg:p-10">
            <MandalaOutline className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 text-white opacity-[0.12]" />
            <div className="relative hidden h-28 w-44 lg:block" aria-hidden>
              <img src="/images/landing/customer-puja.jpg" alt="" className="absolute left-0 top-0 h-24 w-24 rounded-full border-4 border-white/80 object-cover shadow-lg" />
              <img src="/images/landing/pujari-portrait.jpg" alt="" className="absolute bottom-0 right-0 h-24 w-24 rounded-full border-4 border-white/80 object-cover shadow-lg" />
            </div>
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 sm:text-xs">{t("ab.ctaEyebrow")}</p>
              <h2 id="about-cta-title" className="mt-2 text-[clamp(1.6rem,1rem+1.4vw,2.3rem)] font-bold leading-[1.15] tracking-tight">
                <span className="text-white">{t("ab.cta1")}</span> <span className="text-[#071A33]">{t("ab.cta2")}</span>
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-relaxed text-white/90">{t("ab.ctaDesc")}</p>
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row lg:flex-col">
              {showBookCta ? (
              <Link href="/services">
                <a className="inline-flex h-12 items-center justify-center rounded-xl bg-[#071A33] px-8 text-[15px] font-bold text-white transition-colors hover:bg-[#0D2445] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#FF7A00]">
                  {t("nav.bookPuja")}
                </a>
              </Link>
              ) : null}
              {showJoinCta ? (
              <Link href="/register?role=pujari">
                <a className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-white bg-transparent px-8 text-[15px] font-bold text-white transition-colors hover:bg-white hover:text-[#E86400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#FF7A00]">
                  {t("lp.cta.joinPujari")}
                </a>
              </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

/** Renders **bold** markers from translation strings (used for key phrases in the story copy). */
function renderEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-extrabold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
