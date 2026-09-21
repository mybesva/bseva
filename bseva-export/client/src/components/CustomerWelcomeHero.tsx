import { Flower2, Heart, Leaf, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const HERO_ART = "/images/customer-hero-art.jpg";

const TRUST = [
  { key: "customer.hero.trust.rituals" as const, Icon: Leaf },
  { key: "customer.hero.trust.pujaris" as const, Icon: ShieldCheck },
  { key: "customer.hero.trust.services" as const, Icon: Users },
  { key: "customer.hero.trust.wellness" as const, Icon: Heart },
];

export function customerGreetingName(fullName: string | null | undefined, fallback: string) {
  const trimmed = String(fullName || "").trim();
  return trimmed || fallback;
}

function namasteParts(template: string) {
  const idx = template.indexOf("🙏");
  if (idx < 0) return { before: template, after: "" };
  return {
    before: template.slice(0, idx),
    after: template.slice(idx + "🙏".length).replace(/^\s+/, ""),
  };
}

function greetingClamp(name: string) {
  const n = name.trim().length;
  if (n > 28) return "clamp(1rem, 0.65rem + 1.45vw, 1.5rem)";
  if (n > 16) return "clamp(1.08rem, 0.72rem + 1.6vw, 1.85rem)";
  return "clamp(1.15rem, 0.8rem + 1.8vw, 2.25rem)";
}

export default function CustomerWelcomeHero({
  customerName,
}: {
  customerName: string;
  publicId?: string | null;
}) {
  const { t } = useI18n();
  const greeting = namasteParts(t("customer.hero.namaste", { name: customerName }));

  return (
    <section className="relative mb-8 overflow-hidden rounded-xl bg-[#FFF8E7] dark:bg-[#0B1424]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat bg-[position:78%_center]"
        style={{ backgroundImage: `url(${HERO_ART})` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFF8E7]/92 via-[#FFF8E7]/78 to-[#FFF8E7]/70 lg:bg-gradient-to-r lg:from-[#FFF8E7] lg:via-[#FFF8E7]/80 lg:to-transparent dark:from-[#0B1424]/92 dark:via-[#0B1424]/78 dark:to-[#0B1424]/55 lg:dark:from-[#0B1424] lg:dark:via-[#0B1424]/75 lg:dark:to-transparent"
        aria-hidden
      />

      <div className="relative z-[1] flex flex-col gap-3 p-4 sm:p-5 lg:block lg:h-[292px] lg:overflow-hidden lg:px-8 lg:py-6 xl:h-[300px]">
        <p className="mb-0 flex items-center gap-2 text-[11px] font-medium tracking-wide text-[#8B5A2B] lg:mb-2.5 dark:text-[#E8C990]">
          <Flower2 size={14} className="shrink-0 text-[#C45C2D]" aria-hidden />
          {t("customer.hero.tagline")}
          <span className="hidden h-px w-10 bg-[#C45C2D]/70 sm:block" aria-hidden />
        </p>

        <div className="min-w-0 max-w-xl lg:max-w-[min(100%,38rem)]">
          <h1
            className="max-w-full min-w-0 break-words hyphens-auto [overflow-wrap:anywhere] [word-break:break-word] pr-6 sm:pr-10 lg:pr-4 font-bold leading-[1.15] tracking-tight text-[#1A2B4A] dark:text-[#F7F1E4]"
            style={{ fontSize: greetingClamp(customerName) }}
          >
            {greeting.before}
            <span className="pr-[0.4em]">🙏</span>
            {greeting.after}
          </h1>
          <p className="mt-0 break-words text-[1.25rem] font-bold leading-[1.12] text-[#1A2B4A] sm:text-[1.5rem] lg:text-[36px] lg:leading-[1.08] dark:text-[#F7F1E4]">
            {t("customer.hero.welcome")}
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-[#1A2B4A] lg:mt-2 dark:text-[#F7F1E4]/90">
            {t("customer.hero.blessing")}
          </p>
          <p className="mt-0.5 max-w-[36rem] text-[13px] leading-snug text-[#2E4A6F] dark:text-[#C5D0E0]">
            {t("customer.hero.support")}
          </p>
        </div>

        <blockquote className="mt-6 flex max-w-md items-start gap-2.5 rounded-xl border border-[#E6D2A8] bg-white/80 px-3.5 py-2.5 shadow-sm backdrop-blur-sm lg:mt-8 lg:inline-flex lg:max-w-xl lg:items-center lg:gap-3 lg:px-4 lg:py-2 dark:border-[#D4AF37]/30 dark:bg-[#152238]/80">
          <span className="mt-0.5 shrink-0 font-serif text-2xl leading-none text-[#D4AF37] lg:mt-0 lg:text-[22px]" aria-hidden>
            “
          </span>
          <div className="min-w-0 lg:flex lg:flex-1 lg:items-center lg:gap-3">
            <p className="text-[13px] italic leading-snug text-[#1A2B4A] dark:text-[#F7F1E4]">
              {t("customer.hero.quote")}
            </p>
            <footer className="mt-0.5 text-right text-[11px] font-medium text-[#C45C2D] lg:mt-0 lg:whitespace-nowrap dark:text-[#FF9933]">
              — {t("customer.hero.quoteBy")}
            </footer>
          </div>
        </blockquote>

        <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-3 rounded-xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm backdrop-blur-md sm:gap-x-4 lg:absolute lg:bottom-6 lg:right-7 lg:mt-0 lg:w-auto lg:grid-cols-4 lg:gap-x-2.5 lg:px-3.5 lg:py-2 dark:border-white/10 dark:bg-[#152238]/80">
          {TRUST.map(({ key, Icon }) => (
            <li key={key} className="flex min-w-0 items-center gap-2 lg:w-[4.7rem] lg:flex-col lg:items-center lg:gap-1 lg:text-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#E07A2F] lg:h-7 lg:w-7">
                <Icon size={17} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 text-[11px] font-semibold leading-tight text-[#1A2B4A] lg:text-[10px] dark:text-[#F7F1E4]">
                {t(key)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
