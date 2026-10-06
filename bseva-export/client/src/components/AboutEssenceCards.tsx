import type { ReactNode } from "react";
import { Eye, Gem, Target } from "lucide-react";
import { PUJA_OM, PUJA_SWASTIKA } from "@bseva/locales";
import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";
import { cn } from "@/lib/utils";

function DevotionalTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold leading-tight text-[#0E1830] dark:text-white">
      <span className="text-[#FF7A00]" aria-hidden>
        {PUJA_OM}
      </span>
      <span>{children}</span>
      <span className="text-[#FF7A00]" aria-hidden>
        {PUJA_SWASTIKA}
      </span>
    </h2>
  );
}

function EssenceLine({ lead, rest }: { lead: string; rest: string }) {
  return (
    <p className="text-xl font-bold leading-snug md:text-[1.35rem]">
      <span className="text-[#FF7A00]">{lead} </span>
      <span className="text-[#0E1830] dark:text-white">{rest}</span>
    </p>
  );
}

function EssenceCard({
  icon,
  title,
  emphasized,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  emphasized?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl bg-white px-6 py-7 shadow-[0_10px_28px_-22px_rgba(120,70,20,0.45)] dark:bg-[#152238]",
        emphasized
          ? "border-2 border-[#FF7A00] bg-[#FFF8F2] dark:bg-[#1A2740]"
          : "border border-[#F0E2D2] dark:border-white/10",
        className,
      )}
    >
      {emphasized ? (
        <MandalaOutline className="absolute -bottom-16 -right-12 h-44 w-44 text-[#E8B15A] opacity-[0.2] dark:opacity-[0.12]" />
      ) : null}
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
        {icon}
      </span>
      <DevotionalTitle>{title}</DevotionalTitle>
      <div className="relative mt-3 text-[15px] font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0]">{children}</div>
    </article>
  );
}

/** Vision, mission, and brand essence — three equal cards under the About hero. */
export function AboutEssenceCards() {
  const { t } = useI18n();

  return (
    <section className="bg-[#FDF6EC] dark:bg-[#0B1424]" aria-label={t("ab.vision")}>
      <div className="container grid grid-cols-1 gap-5 py-10 md:grid-cols-2 md:py-12 lg:grid-cols-3 lg:gap-6 lg:py-14">
        <EssenceCard icon={<Eye size={20} strokeWidth={1.75} aria-hidden />} title={t("ab.vision")}>
          {t("ab.visionBody")}
        </EssenceCard>
        <EssenceCard icon={<Target size={20} strokeWidth={1.75} aria-hidden />} title={t("ab.mission")}>
          {t("ab.missionBody")}
        </EssenceCard>
        <EssenceCard icon={<Gem size={20} strokeWidth={1.75} aria-hidden />} title={t("ab.essence")} emphasized className="md:col-span-2 lg:col-span-1">
          <div className="space-y-1">
            <EssenceLine lead={t("ab.bookA")} rest={t("ab.bookB")} />
            <EssenceLine lead={t("ab.believeA")} rest={t("ab.believeB")} />
            <EssenceLine lead={t("ab.blessA")} rest={t("ab.blessB")} />
          </div>
        </EssenceCard>
      </div>
    </section>
  );
}
