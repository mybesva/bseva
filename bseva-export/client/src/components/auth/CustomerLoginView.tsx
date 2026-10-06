import { Bell, Calendar, Heart, Lock, Mail, Sparkles, Star, UserPlus, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PasswordInput from "@/components/PasswordInput";
import DevotionalImageFrame from "@/components/DevotionalImageFrame";
import { HangingDiya, LotusMark, MandalaOutline } from "@/components/landing/DevotionalPatterns";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const CUSTOMER_SCENE = "/images/customer-login-scene-clean.webp";
const PUJARI_SCENE = "/images/pujari-login-scene-clean.webp";

const fieldClass =
  "h-11 rounded-lg border-[#E4D5C3] bg-white pl-10 text-[15px] font-medium text-[#0E1830] shadow-none placeholder:text-[#5C6578] focus-visible:border-[#FF7A00] focus-visible:ring-[#FF7A00]/35 dark:border-[#2F4568] dark:bg-[#0E1A2E] dark:text-white dark:placeholder:text-[#C5D0DE]";

type BenefitIconName = "calendar" | "heart" | "bell" | "lotus" | "users" | "star";

type Benefit = {
  icon: BenefitIconName;
  title: string;
  body: string;
};

function BenefitIcon({ icon }: { icon: BenefitIconName }) {
  const common = { size: 18, strokeWidth: 1.75, "aria-hidden": true as const };
  if (icon === "calendar") return <Calendar {...common} />;
  if (icon === "heart") return <Heart {...common} />;
  if (icon === "bell") return <Bell {...common} />;
  if (icon === "users") return <Users {...common} />;
  if (icon === "star") return <Star {...common} />;
  return <LotusMark className="h-[18px] w-[18px]" />;
}

function BenefitList({ items, className }: { items: Benefit[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {items.map((item) => (
        <li key={item.title} className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
            <BenefitIcon icon={item.icon} />
          </span>
          <span className="min-w-0 pt-0.5">
            <span className="block text-[15px] font-bold leading-tight text-[#0E1830] dark:text-white">{item.title}</span>
            <span className="mt-0.5 block text-sm font-medium leading-snug text-[#1A2B4A] dark:text-[#E8ECF0]">{item.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function CustomerLoginView({
  variant = "customer",
  identifier,
  password,
  pending,
  onIdentifier,
  onPassword,
  onSubmit,
  registerHref,
  onSharedLogin,
}: {
  variant?: "customer" | "pujari";
  identifier: string;
  password: string;
  pending: boolean;
  onIdentifier: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  registerHref: string;
  onSharedLogin: () => void;
}) {
  const { t } = useI18n();
  const pujari = variant === "pujari";

  const benefits: Benefit[] = pujari
    ? [
        { icon: "calendar", title: t("pl.b1t"), body: t("pl.b1d") },
        { icon: "users", title: t("pl.b2t"), body: t("pl.b2d") },
        { icon: "lotus", title: t("pl.b3t"), body: t("pl.b3d") },
        { icon: "star", title: t("pl.b4t"), body: t("pl.b4d") },
      ]
    : [
        { icon: "calendar", title: t("cl.b1t"), body: t("cl.b1d") },
        { icon: "heart", title: t("cl.b2t"), body: t("cl.b2d") },
        { icon: "bell", title: t("cl.b3t"), body: t("cl.b3d") },
        { icon: "lotus", title: t("cl.b4t"), body: t("cl.b4d") },
      ];

  const scene = pujari ? PUJARI_SCENE : CUSTOMER_SCENE;
  const titleId = pujari ? "pujari-login-title" : "customer-login-title";
  const fieldPrefix = pujari ? "pujari" : "customer";

  return (
    <section
      aria-labelledby={titleId}
      className="soften-brand-mark relative flex flex-1 flex-col overflow-hidden bg-[#FDF6EC] text-[#0E1830] dark:bg-[#0B1424] dark:text-white"
    >
      <MandalaOutline className="absolute -left-36 -top-40 h-[28rem] w-[28rem] text-[#E8B15A] opacity-0 dark:opacity-[0.16]" />
      <MandalaOutline className="absolute -right-24 top-8 hidden h-80 w-80 text-[#E8B15A] opacity-[0.12] lg:block dark:opacity-[0.08]" />
      <MandalaOutline className="absolute -bottom-32 -right-20 h-72 w-72 text-[#E8B15A] opacity-[0.14] dark:opacity-[0.08]" />
      <HangingDiya className={cn("absolute right-6 top-0 z-20 hidden h-28 w-10 text-[#D4922A] dark:text-[#FF7A00]/85", pujari ? "xl:block" : "lg:block")} />
      <HangingDiya className={cn("absolute right-20 top-0 z-20 hidden h-36 w-11 text-[#E0A04A] dark:text-[#FF7A00]/75", pujari ? "xl:block" : "lg:block")} />

      <div className="relative z-10 mx-auto my-auto flex w-full max-w-[100rem] flex-col px-5 py-6 sm:px-6 xl:px-14">
        <div className="mb-6 flex justify-center xl:hidden">
          <DevotionalImageFrame
            src={scene}
            alt={t(pujari ? "pl.imgAlt" : "cl.imgAlt")}
            width={pujari ? 750 : 618}
            height={pujari ? 1284 : 1278}
            objectPosition={pujari ? "30% 0%" : "50% 72%"}
            priority
            className="aspect-[25/36] w-[220px] sm:w-[250px]"
          />
        </div>

      <div className={cn(
        "flex w-full flex-col gap-8",
        pujari
          ? "xl:flex-row xl:items-center xl:gap-8"
          : "lg:flex-row lg:items-center lg:gap-8 xl:gap-10",
      )}>
        <div className="relative hidden shrink-0 self-center xl:block">
          <MandalaOutline className="pointer-events-none absolute -inset-10 text-[#E8B15A] opacity-[0.14] dark:opacity-[0.08]" />
          <DevotionalImageFrame
            src={scene}
            alt={t(pujari ? "pl.imgAlt" : "cl.imgAlt")}
            width={pujari ? 750 : 618}
            height={pujari ? 1284 : 1278}
            objectPosition={pujari ? "30% 0%" : "50% 72%"}
            priority
            className="aspect-[25/36] w-[300px] 2xl:w-[330px]"
          />
        </div>
        <div className="min-w-0 flex-1 lg:max-w-[34rem]">
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF7A00] sm:text-xs">
            <span aria-hidden className="text-[#FF7A00]/80">—</span>
            <span>{t("cl.eyebrow")}</span>
            <span aria-hidden className="text-[#FF7A00]/80">—</span>
          </p>

          <h1
            id={titleId}
            className="mt-3 text-[clamp(1.85rem,1.2rem+1.8vw,2.7rem)] font-bold leading-[1.12] tracking-tight"
          >
            <span className="block text-[#0E1830] dark:text-white">{t(pujari ? "pl.title1" : "cl.title1")}</span>
            <span className="block text-[#FF7A00]">{t(pujari ? "pl.title2" : "cl.title2")}</span>
          </h1>

          <p className={cn("mt-3 text-[15px] font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0] sm:text-base", pujari ? "max-w-[26rem]" : "max-w-[28rem]")}>
            {pujari ? <span className="font-bold text-[#0E1830] dark:text-white">{t("pl.lead")}</span> : null}
            {t(pujari ? "pl.desc" : "cl.desc")}
          </p>

          <BenefitList items={benefits} className={pujari ? "mt-6 hidden xl:flex" : "mt-6 hidden lg:flex"} />
        </div>

        <div className={cn("w-full shrink-0", pujari ? "xl:w-[clamp(26.5rem,34vw,30rem)]" : "lg:w-[min(100%,30rem)]")}>
          <div className="rounded-2xl border border-[#F0CBA8] bg-white px-5 py-6 shadow-[0_10px_32px_-22px_rgba(160,90,30,0.45)] sm:px-7 sm:py-7 dark:border-[#FF7A00]/35 dark:bg-[#152238] dark:shadow-none">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
                {pujari ? <Sparkles size={20} strokeWidth={1.75} aria-hidden /> : <Users size={20} strokeWidth={1.75} aria-hidden />}
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-xl font-bold leading-tight text-[#0E1830] dark:text-white">
                  {t(pujari ? "auth.pujariLogin" : "auth.customerLogin")}
                </h2>
                <p className={cn("mt-1 text-sm font-medium leading-snug", pujari ? "text-[#FF7A00]" : "text-[#1A2B4A] dark:text-[#E8ECF0]")}>
                  {t(pujari ? "auth.pujariLoginHint" : "auth.customerLoginHint")}
                </p>
              </div>
            </div>

            <form className="mt-5 space-y-3.5" onSubmit={onSubmit} autoComplete="off">
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldPrefix}-identifier`} className="text-sm font-semibold text-[#0E1830] dark:text-white">
                  {t("auth.emailOrPhone")}
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#1A2B4A] dark:text-[#E8ECF0]" aria-hidden />
                  <Input
                    id={`${fieldPrefix}-identifier`}
                    value={identifier}
                    onChange={(e) => onIdentifier(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder={t("cl.emailPh")}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${fieldPrefix}-password`} className="text-sm font-semibold text-[#0E1830] dark:text-white">
                  {t("auth.password")}
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#1A2B4A] dark:text-[#E8ECF0]" aria-hidden />
                  <PasswordInput
                    id={`${fieldPrefix}-password`}
                    value={password}
                    onChange={(e) => onPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder={t("cl.passwordPh")}
                    showLabel={t("cl.showPassword")}
                    hideLabel={t("cl.hidePassword")}
                    className={fieldClass}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={pending}
                className="h-11 w-full rounded-lg bg-[#FF7A00] text-[15px] font-bold text-white hover:bg-[#F07400]"
              >
                {pending ? t("auth.loggingIn") : t(pujari ? "auth.loginAsPujari" : "auth.loginAsCustomer")}
              </Button>
            </form>

            <div className="my-3.5 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-[#E7E0D6] dark:bg-[#2F4568]" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5C6578] dark:text-[#C5D0DE]">{t("common.or")}</span>
              <span className="h-px flex-1 bg-[#E7E0D6] dark:bg-[#2F4568]" />
            </div>

            <Link href={registerHref}>
              <a className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-[#FF7A00] bg-white text-[15px] font-bold text-[#FF7A00] transition-colors hover:bg-[#FFF4EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] focus-visible:ring-offset-2 dark:bg-transparent dark:hover:bg-[#FF7A00]/10">
                <UserPlus size={18} strokeWidth={1.75} aria-hidden />
                {t(pujari ? "pl.createNew" : "cl.createNew")}
              </a>
            </Link>

            <p className="mt-4 text-center text-sm font-medium text-[#1A2B4A] dark:text-[#E8ECF0]">
              {t("auth.newHere")}{" "}
              <Link href={registerHref}>
                <a className="font-semibold text-[#FF7A00] underline underline-offset-2 hover:text-[#E06C00]">
                  {t(pujari ? "auth.createPujariAccount" : "auth.createCustomerAccount")}
                </a>
              </Link>
            </p>
            <p className="mt-1.5 text-center text-sm font-medium text-[#1A2B4A] dark:text-[#E8ECF0]">
              {t("auth.orUseShared")}{" "}
              <button
                type="button"
                onClick={onSharedLogin}
                className="font-semibold text-[#FF7A00] underline underline-offset-2 hover:text-[#E06C00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] rounded-sm"
              >
                {t("auth.loginPage")}
              </button>
            </p>
          </div>
        </div>

        <BenefitList
          items={benefits}
          className={pujari ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8 xl:hidden" : "hidden sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4 lg:hidden"}
        />
      </div>
      </div>
    </section>
  );
}
