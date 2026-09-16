import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { CustomerPortal, PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { validateSupport } from "@/lib/fieldValidation";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";

const CUSTOMER_CATS = ["Payments", "Wallet", "Bookings", "Others"];
const PUJARI_CATS = ["Settlement", "Route Map / Location", "Bookings", "Others"];

function SupportForm({ categories }: { categories: string[] }) {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<any[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setTickets(await api<any[]>("/support/tickets"));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSupport(subject, description);
    if (Object.keys(errs).length) {
      toast.error(errs.subject ? t("web.support.subjectValidation") : t("web.support.descriptionValidation"));
      return;
    }
    setSaving(true);
    try {
      await api("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ category, subject: subject.trim(), description: description.trim() }),
      });
      toast.success(t("support.submitted"));
      setSubject("");
      setDescription("");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("web.support.raiseTicket")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label>{t("support.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`web.support.category.${c.toLowerCase().replace(/[^a-z]+/g, "_")}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("support.subject")} *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={5} />
            </div>
            <div className="space-y-1">
              <Label>{t("support.message")} *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                rows={4}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? t("web.support.sending") : t("support.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("web.support.yourTickets")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("support.empty")}</p>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{ticket.subject}</span>
                  <Badge variant="secondary">{t(`status.${ticket.status}`)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {ticket.ticket_number} · {ticket.category}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerSupportPage() {
  const { t } = useI18n();
  return (
    <CustomerPortal>
      <h1 className="text-h1 mb-6">{t("support.title")}</h1>
      <SupportForm categories={CUSTOMER_CATS} />
    </CustomerPortal>
  );
}

export function PujariSupportPage() {
  const { t } = useI18n();
  return (
    <PujariPortal>
      <h1 className="text-h1 mb-6">{t("support.title")}</h1>
      <SupportForm categories={PUJARI_CATS} />
    </PujariPortal>
  );
}

function isPujariRole(role?: string | null) {
  return role === "pujari" || role === "head_pujari";
}

/** Public contact-adjacent page for logged-out users (uses Layout). */
export default function SupportPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Layout>
        <div className="container py-10">{t("common.loading")}</div>
      </Layout>
    );
  }
  if (user?.role === "customer") return <CustomerSupportPage />;
  if (isPujariRole(user?.role)) return <PujariSupportPage />;
  return (
    <Layout>
      <div className="container py-10 max-w-lg">
        <h1 className="text-h1 mb-2">{t("support.title")}</h1>
        <p className="text-muted-foreground mb-4">{t("web.support.signInPrompt")}</p>
        <Link href={getLoginUrl({ role: "pujari", returnPath: "/pujari/support" })}>
          <Button>{t("nav.login")}</Button>
        </Link>
      </div>
    </Layout>
  );
}
