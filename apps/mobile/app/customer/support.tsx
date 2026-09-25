import { CUSTOMER_SUPPORT_CATS, PUJARI_SUPPORT_CATS, isPujariRole } from "@bseva/config";
import { supportSchema } from "@bseva/validation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

function TicketCard({
  ticket,
  onError,
  onChanged,
}: {
  ticket: { id: string; subject?: string; ticket_number?: string; category?: string; status?: string };
  onError: (message: string) => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const detail = useQuery({
    queryKey: ["ticket", ticket.id],
    queryFn: () => apiClient.getSupportTicket(ticket.id),
    enabled: open,
  });
  const detailId = detail.data?.id ? String(detail.data.id) : "";
  const showDetail = open && detail.data && (!detailId || detailId === String(ticket.id));
  return (
    <Card>
      <AppText variant="h3">{ticket.subject}</AppText>
      <AppText variant="small">{String(ticket.ticket_number || ticket.category || "")}</AppText>
      {ticket.status ? <StatusBadge status={String(ticket.status)} /> : null}
      <PrimaryButton
        title={open ? t("common.back") : t("common.viewAll")}
        variant="outline"
        onPress={() => {
          setReply("");
          setOpen((current) => !current);
        }}
      />
      {showDetail ? (
        <>
          {(detail.data?.events as { id?: string; body?: string; event_type?: string }[] | undefined)?.map((ev, index) => (
            <AppText key={ev.id || `${ticket.id}-${index}`} variant="small">
              {ev.event_type}: {ev.body}
            </AppText>
          ))}
          {String(detail.data?.status) === "closed" || String(detail.data?.status) === "resolved" ? (
            <PrimaryButton
              title={t("web.support.reopen")}
              variant="outline"
              onPress={async () => {
                try {
                  await apiClient.reopenSupportTicket(ticket.id);
                  await detail.refetch();
                  await onChanged();
                } catch (e: unknown) {
                  onError(e instanceof Error ? e.message : t("mobile.failed"));
                }
              }}
            />
          ) : (
            <>
              <Field label={t("web.support.reply")} value={reply} onChangeText={setReply} multiline />
              <PrimaryButton
                title={t("web.support.reply")}
                onPress={async () => {
                  if (!reply.trim()) return;
                  try {
                    await apiClient.replySupportTicket(ticket.id, reply.trim());
                    setReply("");
                    await detail.refetch();
                  } catch (e: unknown) {
                    onError(e instanceof Error ? e.message : t("mobile.failed"));
                  }
                }}
              />
            </>
          )}
        </>
      ) : null}
    </Card>
  );
}

export default function SupportScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const cats = isPujariRole(user?.role) ? [...PUJARI_SUPPORT_CATS] : [...CUSTOMER_SUPPORT_CATS];
  const q = useQuery({ queryKey: ["tickets"], queryFn: () => apiClient.listSupportTickets() });
  const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(cats[0]);
  const [bookingId, setBookingId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bookings = bookingsQ.data || [];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.support")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText variant="small">{user?.name} · {user?.phone || user?.email}</AppText>
        <AppText variant="small">{t("mobile.category")}</AppText>
        <ChoiceChips
          options={cats.map((c) => ({ id: c, label: t(`web.support.category.${c}`) === `web.support.category.${c}` ? c : t(`web.support.category.${c}`) }))}
          value={category}
          onChange={(v) => setCategory(String(v))}
        />
        {bookings.length > 0 ? (
          <>
            <AppText variant="small">{t("web.support.relatedBooking")}</AppText>
            <ChoiceChips
              options={[
                { id: "", label: t("web.support.noBooking") },
                ...bookings.slice(0, 8).map((b) => ({
                  id: String(b.id),
                  label: String(b.booking_number || b.service_name || b.id),
                })),
              ]}
              value={bookingId}
              onChange={(v) => setBookingId(String(v))}
            />
          </>
        ) : null}
        <Field label={t("mobile.subject")} value={subject} onChangeText={setSubject} />
        <Field label={t("mobile.description")} value={body} onChangeText={setBody} multiline />
        <PrimaryButton
          title={busy ? t("mobile.submitting") : t("mobile.submitTicket")}
          loading={busy}
          onPress={async () => {
            const parsed = supportSchema.safeParse({ subject, body });
            if (!parsed.success) {
              const field = String(parsed.error.issues[0]?.path?.[0] || "");
              setError(field === "subject" ? t("validation.subject") : t("validation.issue"));
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await apiClient.createSupportTicket({
                category,
                subject,
                description: body,
                body,
                related_booking_id: bookingId || undefined,
              });
              setSubject("");
              setBody("");
              setBookingId("");
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            } finally {
              setBusy(false);
            }
          }}
        />
        {!q.isLoading && (q.data || []).length === 0 ? <EmptyState title={t("mobile.noTickets")} /> : null}
        {(q.data || []).map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onError={setError}
            onChanged={async () => {
              await q.refetch();
            }}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}
