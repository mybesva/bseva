import type { ReactNode } from "react";
import { Eye, Gem, Target } from "lucide-react";
import { PUJA_OM, PUJA_SWASTIKA } from "@bseva/locales";
import { useI18n } from "@/i18n/I18nProvider";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

function DevotionalTitle({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <h2
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold leading-tight ${
        light ? "text-white" : "text-[#0E1830] dark:text-white"
      }`}
    >
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

function SideCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-[#F0E2D2] bg-white p-6 shadow-[0_24px_44px_-34px_rgba(120,70,20,0.55)] lg:p-7 dark:border-white/10 dark:bg-[#152238]">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
          {icon}
        </span>
        <DevotionalTitle>{title}</DevotionalTitle>
      </div>
      <p className="mt-4 text-[15px] font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0]">{children}</p>
    </article>
  );
}

function EssenceLine({ lead, rest }: { lead: string; rest: string }) {
  return (
    <p className="text-[1.6rem] font-bold leading-tight lg:text-[1.75rem]">
      <span className="text-[#FF8A1F]">{lead} </span>
      <span className="text-white">{rest}</span>
    </p>
  );
}

/**
 * Vision · Brand Essence · Mission. The brand essence is the featured navy card in the middle;
 * on desktop the row lifts over the bottom edge of the hero.
 */
export function AboutEssenceCards() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 bg-[#FDF6EC] dark:bg-[#0B1424]" aria-label={t("ab.vision")}>
      <div className="container grid grid-cols-1 gap-5 py-8 md:grid-cols-2 lg:-mt-10 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-stretch lg:gap-6 lg:pb-6 lg:pt-0">
        <SideCard icon={<Eye size={22} strokeWidth={1.75} aria-hidden />} title={t("ab.vision")}>
          {t("ab.visionBody")}
        </SideCard>

        <article className="relative order-first flex flex-col justify-center overflow-hidden rounded-3xl bg-[#071A33] p-7 text-white shadow-[0_30px_60px_-30px_rgba(7,26,51,0.8)] ring-1 ring-[#D4AF37]/40 md:col-span-2 lg:order-none lg:col-span-1 lg:p-8">
          <MandalaOutline className="pointer-events-none absolute -bottom-20 -right-16 h-60 w-60 text-[#E8B15A] opacity-[0.16]" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F0C35A] to-[#C98A1A] text-[#071A33]">
              <Gem size={22} strokeWidth={1.9} aria-hidden />
            </span>
            <DevotionalTitle light>{t("ab.essence")}</DevotionalTitle>
          </div>
          <div className="relative mt-5 space-y-1.5">
            <EssenceLine lead={t("ab.bookA")} rest={t("ab.bookB")} />
            <EssenceLine lead={t("ab.believeA")} rest={t("ab.believeB")} />
            <EssenceLine lead={t("ab.blessA")} rest={t("ab.blessB")} />
          </div>
        </article>

        <SideCard icon={<Target size={22} strokeWidth={1.75} aria-hidden />} title={t("ab.mission")}>
          {t("ab.missionBody")}
        </SideCard>
      </div>
    </section>
  );
}
