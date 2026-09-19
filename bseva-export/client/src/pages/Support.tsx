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
import { api, apiBookings, type AuthUser } from "@/lib/api";
import { validateSupport } from "@/lib/fieldValidation";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDisplayDateTime } from "@/lib/formatDate";
import {
  CATEGORY_LABELS,
  EVENT_LABELS,
  STATUS_LABELS,
  asTicketList,
  priorityClass,
  statusClass,
  type SupportTicket,
} from "@/lib/supportTickets";
import { CUSTOMER_SUPPORT_CATS, PUJARI_SUPPORT_CATS } from "@bseva/config";

function categoryLabel(t: (k: string) => string, id: string) {
  const key = `web.support.category.${id}`;
  const translated = t(key);
  return translated === key ? CATEGORY_LABELS[id] || id : translated;
}

function SupportForm({ categories }: { categories: readonly string[] }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookingId, setBookingId] = useState("none");
  const [bookings, setBookings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");

  async function load() {
    try {
      const data = asTicketList(await api("/support/tickets"));
      setTickets(data.items);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    void load();
    void apiBookings(1, 50)
      .then((res) => setBookings(res.items || []))
      .catch(() => setBookings([]));
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
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          related_booking_id: bookingId !== "none" ? bookingId : undefined,
        }),
      });
      toast.success(t("support.submitted"));
      setSubject("");
      setDescription("");
      setBookingId("none");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openTicket(id: string) {
    try {
      setActive(await api<SupportTicket>(`/support/tickets/${id}`));
      setReply("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    try {
      await api(`/support/tickets/${active.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim(), kind: "user" }),
      });
      setReply("");
      await openTicket(active.id);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function reopen() {
    if (!active) return;
    try {
      await api(`/support/tickets/${active.id}/reopen`, { method: "POST", body: JSON.stringify({}) });
      await openTicket(active.id);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const profile = (user || {}) as AuthUser;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("web.support.raiseTicket")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="rounded-md border bg-muted/40 p-3 text-sm grid sm:grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground">{t("web.support.yourId")}</div>
                <div className="font-medium">{profile.public_id || profile.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("auth.name")}</div>
                <div className="font-medium">{profile.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("auth.phone")}</div>
                <div>{profile.phone || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("auth.email")}</div>
                <div>{profile.email || "—"}</div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("support.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(t, c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bookings.length > 0 && (
              <div className="space-y-1">
                <Label>{t("web.support.relatedBooking")}</Label>
                <Select value={bookingId} onValueChange={setBookingId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("web.support.noBooking")}</SelectItem>
                    {bookings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.booking_number} · {b.service_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>{t("support.subject")} *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={5} />
            </div>
            <div className="space-y-1">
              <Label>{t("support.message")} *</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} rows={4} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("web.support.sending") : t("support.submit")}
            </Button>
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
              <button
                key={ticket.id}
                type="button"
                className="w-full text-left rounded-md border p-3 text-sm hover:border-primary"
                onClick={() => void openTicket(ticket.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{ticket.subject}</span>
                  <Badge className={statusClass(ticket.status)}>{ticket.status_label || STATUS_LABELS[ticket.status] || t(`status.${ticket.status}`)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {ticket.ticket_number} · {ticket.category_label || categoryLabel(t, ticket.category)}
                </p>
              </button>
            ))
          )}

          {active && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{active.ticket_number}</div>
                  <div className="text-sm">{active.subject}</div>
                </div>
                <div className="flex gap-1">
                  <Badge className={statusClass(active.status)}>{active.status_label || STATUS_LABELS[active.status]}</Badge>
                  {active.priority ? <Badge className={priorityClass(active.priority)}>{String(active.priority_label || active.priority)}</Badge> : null}
                </div>
              </div>
              {active.booking?.booking_number && (
                <p className="text-xs text-muted-foreground">
                  {active.booking.booking_number} · {active.booking.service_name}
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap">{active.description}</p>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {(active.events || []).map((ev: any) => (
                  <div key={ev.id} className="text-sm rounded-md bg-muted/50 p-2">
                    <div className="text-xs text-muted-foreground">
                      {EVENT_LABELS[ev.event_type] || ev.event_type} · {formatDisplayDateTime(ev.created_at)}
                    </div>
                    {ev.body ? <p className="mt-1 whitespace-pre-wrap">{ev.body}</p> : null}
                  </div>
                ))}
              </div>
              {active.resolution ? (
                <div className="text-sm rounded-md border p-2">
                  <div className="font-medium">{t("web.support.resolution")}</div>
                  <p>{active.resolution}</p>
                </div>
              ) : null}
              {active.status === "closed" || active.status === "resolved" ? (
                <Button size="sm" variant="outline" onClick={() => void reopen()}>
                  {t("web.support.reopen")}
                </Button>
              ) : (
                <>
                  <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("web.support.replyPlaceholder")} />
                  <Button size="sm" disabled={!reply.trim()} onClick={() => void sendReply()}>
                    {t("web.support.reply")}
                  </Button>
                </>
              )}
            </div>
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
      <SupportForm categories={CUSTOMER_SUPPORT_CATS} />
    </CustomerPortal>
  );
}

export function PujariSupportPage() {
  const { t } = useI18n();
  return (
    <PujariPortal>
      <h1 className="text-h1 mb-6">{t("support.title")}</h1>
      <SupportForm categories={PUJARI_SUPPORT_CATS} />
    </PujariPortal>
  );
}

function isPujariRole(role?: string | null) {
  return role === "pujari" || role === "head_pujari";
}

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
