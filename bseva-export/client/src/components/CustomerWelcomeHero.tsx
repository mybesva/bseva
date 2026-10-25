import { ArrowRight, Flower2, Heart, Leaf, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/i18n/I18nProvider";

const HERO_ART = "/images/landing/temple-sunrise.jpg";

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

/** Splits "Namaste 🙏 {{name}}!" around the name so the name can be highlighted in any language. */
function greetingParts(template: string, name: string) {
  const idx = template.indexOf(name);
  if (idx < 0) return { before: template, name: "", after: "" };
  return { before: template.slice(0, idx), name, after: template.slice(idx + name.length) };
}

export default function CustomerWelcomeHero({
  customerName,
}: {
  customerName: string;
  publicId?: string | null;
}) {
  const { t } = useI18n();
  const g = greetingParts(t("customer.hero.namaste", { name: customerName }), customerName);

  return (
    <section className="mb-6">
      <div className="relative isolate overflow-hidden rounded-3xl bg-[#071A33] text-white">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-full bg-cover bg-[position:70%_45%] opacity-60 sm:w-[70%] sm:opacity-100"
          style={{ backgroundImage: `url(${HERO_ART})` }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#071A33_0%,#071A33_38%,rgba(7,26,51,0.55)_60%,rgba(7,26,51,0.05)_100%)]"
          aria-hidden
        />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:p-9">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.18em] text-[#FF7A00]">
              <Flower2 size="0.9375rem" aria-hidden />
              {t("customer.hero.tagline")}
            </p>
            <h1 className="mt-3 break-words font-display text-[clamp(1.75rem,1.2rem+2vw,2.6rem)] font-semibold leading-[1.15]">
              {g.before}
              {g.name ? <span className="text-[#FF7A00]">{g.name}</span> : null}
              {g.after}
            </h1>
            <p className="mt-3 max-w-[36rem] text-[0.9375rem] font-medium leading-relaxed text-white/85">
              {t("customer.hero.welcome")} {t("customer.hero.blessing")} {t("customer.hero.support")}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/services?focus=pujas"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#FF7A00] px-5 text-sm font-bold text-[#0E1830] shadow-[0_10px_18px_-10px_rgba(255,122,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t("nav.bookPuja")} <ArrowRight size="1rem" aria-hidden />
              </Link>
              <Link
                href="/customer/bookings"
                className="inline-flex h-11 items-center rounded-xl border-[1.5px] border-white/60 px-5 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t("nav.bookings")}
              </Link>
            </div>
          </div>

          <blockquote className="relative justify-self-end rounded-2xl border border-[#D4AF37]/45 bg-[#071A33]/60 px-5 pb-4 pt-5 backdrop-blur-md lg:max-w-[22rem]">
            <span className="absolute -top-5 left-4 font-display text-5xl leading-none text-[#D4AF37]" aria-hidden>
              “
            </span>
            <p className="font-display text-[1.0625rem] font-semibold leading-snug">{t("customer.hero.quote")}</p>
            <footer className="mt-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#D4AF37]">
              — {t("customer.hero.quoteBy")}
            </footer>
          </blockquote>
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#EFE2CF] bg-white lg:grid-cols-4 dark:border-white/10 dark:bg-[#152238]">
        {TRUST.map(({ key, Icon }, i) => (
          <li
            key={key}
            className={`flex min-w-0 items-center gap-3 px-4 py-3.5 text-sm font-bold text-[#0E1830] dark:text-white ${
              i % 2 ? "border-l border-[#EFE2CF] dark:border-white/10" : ""
            } ${i > 1 ? "border-t lg:border-t-0 border-[#EFE2CF] dark:border-white/10" : ""} ${
              i === 2 ? "lg:border-l" : ""
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E2] text-[#FF7A00] dark:bg-[#FF7A00]/15">
              <Icon size="1.125rem" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0 leading-tight">{t(key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
