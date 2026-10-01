import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

/** Custom puja request — uses existing /contact flow. */
export default function ServicesCustomCta() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  return (
    <section
      aria-labelledby="services-custom-title"
      className="relative overflow-hidden bg-secondary/25 py-14 md:py-16 dark:bg-muted/30"
    >
      <MandalaOutline className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 text-primary opacity-[0.07]" />
      <MandalaOutline className="pointer-events-none absolute -right-16 top-0 h-48 w-48 text-primary opacity-[0.06]" />

      <div className="container relative z-10 max-w-2xl text-center">
        <h2 id="services-custom-title" className="font-display text-2xl font-semibold leading-snug text-foreground md:text-3xl">
          {t("sv.custom.title1")}{" "}
          <span className="font-bold text-brand-orange">{t("sv.custom.title2")}</span>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-foreground/85">{t("services.customDesc")}</p>
        <Button
          size="lg"
          className="mt-7 h-12 bg-primary px-8 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
          onClick={() => {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            setLocation("/contact");
          }}
        >
          {t("services.requestCustom")}
        </Button>
      </div>
    </section>
  );
}
