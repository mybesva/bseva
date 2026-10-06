import Layout from "@/components/Layout";
import { PublishedStatsStrip } from "@/components/PublishedStatsStrip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";
import { useI18n } from "@/i18n/I18nProvider";
import { usePublicConfig, telHref, whatsappHref } from "@/hooks/usePublicConfig";
import { api } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/supportTickets";
import { CUSTOMER_SUPPORT_CATS } from "@bseva/config";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  User,
  Loader2,
} from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEN_DIGIT_RE = /^\d{10}$/;

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
] as const;

const FAQ = [
  { q: "ct.q1", a: "ct.a1" },
  { q: "ct.q2", a: "ct.a2" },
  { q: "ct.q3", a: "ct.a3" },
  { q: "ct.q4", a: "ct.a4" },
  { q: "ct.q5", a: "ct.a5" },
] as const;

type FormState = {
  name: string;
  email: string;
  country_code: string;
  phone: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  name: "",
  email: "",
  country_code: "+91",
  phone: "",
  subject: "",
  message: "",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-[#F0D2B4] bg-white text-sm font-medium text-[#0E1830] placeholder:text-[#7C8798] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]/45 dark:border-white/15 dark:bg-[#0F1A2E] dark:text-white dark:placeholder:text-[#9AA6B8]";

function RequiredMark() {
  return (
    <span className="text-[#FF7A00]" aria-hidden>
      {" "}
      *
    </span>
  );
}

function ArrowLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FF7A00] text-[#FF7A00] hover:bg-[#FFF4EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]"
    >
      <ChevronRight size={16} aria-hidden />
    </a>
  );
}

function InfoCard({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-[#F0E2D2] bg-white px-4 py-3.5 shadow-[0_10px_24px_-18px_rgba(120,70,20,0.55)] dark:border-white/10 dark:bg-[#152238]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold text-[#0E1830] dark:text-white">{title}</h3>
        <div className="mt-0.5 text-sm font-medium leading-snug text-[#1A2B4A] dark:text-[#E8ECF0]">{children}</div>
      </div>
      {action ?? (
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FF7A00]/70 text-[#FF7A00]">
          <ChevronRight size={16} />
        </span>
      )}
    </article>
  );
}

export default function Contact() {
  const { t, lang } = useI18n();
  const { config } = usePublicConfig();
  const phoneDigits = String(config.bseva_whatsapp_number || "919014654994").replace(/\D/g, "");
  const phoneDisplay =
    phoneDigits.length === 12 && phoneDigits.startsWith("91")
      ? `+91 ${phoneDigits.slice(2, 7)} ${phoneDigits.slice(7)}`
      : `+${phoneDigits}`;
  const supportEmail = config.email_from_support || "support@b-seva.com";
  const contactEmail = config.email_from_contact || "contact@b-seva.com";

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formId = useId();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  function validate(values: FormState): FormErrors {
    const next: FormErrors = {};
    if (!values.name.trim() || values.name.trim().length < 2) next.name = t("contact.errName");
    if (!values.email.trim() || !EMAIL_RE.test(values.email.trim())) next.email = t("contact.errEmail");
    const code = (values.country_code || "+91").trim() || "+91";
    if (!/^\+?\d{1,4}$/.test(code.replace(/\s/g, ""))) next.country_code = t("contact.errCountryCode");
    const phoneDigitsOnly = values.phone.replace(/\D/g, "");
    if (code.replace(/\s/g, "") === "+91" || code.replace(/\s/g, "") === "91") {
      if (!TEN_DIGIT_RE.test(phoneDigitsOnly)) next.phone = t("contact.errPhone");
    } else if (phoneDigitsOnly.length < 6 || phoneDigitsOnly.length > 15) {
      next.phone = t("contact.errPhoneIntl");
    }
    if (!values.subject.trim()) next.subject = t("contact.errSubject");
    if (!values.message.trim() || values.message.trim().length < 10) next.message = t("contact.errMessage");
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(t("contact.errRequired"));
      return;
    }
    const subjectLabel = CATEGORY_LABELS[form.subject] || form.subject;
    setSubmitting(true);
    try {
      const res = await api<{ ok: boolean; message?: string }>("/support/contact", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          country_code: form.country_code.trim() || "+91",
          phone: form.phone.trim(),
          subject: subjectLabel,
          message: form.message.trim(),
        }),
      });
      setSubmitted(true);
      setForm(emptyForm);
      setErrors({});
      toast.success(res.message || t("contact.success"));
    } catch (err: any) {
      toast.error(err?.message || t("contact.errSend"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <section
        aria-labelledby="contact-hero-title"
        className="contact-hero-banner relative isolate overflow-hidden text-white"
        style={{ backgroundColor: "#051831" }}
      >
        {/* Soft lighter vignette + mandala texture on the navy side, as in the reference */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 45% 85% at 0% 30%, rgba(60,80,110,0.12) 0%, rgba(5,24,49,0) 70%)",
          }}
        />
        <MandalaOutline className="pointer-events-none absolute -left-40 -top-32 h-[30rem] w-[30rem] text-white opacity-[0.045]" />
        <MandalaOutline className="pointer-events-none absolute -bottom-48 left-[22%] h-[26rem] w-[26rem] text-white opacity-[0.035]" />
        <MandalaOutline className="pointer-events-none absolute -top-40 left-[38%] hidden h-[22rem] w-[22rem] text-white opacity-[0.03] lg:block" />
        {/* Photo fades into the navy instead of starting on a hard edge */}
        <img
          src="/images/contact-hero-temple.webp"
          alt={t("ct.heroAlt")}
          width={1674}
          height={768}
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[90%] max-w-none object-cover object-[78%_50%] [mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.55)_25%,#000_45%)] sm:w-[75%] lg:w-[52%] lg:object-center lg:[mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.65)_9%,#000_20%)]"
        />
        <div
          className="absolute inset-0 lg:hidden"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(5,24,49,0.97) 0%, rgba(5,24,49,0.88) 50%, rgba(5,24,49,0.35) 100%)",
          }}
        />
        <div className="relative z-10 mx-auto flex h-[430px] w-full max-w-[1920px] items-center px-[7%] sm:h-[450px] lg:h-[clamp(330px,22.5vw,440px)]">
          <div className="max-w-[40rem] lg:max-w-[46%]">
            <p className="inline-flex rounded-full border-[1.5px] border-[#FF7A00] px-5 py-1.5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#FF7A00] lg:px-[1.6em] lg:py-[0.45em] lg:text-[clamp(14px,0.95vw,17px)]">
              {t("ct.eyebrow")}
            </p>
            <h1
              id="contact-hero-title"
              className={`mt-5 font-sans text-[clamp(2rem,6vw,2.6rem)] font-extrabold leading-[1.08] tracking-[-0.025em] lg:mt-[1.1vw] lg:text-[clamp(48px,3.85vw,72px)] ${lang === "en" ? "lg:whitespace-nowrap" : ""}`}
            >
              <span className="text-white">{t("ct.hero1")} </span>
              <span className="text-[#FF7A00]">{t("ct.hero2")}</span>
            </h1>
            <p className="mt-4 max-w-[34rem] text-[17px] font-medium leading-[1.55] text-white/90 antialiased lg:mt-[1.6vw] lg:max-w-none lg:whitespace-pre-line lg:text-[clamp(18px,1.17vw,22px)] lg:leading-[1.6]">
              {t("ct.heroDesc")}
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#FDF6EC] dark:bg-[#0B1424]">
        <MandalaOutline className="pointer-events-none absolute -left-28 top-16 h-72 w-72 text-[#E8B15A] opacity-[0.16] dark:opacity-[0.08]" />
        <MandalaOutline className="pointer-events-none absolute -right-24 top-24 h-80 w-80 text-[#E8B15A] opacity-[0.14] dark:opacity-[0.08]" />
        <div className="container relative grid items-start gap-8 py-10 md:py-12 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:gap-10 xl:py-14">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#0E1830] dark:text-white md:text-[1.7rem]">{t("contact.title")}</h2>
            <p className="mt-2 max-w-md text-[15px] font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0]">{t("contact.infoDesc")}</p>
            <div className="mt-5 space-y-3">
              <InfoCard
                icon={<Phone size={18} strokeWidth={1.75} aria-hidden />}
                title={t("contact.phone")}
                action={<ArrowLink href={whatsappHref(config.bseva_whatsapp_number)} label="WhatsApp" external />}
              >
                <a href={telHref(config.bseva_whatsapp_number)} className="hover:text-[#FF7A00]">
                  {phoneDisplay}
                </a>
                <br />
                <a href={whatsappHref(config.bseva_whatsapp_number)} target="_blank" rel="noopener noreferrer" className="text-[13px] hover:text-[#FF7A00]">
                  {t("ct.phoneHint")}
                </a>
              </InfoCard>
              <InfoCard
                icon={<Mail size={18} strokeWidth={1.75} aria-hidden />}
                title={t("contact.email")}
                action={<ArrowLink href={`mailto:${supportEmail}`} label={supportEmail} />}
              >
                <a href={`mailto:${supportEmail}`} className="hover:text-[#FF7A00]">
                  {supportEmail}
                </a>
                <br />
                <a href={`mailto:${contactEmail}`} className="hover:text-[#FF7A00]">
                  {contactEmail}
                </a>
                <br />
                <span className="text-[13px]">{t("ct.emailHint")}</span>
              </InfoCard>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[#FF9A3C] bg-white px-5 py-6 shadow-[0_16px_40px_-28px_rgba(120,70,20,0.55)] sm:px-7 sm:py-7 dark:border-[#FF7A00] dark:bg-[#152238]">
            <MandalaOutline className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 text-[#E8B15A] opacity-25 dark:opacity-[0.12]" />
            <div className="relative flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
                <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#0E1830] dark:text-white">{t("contact.sendMessage")}</h2>
                <p className="mt-0.5 text-sm font-medium text-[#1A2B4A] dark:text-[#C9D2DE]">{t("contact.requiredNote")}</p>
              </div>
            </div>

            {submitted ? (
              <div className="relative mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" size={26} aria-hidden />
                  <div>
                    <h3 className="font-bold text-[#0E1830] dark:text-white">{t("contact.successTitle")}</h3>
                    <p className="mt-1 text-sm font-medium text-[#1A2B4A] dark:text-[#E8ECF0]">{t("contact.success")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-lg border border-[#FF7A00] px-5 text-sm font-bold text-[#FF7A00]"
                >
                  {t("contact.sendAnother")}
                </button>
              </div>
            ) : (
              <form className="relative mt-6 space-y-4" onSubmit={onSubmit} noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${formId}-name`} className="text-sm font-bold text-[#0E1830] dark:text-white">
                      {t("auth.name")}
                      <RequiredMark />
                    </label>
                    <div className="relative mt-1.5">
                      <User size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1A2B4A] dark:text-[#C9D2DE]" />
                      <input
                        id={`${formId}-name`}
                        name="name"
                        autoComplete="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={t("ct.namePh")}
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? `${formId}-name-err` : undefined}
                        className={`${fieldClass} pl-10 pr-3`}
                      />
                    </div>
                    {errors.name ? (
                      <p id={`${formId}-name-err`} className="mt-1 text-xs font-medium text-red-600" role="alert">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor={`${formId}-email`} className="text-sm font-bold text-[#0E1830] dark:text-white">
                      {t("ct.emailLabel")}
                      <RequiredMark />
                    </label>
                    <div className="relative mt-1.5">
                      <Mail size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1A2B4A] dark:text-[#C9D2DE]" />
                      <input
                        id={`${formId}-email`}
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder={t("contact.emailPh")}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? `${formId}-email-err` : undefined}
                        className={`${fieldClass} pl-10 pr-3`}
                      />
                    </div>
                    {errors.email ? (
                      <p id={`${formId}-email-err`} className="mt-1 text-xs font-medium text-red-600" role="alert">
                        {errors.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label htmlFor={`${formId}-phone`} className="text-sm font-bold text-[#0E1830] dark:text-white">
                    {t("auth.phone")}
                    <RequiredMark />
                  </label>
                  <div className="mt-1.5 flex h-11 overflow-hidden rounded-lg border border-[#F0D2B4] bg-white focus-within:ring-2 focus-within:ring-[#FF7A00]/45 dark:border-white/15 dark:bg-[#0F1A2E]">
                    <select
                      id={`${formId}-code`}
                      name="country_code"
                      aria-label={t("contact.countryCode")}
                      value={form.country_code}
                      onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                      className="w-[4.75rem] shrink-0 border-r border-[#F0D2B4] bg-transparent px-1 text-center text-sm font-bold text-[#0E1830] focus-visible:outline-none dark:border-white/15 dark:text-white"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                    <div className="relative min-w-0 flex-1">
                      <Phone size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1A2B4A] dark:text-[#C9D2DE]" />
                      <input
                        id={`${formId}-phone`}
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder={form.country_code === "+91" ? t("contact.phonePhIndia") : t("contact.phonePh")}
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone || errors.country_code ? `${formId}-phone-err` : undefined}
                        className="h-full w-full bg-transparent pl-9 pr-3 text-sm font-medium text-[#0E1830] placeholder:text-[#7C8798] focus-visible:outline-none dark:text-white"
                      />
                    </div>
                  </div>
                  {errors.country_code || errors.phone ? (
                    <p id={`${formId}-phone-err`} className="mt-1 text-xs font-medium text-red-600" role="alert">
                      {errors.country_code || errors.phone}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`${formId}-subject`} className="text-sm font-bold text-[#0E1830] dark:text-white">
                    {t("contact.subject")}
                    <RequiredMark />
                  </label>
                  <div className="relative mt-1.5">
                    <MessageSquare size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1A2B4A] dark:text-[#C9D2DE]" />
                    <select
                      id={`${formId}-subject`}
                      name="subject"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      aria-invalid={!!errors.subject}
                      aria-describedby={errors.subject ? `${formId}-subject-err` : undefined}
                      className={`${fieldClass} appearance-none pl-10 pr-9`}
                    >
                      <option value="">{t("contact.subjectPh")}</option>
                      {CUSTOMER_SUPPORT_CATS.map((id) => (
                        <option key={id} value={id}>
                          {t(`web.support.category.${id}`)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#1A2B4A] dark:text-[#C9D2DE]" />
                  </div>
                  {errors.subject ? (
                    <p id={`${formId}-subject-err`} className="mt-1 text-xs font-medium text-red-600" role="alert">
                      {errors.subject}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`${formId}-message`} className="text-sm font-bold text-[#0E1830] dark:text-white">
                    {t("contact.message")}
                    <RequiredMark />
                  </label>
                  <div className="relative mt-1.5">
                    <MessageCircle size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-[#1A2B4A] dark:text-[#C9D2DE]" />
                    <textarea
                      id={`${formId}-message`}
                      name="message"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={t("contact.messagePh")}
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? `${formId}-message-err` : undefined}
                      className="min-h-[7.5rem] w-full resize-y rounded-lg border border-[#F0D2B4] bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-[#0E1830] placeholder:text-[#7C8798] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]/45 dark:border-white/15 dark:bg-[#0F1A2E] dark:text-white"
                    />
                  </div>
                  {errors.message ? (
                    <p id={`${formId}-message-err`} className="mt-1 text-xs font-medium text-red-600" role="alert">
                      {errors.message}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FF7A00] text-[15px] font-bold text-white hover:bg-[#F07400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] focus-visible:ring-offset-2 disabled:opacity-70"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
                  {submitting ? t("contact.sending") : t("contact.send")}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[#1A2B4A] dark:text-[#C9D2DE]">
                  <Lock size={13} aria-hidden className="shrink-0 text-[#1A2B4A] dark:text-[#C9D2DE]" />
                  {t("ct.privacy")}
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="container relative pb-12 md:pb-14">
          <article className="rounded-2xl border border-[#F0E2D2] bg-white p-5 shadow-[0_10px_24px_-18px_rgba(120,70,20,0.45)] sm:p-6 dark:border-white/10 dark:bg-[#152238]">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00] dark:bg-[#FF7A00]/15">
                <CircleHelp size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#0E1830] dark:text-white">{t("ct.faqTitle")}</h2>
                <p className="text-sm font-medium leading-relaxed text-[#1A2B4A] dark:text-[#C9D2DE]">{t("ct.faqDesc")}</p>
              </div>
            </div>
            <Accordion type="single" collapsible className="mt-4 space-y-2.5">
              {FAQ.map(({ q, a }) => (
                <AccordionItem key={q} value={q} className="rounded-lg border border-[#F0E2D2] px-3 dark:border-white/10">
                  <AccordionTrigger className="py-3 text-left text-sm font-bold text-[#0E1830] hover:no-underline dark:text-white [&_svg]:text-[#FF7A00]">
                    {t(q)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm font-medium leading-relaxed text-[#1A2B4A] dark:text-[#E8ECF0]">
                    {t(a)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </article>
        </div>
      </section>

      <PublishedStatsStrip />
    </Layout>
  );
}
