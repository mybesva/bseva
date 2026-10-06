import { Link } from "wouter";
import { BookOpen, Globe, Heart, Shield, Sparkles, Users } from "lucide-react";
import { AboutEssenceCards } from "@/components/AboutEssenceCards";
import Layout from "@/components/Layout";
import { PublishedStatsStrip } from "@/components/PublishedStatsStrip";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";
import { useI18n } from "@/i18n/I18nProvider";

export default function About() {
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
        <div className="relative mx-auto grid w-full max-w-[1920px] items-center gap-10 px-5 py-12 sm:px-8 md:py-14 lg:grid-cols-[minmax(0,515fr)_minmax(0,886fr)] lg:gap-[2.35vw] lg:pl-[3.7vw] lg:pr-[2.75vw] lg:py-[clamp(4rem,10.8vw,11rem)]">
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

      <section className="bg-[#FDF6EC] dark:bg-[#0B1424]" aria-labelledby="about-principles-title">
        <div className="container py-12 md:py-14 lg:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="flex items-center justify-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF7A00] sm:text-xs">
              <span aria-hidden>—</span>
              {t("ab.principlesEyebrow")}
              <span aria-hidden>—</span>
            </p>
            <h2 id="about-principles-title" className="mt-3 text-[clamp(1.7rem,1rem+1.6vw,2.45rem)] font-bold leading-[1.15] tracking-tight">
              <span className="text-[#0E1830] dark:text-white">{t("ab.principles1")} </span>
              <span className="text-[#FF7A00]">{t("ab.principles2")}</span>
            </h2>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-10 lg:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex h-full flex-col rounded-xl border border-[#F0E2D2] bg-white px-5 py-6 shadow-[0_8px_22px_-20px_rgba(120,70,20,0.5)] dark:border-white/10 dark:bg-[#152238]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-bold text-[#0E1830] dark:text-white">{t(title)}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0]">{t(body)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PublishedStatsStrip />

      <section className="relative overflow-hidden bg-[#FDF6EC] dark:bg-[#0B1424]" aria-labelledby="about-cta-title">
        <MandalaOutline className="absolute -bottom-28 -left-24 h-72 w-72 text-[#E8B15A] opacity-[0.16] dark:opacity-[0.08]" />
        <MandalaOutline className="absolute -right-24 -top-24 h-72 w-72 text-[#E8B15A] opacity-[0.14] dark:opacity-[0.08]" />
        <div className="container relative mx-auto max-w-3xl py-14 text-center md:py-16">
          <p className="flex items-center justify-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF7A00] sm:text-xs">
            <span aria-hidden>—</span>
            {t("ab.ctaEyebrow")}
            <span aria-hidden>—</span>
          </p>
          <h2 id="about-cta-title" className="mt-3 text-[clamp(1.7rem,1rem+1.6vw,2.45rem)] font-bold leading-[1.15] tracking-tight">
            <span className="block text-[#0E1830] dark:text-white">{t("ab.cta1")}</span>
            <span className="block text-[#FF7A00]">{t("ab.cta2")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0] sm:text-base">
            {t("ab.ctaDesc")}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/services">
              <a className="inline-flex h-12 items-center justify-center rounded-lg bg-[#FF7A00] px-8 text-[15px] font-bold text-white hover:bg-[#F07400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] focus-visible:ring-offset-2">
                {t("nav.bookPuja")}
              </a>
            </Link>
            <Link href="/register?role=pujari">
              <a className="inline-flex h-12 items-center justify-center rounded-lg border-2 border-[#FF7A00] bg-white px-8 text-[15px] font-bold text-[#FF7A00] hover:bg-[#FFF4EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] focus-visible:ring-offset-2 dark:bg-transparent dark:hover:bg-[#FF7A00]/10">
                {t("lp.cta.joinPujari")}
              </a>
            </Link>
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
