import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { usePublicConfig, whatsappDisplay, whatsappHref, telHref } from "@/hooks/usePublicConfig";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$/;

type FormState = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

function RequiredMark() {
  return <span className="text-destructive ml-0.5" aria-hidden>*</span>;
}

export default function Contact() {
  const { t } = useI18n();
  const { config } = usePublicConfig();
  const phoneDisplay = whatsappDisplay(config.bseva_whatsapp_number);
  const supportEmail = config.email_from_support || "support@b-seva.com";
  const contactEmail = config.email_from_contact || supportEmail;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  function validate(values: FormState): FormErrors {
    const next: FormErrors = {};
    if (!values.name.trim() || values.name.trim().length < 2) {
      next.name = t("contact.errName");
    }
    if (!values.email.trim() || !EMAIL_RE.test(values.email.trim())) {
      next.email = t("contact.errEmail");
    }
    const phoneDigits = values.phone.replace(/\s/g, "");
    if (!phoneDigits || !MOBILE_RE.test(phoneDigits)) {
      next.phone = t("contact.errPhone");
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
    <Layout>
      <section className="relative py-10 md:py-12 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center">
          <h1 className="text-h1 md:text-display text-primary mb-3">{t("contact.title")}</h1>
          <p className="text-base text-white/80 max-w-2xl mx-auto">{t("contact.subtitle")}</p>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1 space-y-8">
              <div>
                <h3 className="font-bold text-2xl text-foreground mb-6">{t("contact.info")}</h3>
                <p className="text-muted-foreground mb-8">{t("contact.infoDesc")}</p>
              </div>

              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground mb-1">{t("contact.office")}</h4>
                      <p className="text-sm text-muted-foreground">
                        123 Spiritual Avenue, Temple Road,<br />
                        Bangalore, Karnataka 560001
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Phone size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground mb-1">{t("contact.phone")}</h4>
                      <p className="text-sm text-muted-foreground">
                        <a href={telHref(config.bseva_whatsapp_number)} className="hover:text-primary">{phoneDisplay}</a>
                        <br />
                        <a href={whatsappHref(config.bseva_whatsapp_number)} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                          WhatsApp
                        </a>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground mb-1">{t("contact.email")}</h4>
                      <p className="text-sm text-muted-foreground">
                        <a href={`mailto:${supportEmail}`} className="hover:text-primary">{supportEmail}</a>
                        <br />
                        <a href={`mailto:${contactEmail}`} className="hover:text-primary">{contactEmail}</a>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
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
              <Card className="border-none shadow-lg h-full">
                <CardContent className="p-8 md:p-12">
                  <h3 className="font-bold text-2xl text-foreground mb-2">{t("contact.sendMessage")}</h3>
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSubmitted(false)}
                        className="font-semibold"
                      >
                        {t("contact.sendAnother")}
                      </Button>
                    </div>
                  ) : (
                    <form className="space-y-6" onSubmit={onSubmit} noValidate>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name">
                            {t("auth.name")}
                            <RequiredMark />
                          </Label>
                          <Input
                            id="name"
                            name="name"
                            autoComplete="name"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder={t("contact.namePh")}
                            className="h-12"
                            aria-invalid={!!errors.name}
                          />
                          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">
                            {t("auth.email")}
                            <RequiredMark />
                          </Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder={t("contact.emailPh")}
                            className="h-12"
                            aria-invalid={!!errors.email}
                          />
                          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="phone">
                            {t("auth.phone")}
                            <RequiredMark />
                          </Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            required
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder={t("contact.phonePh")}
                            className="h-12"
                            aria-invalid={!!errors.phone}
                          />
                          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">
                            {t("contact.subject")}
                            <RequiredMark />
                          </Label>
                          <Input
                            id="subject"
                            name="subject"
                            required
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            placeholder={t("contact.subjectPh")}
                            className="h-12"
                            aria-invalid={!!errors.subject}
                          />
                          {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">
                          {t("contact.message")}
                          <RequiredMark />
                        </Label>
                        <Textarea
                          id="message"
                          name="message"
                          required
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          placeholder={t("contact.messagePh")}
                          className="min-h-[150px]"
                          aria-invalid={!!errors.message}
                        />
                        {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full md:w-auto bg-primary text-white hover:bg-primary/90 h-12 px-8 font-bold text-lg"
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
      </section>

      <section className="h-[400px] bg-secondary/10 relative overflow-hidden">
        {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
          <iframe
            title="BSeva office location"
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent("123 Spiritual Avenue, Temple Road, Bangalore, Karnataka 560001")}&zoom=14`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center p-6">
            <div>
              <MapPin size={48} className="text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">{t("contact.mapPlaceholder")}</p>
              <p className="text-sm text-muted-foreground/70">123 Spiritual Avenue, Bangalore</p>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
