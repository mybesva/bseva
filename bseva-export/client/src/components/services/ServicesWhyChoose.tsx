import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

/** Educational trust section below the service catalogue (Puja tab only). */
export default function ServicesWhyChoose() {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="services-why-title"
      className="relative overflow-hidden border-t border-primary/10 bg-background py-12 md:py-16 lg:py-20"
    >
      <MandalaOutline className="pointer-events-none absolute -right-24 top-8 h-72 w-72 text-primary opacity-[0.06] dark:opacity-[0.08]" />

      <div className="container">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div
              aria-hidden
              className="absolute -inset-3 rounded-[2.5rem] border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10"
              style={{ borderTopLeftRadius: "3rem", borderTopRightRadius: "3rem" }}
            />
            <div
              className="relative overflow-hidden shadow-xl ring-1 ring-primary/15"
              style={{
                borderTopLeftRadius: "2.75rem",
                borderTopRightRadius: "2.75rem",
                borderBottomLeftRadius: "0.75rem",
                borderBottomRightRadius: "0.75rem",
              }}
            >
              <img
                src="/images/services-hero-puja.webp"
                alt={t("sv.why.imgAlt")}
                width={640}
                height={800}
                loading="lazy"
                decoding="async"
                className="aspect-[4/5] w-full object-cover object-center"
              />
            </div>
          </div>

          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t("sv.why.eyebrow")}</p>
            <h2 id="services-why-title" className="mt-3 font-display text-2xl font-semibold leading-snug text-foreground md:text-3xl lg:text-[2rem]">
              {t("sv.why.title1")}{" "}
              <span className="block font-bold text-brand-orange">{t("sv.why.title2")}</span>
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-foreground/90 dark:text-foreground/85">
              <p>{t("sv.why.p1")}</p>
              <p>{t("sv.why.p2")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
