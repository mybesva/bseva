import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, Clock, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { usePublicConfig, whatsappDisplay, whatsappHref, telHref } from "@/hooks/usePublicConfig";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
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

function RequiredMark() {
  return <span className="text-destructive ml-0.5" aria-hidden>*</span>;
}

/** Contact form + info for customer/pujari portal (no marketing hero). */
export function ContactPortalContent() {
  const { t } = useI18n();
  const { config } = usePublicConfig();
  const phoneDisplay = whatsappDisplay(config.bseva_whatsapp_number);
  const supportEmail = config.email_from_support || "support@b-seva.com";
  const contactEmail = config.email_from_contact || supportEmail;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate(values: FormState): FormErrors {
    const next: FormErrors = {};
    if (!values.name.trim() || values.name.trim().length < 2) {
      next.name = t("contact.errName");
    }
    if (!values.email.trim() || !EMAIL_RE.test(values.email.trim())) {
      next.email = t("contact.errEmail");
    }
    const code = (values.country_code || "+91").trim() || "+91";
    const phone = values.phone.trim();
    if (code === "+91") {
      if (!TEN_DIGIT_RE.test(phone)) next.phone = t("contact.errPhoneIndia");
    } else if (phone.length < 8 || phone.length > 12) {
      next.phone = t("contact.errPhoneIntl");
    }
    if (!values.subject.trim() || values.subject.trim().length < 3) {
      next.subject = t("contact.errSubject");
    }
    if (!values.message.trim() || values.message.trim().length < 10) {
      next.message = t("contact.errMessage");
    }
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(t("contact.errRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ ok: boolean; message?: string }>("/support/contact", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          country_code: form.country_code.trim() || "+91",
          phone: form.phone.trim(),
          subject: form.subject.trim(),
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
    <div className="max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="lg:col-span-1 space-y-6">
          <div>
            <h2 className="font-bold text-xl text-foreground mb-2">{t("contact.info")}</h2>
            <p className="text-sm text-muted-foreground">{t("contact.infoDesc")}</p>
          </div>
          <div className="space-y-4">
            <Card className="border-none shadow-sm bg-secondary/20">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Phone size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">{t("contact.phone")}</h4>
                  <p className="text-sm text-muted-foreground">
                    <a href={telHref(config.bseva_whatsapp_number)} className="hover:text-primary">
                      {phoneDisplay}
                    </a>
                    <br />
                    <a
                      href={whatsappHref(config.bseva_whatsapp_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary"
                    >
                      WhatsApp
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-secondary/20">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">{t("contact.email")}</h4>
                  <p className="text-sm text-muted-foreground">
                    <a href={`mailto:${supportEmail}`} className="hover:text-primary">
                      {supportEmail}
                    </a>
                    <br />
                    <a href={`mailto:${contactEmail}`} className="hover:text-primary">
                      {contactEmail}
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-secondary/20">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">{t("contact.hours")}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{t("contact.hoursValue")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-none shadow-md h-full">
            <CardContent className="p-6 md:p-8">
              <h3 className="font-bold text-xl text-foreground mb-1">{t("contact.sendMessage")}</h3>
              <p className="text-sm text-muted-foreground mb-6">{t("contact.requiredNote")}</p>

              {submitted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={28} />
                    <div>
                      <h4 className="font-bold text-lg text-foreground">{t("contact.successTitle")}</h4>
                      <p className="text-muted-foreground mt-1">{t("contact.success")}</p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setSubmitted(false)} className="font-semibold">
                    {t("contact.sendAnother")}
                  </Button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={onSubmit} noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="portal-contact-name">
                        {t("auth.name")}
                        <RequiredMark />
                      </Label>
                      <Input
                        id="portal-contact-name"
                        autoComplete="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={t("contact.namePh")}
                        aria-invalid={!!errors.name}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="portal-contact-email">
                        {t("auth.email")}
                        <RequiredMark />
                      </Label>
                      <Input
                        id="portal-contact-email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder={t("contact.emailPh")}
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>
                        {t("auth.phone")}
                        <RequiredMark />
                      </Label>
                      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 w-full">
                        <select
                          aria-label={t("contact.countryCode")}
                          value={form.country_code}
                          onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                          className="h-10 w-full max-w-[4.75rem] rounded-md border border-input bg-background px-1.5 text-sm font-bold text-center"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder={
                            form.country_code === "+91" ? t("contact.phonePhIndia") : t("contact.phonePh")
                          }
                          aria-invalid={!!errors.phone}
                        />
                      </div>
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="portal-contact-subject">
                        {t("contact.subject")}
                        <RequiredMark />
                      </Label>
                      <Input
                        id="portal-contact-subject"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        placeholder={t("contact.subjectPh")}
                        aria-invalid={!!errors.subject}
                      />
                      {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portal-contact-message">
                      {t("contact.message")}
                      <RequiredMark />
                    </Label>
                    <Textarea
                      id="portal-contact-message"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={t("contact.messagePh")}
                      className="min-h-[140px]"
                      aria-invalid={!!errors.message}
                    />
                    {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-primary text-white hover:bg-primary/90 h-11 px-6 font-bold"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("contact.sending")}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" /> {t("contact.send")}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
