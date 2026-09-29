import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { aboutText, PUJA_OM, PUJA_SWASTIKA } from "@bseva/locales";

function DevotionalHeading({ title }: { title: string }) {
  return (
    <h2 className="font-heading font-semibold text-[14px] md:text-[15px] text-sidebar dark:text-foreground whitespace-nowrap flex items-center gap-x-1.5 leading-none">
      <span className="text-primary text-[15px] md:text-base select-none shrink-0" aria-hidden="true">
        {PUJA_OM}
      </span>
      <span className="shrink-0">{title}</span>
      <span className="text-primary text-[15px] md:text-base select-none shrink-0" aria-hidden="true">
        {PUJA_SWASTIKA}
      </span>
    </h2>
  );
}

function BrandEssenceTagline() {
  const { t } = useI18n();

  return (
    <p className="text-sm md:text-[15px] font-heading leading-snug text-sidebar dark:text-foreground lg:whitespace-nowrap">
      <span>
        <span className="text-primary font-bold">{aboutText(t, "brandEssenceBook")}</span>
        {aboutText(t, "brandEssenceWithEase")}
      </span>{" "}
      <span>
        <span className="text-primary font-bold">{aboutText(t, "brandEssenceBelieve")}</span>
        {aboutText(t, "brandEssenceWithFaith")}
      </span>{" "}
      <span>
        <span className="text-primary font-bold">{aboutText(t, "brandEssenceBless")}</span>
        {aboutText(t, "brandEssenceThroughSeva")}
      </span>
    </p>
  );
}

function EssenceStatementCard({
  title,
  align,
  children,
}: {
  title: string;
  align: "left" | "right";
  children: ReactNode;
}) {
  const positionClass = align === "right" ? "md:ml-auto" : "md:mr-auto";

  return (
    <article
      className={`w-full md:w-[88%] ${positionClass} overflow-hidden rounded-[14px] border border-primary/15 bg-white dark:bg-card shadow-[0_2px_14px_rgba(0,0,0,0.05)] flex flex-col md:flex-row md:items-stretch relative z-10`}
    >
      <div className="relative shrink-0 flex items-center md:w-[260px] bg-primary/[0.07] dark:bg-primary/[0.1] border-b md:border-b-0 md:border-r border-primary/10 px-5 py-4 md:px-5 md:py-[17px]">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/75" aria-hidden="true" />
        <DevotionalHeading title={title} />
      </div>

      <div className="flex-1 flex items-center px-5 py-4 md:px-6 md:py-[17px] min-w-0 bg-white dark:bg-card">
        <div className="text-sm md:text-[15px] leading-[1.55] text-sidebar dark:text-foreground text-left w-full">
          {children}
        </div>
      </div>
    </article>
  );
}

export function AboutEssenceCards() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 pt-10 pb-12 md:pt-12 md:pb-14 bg-secondary/15 isolate">
      <div className="mx-auto w-full max-w-[1120px] px-4 flex flex-col gap-4 md:gap-5">
        <EssenceStatementCard title={aboutText(t, "visionTitle")} align="left">
          {aboutText(t, "visionStatement")}
        </EssenceStatementCard>

        <EssenceStatementCard title={aboutText(t, "missionTitle")} align="right">
          {aboutText(t, "missionStatement")}
        </EssenceStatementCard>

        <EssenceStatementCard title={aboutText(t, "brandEssenceTitle")} align="left">
          <BrandEssenceTagline />
        </EssenceStatementCard>
      </div>
    </section>
  );
}
