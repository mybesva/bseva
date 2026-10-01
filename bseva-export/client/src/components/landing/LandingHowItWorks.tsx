import { CalendarDays, CheckCircle2, Search, UserCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline, TempleOutline } from "./DevotionalPatterns";

/** Dark navy 4-step journey. Horizontal with a dotted connector on desktop, vertical on mobile. */
export default function LandingHowItWorks() {
  const { t } = useI18n();

  const steps = [
    { icon: Search, title: t("lp.how.s1t"), desc: t("lp.how.s1d") },
    { icon: CalendarDays, title: t("lp.how.s2t"), desc: t("lp.how.s2d") },
    { icon: UserCheck, title: t("lp.how.s3t"), desc: t("lp.how.s3d") },
    { icon: CheckCircle2, title: t("lp.how.s4t"), desc: t("lp.how.s4d") },
  ];

  return (
    <section
      id="how-it-works"
      aria-labelledby="lp-how-title"
      className="relative scroll-mt-24 overflow-hidden bg-sidebar py-16 text-white md:py-20"
    >
      <MandalaOutline className="absolute -left-32 top-1/2 hidden h-[32rem] w-[32rem] -translate-y-1/2 text-white opacity-[0.06] md:block" />
      <TempleOutline className="absolute -bottom-6 -right-10 hidden h-72 w-auto text-white opacity-[0.06] lg:block" />

      <div className="container relative z-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">{t("lp.how.eyebrow")}</p>
          <h2
            id="lp-how-title"
            className="mt-2 text-balance font-display text-3xl font-bold leading-tight text-white md:text-4xl"
          >
            {t("lp.how.title")}
          </h2>
        </div>

        <ol className="relative mt-12 grid gap-0 lg:mt-14 lg:grid-cols-4 lg:gap-8">
          {/* desktop connector between the numbered circles */}
          <span
            aria-hidden
            className="lp-dots-h absolute left-[12.5%] right-[12.5%] top-5 hidden h-1 lg:block"
          />
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <li key={title} className="relative flex gap-5 pb-10 last:pb-0 lg:flex-col lg:items-center lg:gap-0 lg:pb-0 lg:text-center">
              {/* mobile connector */}
              {i < steps.length - 1 ? (
                <span aria-hidden className="lp-dots-v absolute bottom-0 left-5 top-12 w-1 -translate-x-1/2 lg:hidden" />
              ) : null}

              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground ring-8 ring-sidebar">
                {i + 1}
              </span>

              <div className="min-w-0 lg:mt-6 lg:flex lg:flex-col lg:items-center">
                <span
                  aria-hidden
                  className="hidden h-20 w-20 items-center justify-center rounded-full border border-brand-orange/70 text-white lg:flex"
                >
                  <Icon size={32} strokeWidth={1.5} />
                </span>
                <div className="flex items-center gap-3 lg:mt-5 lg:block">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-orange/70 text-white lg:hidden"
                  >
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <h3 className="text-lg font-bold leading-snug text-white">{title}</h3>
                </div>
                <p className="mt-2 max-w-[17rem] text-sm font-medium leading-relaxed text-white">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
