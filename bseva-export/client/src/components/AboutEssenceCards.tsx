import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { aboutText, PUJA_OM, PUJA_SWASTIKA } from "@bseva/locales";

function DevotionalHeading({ title }: { title: string }) {
  return (
    <h2 className="font-heading font-bold text-[18px] md:text-[21px] text-sidebar dark:text-foreground whitespace-nowrap flex items-center gap-x-2 leading-none">
      <span className="text-primary text-[19px] md:text-[22px] select-none shrink-0" aria-hidden="true">
        {PUJA_OM}
      </span>
      <span className="shrink-0">{title}</span>
      <span className="text-primary text-[19px] md:text-[22px] select-none shrink-0" aria-hidden="true">
        {PUJA_SWASTIKA}
      </span>
    </h2>
  );
}

function BrandEssenceTagline() {
  const { t } = useI18n();

  return (
    <p className="w-full flex flex-wrap items-center justify-center text-center gap-x-6 lg:gap-x-10 gap-y-2 text-[17px] md:text-[21px] font-heading font-bold leading-snug text-sidebar dark:text-foreground">
      <span className="whitespace-nowrap">
        <span className="text-primary font-bold">{aboutText(t, "brandEssenceBook")}</span>
        {aboutText(t, "brandEssenceWithEase")}
      </span>
      <span className="whitespace-nowrap">
        <span className="text-primary font-bold">{aboutText(t, "brandEssenceBelieve")}</span>
        {aboutText(t, "brandEssenceWithFaith")}
      </span>
      <span className="whitespace-nowrap">
        <span className="text-primary font-bold">{aboutText(t, "brandEssenceBless")}</span>
        {aboutText(t, "brandEssenceThroughSeva")}
      </span>
    </p>
  );
}

/** Vision / Mission: vertical card (heading band on top, statement below), fills its half of the row. */
function EssenceVerticalCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="h-full overflow-hidden rounded-[14px] border border-primary/15 border-t-[3px] border-t-primary bg-white dark:bg-card shadow-[0_2px_14px_rgba(0,0,0,0.05)] flex flex-col relative z-10">
      <div className="flex justify-center bg-primary/[0.07] dark:bg-primary/[0.1] border-b border-primary/10 px-5 py-4 md:px-6">
        <DevotionalHeading title={title} />
      </div>
      <div className="flex-1 px-5 py-5 md:px-6 md:py-6 bg-white dark:bg-card">
        <div className="text-sm md:text-[15px] leading-[1.65] text-sidebar dark:text-foreground text-left">
          {children}
        </div>
      </div>
    </article>
  );
}

/** Brand essence: full-width horizontal card, same highlight style as the Vision / Mission cards. */
function EssenceHorizontalCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="w-full overflow-hidden rounded-[14px] border border-primary/15 border-t-[3px] border-t-primary bg-white dark:bg-card shadow-[0_2px_14px_rgba(0,0,0,0.05)] flex flex-col md:flex-row md:items-stretch relative z-10">
      <div className="relative shrink-0 flex items-center md:w-[320px] bg-primary/[0.07] dark:bg-primary/[0.1] border-b md:border-b-0 md:border-r border-primary/10 px-5 py-4 md:px-6">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/75" aria-hidden="true" />
        <DevotionalHeading title={title} />
      </div>
      <div className="flex-1 flex items-center justify-center px-5 py-4 md:px-6 md:py-[17px] min-w-0 bg-white dark:bg-card">
        <div className="text-sm md:text-[15px] leading-[1.55] text-sidebar dark:text-foreground text-center w-full">
          {children}
        </div>
      </div>
    </article>
  );
}

export function AboutEssenceCards() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 pt-10 pb-6 md:pt-12 md:pb-8 bg-secondary/15 isolate">
      <div className="mx-auto w-full max-w-[1120px] px-4 flex flex-col gap-4 md:gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-stretch">
          <EssenceVerticalCard title={aboutText(t, "visionTitle")}>
            {aboutText(t, "visionStatement")}
          </EssenceVerticalCard>
          <EssenceVerticalCard title={aboutText(t, "missionTitle")}>
            {aboutText(t, "missionStatement")}
          </EssenceVerticalCard>
        </div>

        <EssenceHorizontalCard title={aboutText(t, "brandEssenceTitle")}>
          <BrandEssenceTagline />
        </EssenceHorizontalCard>
      </div>
    </section>
  );
}
