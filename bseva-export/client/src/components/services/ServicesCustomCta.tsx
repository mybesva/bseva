import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

/** Custom puja request — continues the Why Choose band and uses /contact. */
export default function ServicesCustomCta() {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();

  return (
    <section aria-labelledby="services-custom-title" className="relative overflow-hidden bg-[#FFF8EE] pb-14 pt-8 dark:bg-background md:pb-16 md:pt-10">
      <MandalaOutline className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 text-[#E8A04A] opacity-[0.08] dark:text-primary dark:opacity-[0.06]" />
      <MandalaOutline className="pointer-events-none absolute -bottom-12 -right-14 h-36 w-36 text-[#E8A04A] opacity-[0.08] dark:text-primary dark:opacity-[0.05]" />

      <div className="container relative z-10 max-w-3xl text-center">
        <h2 id="services-custom-title" className={cn("font-display text-[1.65rem] font-semibold leading-tight text-[#0E1830] dark:text-foreground sm:text-[1.8rem] lg:text-[clamp(1.875rem,2.2vw,2.25rem)]", lang === "en" && "lg:whitespace-nowrap")}>
          {t("sv.custom.title1")}{" "}
          <span className="text-[#FF7A00]">{t("sv.custom.title2")}</span>
        </h2>
        <span aria-hidden className="mx-auto mt-3 block h-[2px] w-[5.25rem] rounded-full bg-[#FF7A00]" />
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-[#1A2B4A] dark:text-foreground/90">{t("sv.custom.desc")}</p>
        <Button
          className="mt-5 h-11 rounded-[10px] bg-[#FF7A00] px-6 text-[0.95rem] font-bold text-[#0E1830] shadow-[0_6px_14px_-8px_rgba(255,122,0,0.65)] hover:bg-[#FF7A00]/90"
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
