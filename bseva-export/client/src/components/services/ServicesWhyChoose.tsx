import { useI18n } from "@/i18n/I18nProvider";
import DevotionalImageFrame from "@/components/DevotionalImageFrame";
import { HangingDiya, MandalaOutline } from "@/components/landing/DevotionalPatterns";

/** Compact trust block under the puja catalogue. */
export default function ServicesWhyChoose() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="services-why-title" className="soften-brand-mark relative overflow-hidden bg-[#FFF8EE] pt-14 pb-2 dark:bg-background md:pt-16">
      <MandalaOutline className="pointer-events-none absolute -left-16 top-6 h-48 w-48 text-[#E8A04A] opacity-[0.09] dark:text-primary dark:opacity-[0.06]" />
      <HangingDiya className="pointer-events-none absolute left-[7%] top-0 hidden h-24 w-8 text-[#E0A04A]/70 lg:block" />
      <HangingDiya className="pointer-events-none absolute left-[14%] top-0 hidden h-16 w-6 text-[#E8B15A]/60 lg:block" />

      <div className="container relative z-10 max-w-6xl">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)] lg:gap-16 xl:gap-20">
          <div className="relative mx-auto w-[220px] sm:w-[240px] lg:w-[min(100%,300px)]">
            <MandalaOutline className="pointer-events-none absolute -inset-6 text-[#E8A04A] opacity-[0.1] dark:text-primary dark:opacity-[0.07]" />
            <DevotionalImageFrame
              src="/images/services-hero-puja.webp"
              alt={t("sv.why.imgAlt")}
              width={832}
              height={768}
              objectPosition="50% 0%"
              headroom={0.16}
              className="aspect-[25/34] w-full"
            />
          </div>

          <div className="max-w-[40rem] text-left">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#FF7A00]">{t("sv.why.eyebrow")}</p>
            <h2 id="services-why-title" className="mt-2 font-display text-[1.7rem] font-semibold leading-[1.15] text-[#0E1830] dark:text-foreground md:text-[1.85rem] lg:text-[clamp(2rem,2.4vw,2.375rem)]">
              <span className="block">{t("sv.why.title1")}</span>
              <span className="block text-[#FF7A00]">{t("sv.why.title2")}</span>
            </h2>
            <div className="mt-3 space-y-3 text-[1.02rem] leading-[1.55] text-[#1A2B4A] dark:text-foreground/90 md:text-[1.0625rem]">
              <p>{t("sv.why.p1")}</p>
              <p>{t("sv.why.p2")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
