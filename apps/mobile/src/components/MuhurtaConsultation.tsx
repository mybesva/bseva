import { MUHURTA_TIME_SLOTS, rupees } from "@bseva/config";
import { useState } from "react";
import { View } from "react-native";
import { formatPujaTitleText } from "@bseva/locales";
import { DateCalendar } from "@/components/DateCalendar";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, PrimaryButton } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { formatDisplayDate } from "@/utils/formatDate";

export type MuhurtaReceipt = {
  id: string;
  consultation_number?: string;
  fee_paise: number;
  payment_status: string;
  appointment_date: string;
  appointment_time: string;
};

export function MuhurtaConsultation({
  serviceId,
  serviceName,
  requiresMuhurtham,
  feePaise,
  defaultDate,
  defaultTime,
  receipt,
  onBooked,
}: {
  serviceId: string;
  serviceName: string;
  requiresMuhurtham?: boolean;
  feePaise: number;
  defaultDate: string;
  defaultTime: string;
  receipt: MuhurtaReceipt | null;
  onBooked: (row: MuhurtaReceipt) => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime.slice(0, 5) || "10:00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!date) {
      setError(t("web.muhurta.needDate"));
      return;
    }
    if (!time) {
      setError(t("web.muhurta.needTime"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await apiClient.createMuhurta({
        service_id: serviceId,
        appointment_date: date,
        appointment_time: time,
        preferred_dates: [date],
        notes: notes.trim() || undefined,
      }) as MuhurtaReceipt;
      onBooked(out);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("web.muhurta.bookFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 10, borderColor: colors.primary }}>
      <AppText variant="h3">
        {requiresMuhurtham ? t("web.muhurta.requiredTitle") : t("web.muhurta.title")}
      </AppText>
      <AppText variant="small" color={colors.mutedForeground}>
        {receipt
          ? t("web.muhurta.confirmedDescription")
          : feePaise > 0
            ? t("web.muhurta.paidDescription", { amount: rupees(feePaise) })
            : t("web.muhurta.freeDescription")}
      </AppText>
      <AppText variant="small">{t("web.muhurta.benefitDescription")}</AppText>
      {receipt ? (
        <>
          <AppText>{t("web.muhurta.reference")}: {receipt.consultation_number || receipt.id.slice(0, 8)}</AppText>
          <AppText>
            {formatDisplayDate(receipt.appointment_date)} · {(receipt.appointment_time || "").slice(0, 5)}
          </AppText>
          <AppText variant="small">{t("web.muhurta.awaitingPujari")}</AppText>
        </>
      ) : !open ? (
        <PrimaryButton title={t("web.muhurta.bookAction")} variant="outline" onPress={() => setOpen(true)} />
      ) : (
        <>
          <ErrorBanner message={error} />
          <AppText variant="small">{t("web.muhurta.servicePrompt", { service: formatPujaTitleText(serviceName) })}</AppText>
          <DateCalendar value={date} onChange={setDate} leadHours={1} />
          <ChoiceChips
            options={MUHURTA_TIME_SLOTS.map((id) => ({ id, label: id }))}
            value={time}
            onChange={(v) => setTime(String(v))}
          />
          <Field label={t("web.muhurta.notes")} value={notes} onChangeText={setNotes} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText>{t("common.total")}</AppText>
            <AppText color={colors.primary}>{feePaise > 0 ? rupees(feePaise) : t("web.muhurta.free")}</AppText>
          </View>
          <PrimaryButton
            title={busy ? t("web.muhurta.confirming") : feePaise > 0 ? t("web.muhurta.confirmPay", { amount: rupees(feePaise) }) : t("web.muhurta.confirmAppointment")}
            loading={busy}
            onPress={() => void confirm()}
          />
          <PrimaryButton title={t("common.cancel")} variant="ghost" onPress={() => setOpen(false)} />
        </>
      )}
    </Card>
  );
}
