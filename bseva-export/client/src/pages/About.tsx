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
        style={{ backgroundColor: "#041B39" }}
      >
        <img
          src="/images/about-hero-temple.jpg"
          alt={t("ab.heroAlt")}
          width={816}
          height={464}
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[86%] max-w-none object-cover object-[62%_40%] sm:w-[72%] lg:w-[56%] lg:object-[42%_34%]"
        />
        <div
          className="absolute inset-0 lg:hidden"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(4,27,57,0.97) 0%, rgba(4,27,57,0.92) 42%, rgba(4,27,57,0.72) 68%, rgba(4,27,57,0.28) 100%)",
          }}
        />
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(4,27,57,0.98) 0%, rgba(4,27,57,0.95) 30%, rgba(4,27,57,0.75) 47%, rgba(4,27,57,0.30) 61%, rgba(4,27,57,0.05) 75%)",
          }}
        />

        <div className="relative z-10 mx-auto flex h-[440px] w-full max-w-[1740px] items-center px-5 sm:h-[460px] sm:px-8 lg:h-[370px] lg:px-[7vw] xl:h-[390px]">
          <div className="w-full max-w-[40rem] lg:max-w-[760px]">
            <p className="inline-flex rounded-full border border-white/30 bg-[#041B39]/35 px-3.5 py-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#FF7A00] lg:text-[14px] lg:tracking-[0.12em]">
              {t("ab.eyebrow")}
            </p>
            <h1 id="about-hero-title" className="mt-6 font-sans text-[clamp(2rem,4vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight lg:mt-7 lg:text-[clamp(42px,4vw,64px)] lg:leading-[1.08]">
              <span className="block text-white">{t("ab.hero1")}</span>
              <span className="block text-[#FF7A00]">{t("ab.hero2")}</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] font-medium leading-[1.5] text-white/90 lg:mt-7 lg:max-w-[38rem] lg:text-[18px]">
              {t("ab.heroDesc")}
            </p>
          </div>
        </div>
      </section>

      <AboutEssenceCards />

      <section className="relative overflow-hidden bg-[#FDF6EC] dark:bg-[#0B1424]" aria-labelledby="about-story-title">
        <MandalaOutline className="absolute -right-24 top-10 hidden h-80 w-80 text-[#E8B15A] opacity-[0.14] lg:block dark:opacity-[0.08]" />
        <div className="container relative grid items-center gap-10 py-12 md:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-16">
          <div>
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF7A00] sm:text-xs">
              <span aria-hidden>—</span>
              {t("ab.storyEyebrow")}
              <span aria-hidden>—</span>
            </p>
            <h2 id="about-story-title" className="mt-3 text-[clamp(1.5rem,1rem+1vw,1.875rem)] font-bold leading-[1.2] tracking-tight">
              <span className="block text-[#0E1830] dark:text-white">{t("ab.story1")}</span>
              <span className="block text-[#FF7A00]">{t("ab.story2")}</span>
            </h2>
            <div className="mt-5 max-w-xl space-y-4 text-[15px] font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0] sm:text-base">
              <p>{t("ab.storyP1")}</p>
              <p>{t("ab.storyP2")}</p>
              <p>{t("ab.storyP3")}</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mx-0">
            <span aria-hidden className="absolute -left-2.5 -top-2.5 h-14 w-14 rounded-tl-2xl border-l-[3px] border-t-[3px] border-[#FF7A00]" />
            <span aria-hidden className="absolute -bottom-2.5 -right-2.5 h-14 w-14 rounded-br-2xl border-b-[3px] border-r-[3px] border-[#FF7A00]" />
            <img
              src="/images/about-story-aarti.jpg"
              alt={t("ab.storyAlt")}
              width={2400}
              height={1339}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-2xl object-cover object-[40%_center]"
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
