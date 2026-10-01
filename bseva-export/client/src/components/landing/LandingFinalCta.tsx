import { Link } from "wouter";
import { ArrowRight, Flame, Landmark, Sparkles, Users } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

/** Warm sunrise banner with a temple silhouette, shown just before the footer. */
export default function LandingFinalCta() {
  const { t } = useI18n();
  const pillars = [
    { icon: Flame, label: t("lp.final.faith") },
    { icon: Landmark, label: t("lp.final.tradition") },
    { icon: Users, label: t("lp.final.community") },
    { icon: Sparkles, label: t("lp.final.blessings") },
  ];

  return (
    <section aria-labelledby="lp-final-title" className="relative isolate overflow-hidden bg-[#7A3A0A]">
      <img
        src="/images/landing/temple-sunrise.jpg"
        alt=""
        width={1280}
        height={720}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_60%]"
      />
      {/* keep the headline area bright & warm; darken the silhouette side for the white pillar icons */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,214,140,0.62) 0%, rgba(255,190,100,0.38) 42%, rgba(40,18,6,0.08) 62%, rgba(30,14,4,0.55) 100%)",
        }}
      />

      <div className="container grid items-center gap-10 py-14 md:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="max-w-xl">
          <h2
            id="lp-final-title"
            className="text-balance font-display text-3xl font-bold leading-tight text-[#0A1630] md:text-4xl"
          >
            {t("lp.final.title")}
          </h2>
          <p className="mt-3 text-base font-semibold leading-relaxed text-[#0A1630] md:text-lg">{t("lp.final.desc")}</p>
          <Link href="/services">
            <a className="group mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0A1630] px-7 text-base font-bold text-white shadow-lg transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1630] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFC46B] sm:w-auto">
              {t("lp.cta.bookToday")}
              <ArrowRight size={18} aria-hidden className="lp-arrow" />
            </a>
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:justify-self-end lg:gap-x-8">
          {pillars.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-center gap-2 text-center">
              <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-[#0A1630]/45 text-white backdrop-blur-sm"
              >
                <Icon size={24} strokeWidth={1.5} />
              </span>
              <span className="text-sm font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
