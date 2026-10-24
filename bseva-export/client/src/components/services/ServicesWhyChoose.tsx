import { useLocation } from "wouter";
import { ArrowRight, MessageCircleHeart, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

/**
 * Compact band under the puja catalogue: "Why choose B-Seva" and the custom-puja request
 * side by side as two cards (stacked on small screens). Custom request opens /contact.
 */
export default function ServicesWhyChoose() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  return (
    <section
      aria-labelledby="services-why-title"
      className="soften-brand-mark relative overflow-hidden bg-[#FFF8EE] py-10 dark:bg-background md:py-12"
    >
      <div className="container relative z-10">
        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-6">
          {/* Why choose */}
          <article className="flex flex-col gap-5 overflow-hidden rounded-3xl border border-[#EFE2CF] bg-white p-5 shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] sm:flex-row sm:items-center sm:p-6 dark:border-white/10 dark:bg-[#152238]">
            <img
              src="/images/services-hero-puja.webp"
              alt={t("sv.why.imgAlt")}
              width={832}
              height={768}
              loading="lazy"
              decoding="async"
              className="h-44 w-full shrink-0 rounded-2xl object-cover object-[50%_35%] sm:h-auto sm:w-48 sm:self-stretch lg:w-56"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#FF7A00]">
                <ShieldCheck size={15} aria-hidden />
                {t("sv.why.eyebrow")}
              </p>
              <h2
                id="services-why-title"
                className="mt-2 font-display text-[1.45rem] font-semibold leading-[1.2] text-[#0E1830] dark:text-foreground lg:text-[1.65rem]"
              >
                {t("sv.why.title1")} <span className="text-[#FF7A00]">{t("sv.why.title2")}</span>
              </h2>
              <p className="mt-2.5 text-[0.95rem] leading-[1.6] text-[#1A2B4A] dark:text-foreground/90">{t("sv.why.p1")}</p>
              <p className="mt-2 text-[0.95rem] leading-[1.6] text-[#1A2B4A] dark:text-foreground/90">{t("sv.why.p2")}</p>
            </div>
          </article>

          {/* Custom puja request */}
          <article
            aria-labelledby="services-custom-title"
            className="relative flex flex-col justify-center overflow-hidden rounded-3xl bg-[#071A33] p-6 text-white sm:p-7"
          >
            <MandalaOutline className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 text-[#E8B15A] opacity-[0.14]" />
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF7A00]/15 text-[#FF7A00]">
              <MessageCircleHeart size={22} aria-hidden />
            </span>
            <h2 id="services-custom-title" className="relative mt-4 font-display text-[1.45rem] font-semibold leading-[1.2] lg:text-[1.6rem]">
              {t("sv.custom.title1")} <span className="text-[#FF9A2E]">{t("sv.custom.title2")}</span>
            </h2>
            <p className="relative mt-2 text-[0.95rem] leading-[1.6] text-white/80">{t("sv.custom.desc")}</p>
            <button
              type="button"
              className="relative mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-[#FF7A00] px-5 text-[0.95rem] font-bold text-[#0E1830] shadow-[0_8px_18px_-10px_rgba(255,122,0,0.8)] transition-colors hover:bg-[#FF8A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071A33]"
              onClick={() => {
                setLocation("/contact?subject=custom_puja");
              }}
            >
              {t("services.requestCustom")}
              <ArrowRight size={17} aria-hidden />
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
