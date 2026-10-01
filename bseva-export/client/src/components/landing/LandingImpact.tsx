import { Globe2, HandHeart, Languages, LayoutGrid } from "lucide-react";
import { LANGS } from "@bseva/locales";
import { useI18n } from "@/i18n/I18nProvider";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { TempleOutline } from "./DevotionalPatterns";

type Props = {
  categoryCount: number;
  /** Enabled Seva lines (Puja / Chadhava / Pravachan) from GET /seva/config; 0 when unknown. */
  sevaTypeCount: number;
};

/**
 * Trust / impact strip. Only REAL values are shown: live category count, supported languages,
 * enabled Seva lines and virtual-puja time zones from public config. No invented totals.
 */
export default function LandingImpact({ categoryCount, sevaTypeCount }: Props) {
  const { t } = useI18n();
  const { config } = usePublicConfig();
  const zoneCount = config.virtual_puja_enabled ? (config.customer_timezones?.length ?? 0) : 0;

  const stats = [
    { icon: LayoutGrid, value: categoryCount, label: t("lp.impact.categories") },
    { icon: Languages, value: LANGS.length, label: t("lp.impact.languages") },
    { icon: HandHeart, value: sevaTypeCount, label: t("lp.impact.sevaTypes") },
    { icon: Globe2, value: zoneCount, label: t("lp.impact.timezones") },
  ].filter((s) => s.value > 0);

  return (
    <section
      aria-labelledby="lp-impact-title"
      className="relative overflow-hidden bg-secondary/50 py-16 md:py-20 dark:bg-card/60"
    >
      <TempleOutline className="absolute inset-x-0 bottom-0 mx-auto h-[85%] w-auto text-sidebar opacity-[0.08] dark:text-white dark:opacity-[0.06]" />

      <div className="container relative z-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="lp-impact-title"
            className="text-balance font-display text-3xl font-bold leading-tight text-foreground md:text-4xl"
          >
            {t("lp.impact.title")}
          </h2>
          <p className="mt-3 text-base font-medium leading-relaxed text-foreground md:text-lg">{t("lp.impact.desc")}</p>
        </div>

        <ul
          className={`mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-x-4 gap-y-10 md:mt-12 ${
            stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
          }`}
        >
          {stats.map(({ icon: Icon, value, label }) => (
            <li key={label} className="flex flex-col items-center text-center">
              <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/60 text-brand-orange"
              >
                <Icon size={26} strokeWidth={1.5} />
              </span>
              <p className="mt-4 font-display text-4xl font-bold leading-none text-foreground md:text-5xl">{value}</p>
              <p className="mt-2 max-w-[11rem] text-sm font-bold leading-snug text-foreground">{label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
