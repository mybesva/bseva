import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const PUJARI_REGISTER = "/register?role=pujari";

type CardProps = {
  eyebrow: string;
  title: string;
  bullets: string[];
  cta: string;
  href: string;
  image: string;
  imageAlt: string;
  tone: "customer" | "pujari";
};

function AudienceCard({ eyebrow, title, bullets, cta, href, image, imageAlt, tone }: CardProps) {
  const customer = tone === "customer";
  return (
    <article
      className={cn(
        "grid overflow-hidden rounded-3xl border shadow-sm sm:grid-cols-[1.2fr_1fr] lg:grid-cols-1 xl:grid-cols-[1.2fr_1fr]",
        customer
          ? "border-primary/25 bg-[#FFEFD8] dark:border-primary/30 dark:bg-[#2A1E14]"
          : "border-[#1A2B4A]/15 bg-[#E6EDF7] dark:border-[#6FA3E8]/25 dark:bg-[#13233B]",
      )}
    >
      <div className="order-2 flex flex-col p-6 sm:order-1 sm:p-8 lg:p-8">
        <p
          className={cn(
            "text-xs font-bold uppercase tracking-[0.2em]",
            customer ? "lp-orange-ink" : "text-[#1F4E8C] dark:text-[#8DB8F2]",
          )}
        >
          {eyebrow}
        </p>
        <h3 className="mt-2 text-balance font-display text-2xl font-bold leading-tight text-foreground md:text-[1.75rem]">
          {title}
        </h3>
        <ul className="mt-5 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-[0.9375rem] font-semibold leading-snug text-foreground">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
                  customer ? "bg-[#E26A00]" : "bg-[#1F4E8C] dark:bg-[#4C86D6]",
                )}
              >
                <Check size={12} strokeWidth={3.5} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-7 pt-1 sm:mt-auto">
          <Link href={href}>
            <a
              className={cn(
                "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-7 text-base font-bold shadow-md transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto",
                customer
                  ? "bg-primary text-primary-foreground focus-visible:ring-primary"
                  : "bg-[#1A2B4A] text-white focus-visible:ring-[#1A2B4A] dark:bg-[#2E5A99] dark:focus-visible:ring-[#6FA3E8]",
              )}
            >
              {cta}
              <ArrowRight size={18} aria-hidden className="lp-arrow" />
            </a>
          </Link>
        </div>
      </div>

      <div className="relative order-1 h-56 sm:order-2 sm:h-auto sm:min-h-[22rem] lg:h-64 xl:h-auto">
        <img
          src={image}
          alt={imageAlt}
          width={1000}
          height={750}
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            "[mask-image:linear-gradient(to_bottom,black_60%,transparent)] sm:[mask-image:linear-gradient(to_right,transparent,black_28%)] lg:[mask-image:linear-gradient(to_top,black_60%,transparent)] xl:[mask-image:linear-gradient(to_right,transparent,black_28%)]",
            customer ? "object-[60%_30%]" : "object-[40%_30%]",
          )}
        />
      </div>
    </article>
  );
}

export default function LandingAudience() {
  const { t } = useI18n();
  return (
    <section aria-label={`${t("lp.aud.cEyebrow")} / ${t("lp.aud.pEyebrow")}`} className="bg-background py-14 md:py-20">
      <div className="container grid gap-6 lg:grid-cols-2 lg:gap-8">
        <AudienceCard
          tone="customer"
          eyebrow={t("lp.aud.cEyebrow")}
          title={t("lp.aud.cTitle")}
          bullets={[t("lp.aud.c1"), t("lp.aud.c2"), t("lp.aud.c3"), t("lp.aud.c4"), t("lp.aud.c5")]}
          cta={t("lp.cta.book")}
          href="/services"
          image="/images/landing/customer-puja.jpg"
          imageAlt={t("lp.aud.cImgAlt")}
        />
        <AudienceCard
          tone="pujari"
          eyebrow={t("lp.aud.pEyebrow")}
          title={t("lp.aud.pTitle")}
          bullets={[t("lp.aud.p1"), t("lp.aud.p2"), t("lp.aud.p3"), t("lp.aud.p4"), t("lp.aud.p5")]}
          cta={t("lp.cta.joinPujari")}
          href={PUJARI_REGISTER}
          image="/images/landing/pujari-portrait.jpg"
          imageAlt={t("lp.aud.pImgAlt")}
        />
      </div>
    </section>
  );
}
