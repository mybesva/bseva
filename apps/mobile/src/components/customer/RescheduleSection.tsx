import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePicker } from "@/components/TimePicker";
import { AppText, Card, ErrorBanner, PrimaryButton } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { showSuccessAlert } from "@/utils/actionFeedback";
import { formatDisplaySlot } from "@/utils/formatDate";

type Summary = {
  eligible: boolean;
  blocked_code?: string | null;
  blocked_message?: string | null;
  deadline: string;
  next_fee_paise: number;
  lead_hours: number;
  reschedule_count: number;
  pujari_performance?: {
    name: string;
    completed_pujas: number;
    rating: { average: number | null; count: number };
  } | null;
  history: {
    sequence: number;
    old_date: string;
    old_start_time: string;
    new_date: string;
    new_start_time: string;
    fee_paise: number;
    initiated_by_name: string;
    previous_pujari_name?: string | null;
    previous_pujari_rating?: number | null;
    created_at: string;
  }[];
};

const slot = (date: string, time: string) => formatDisplaySlot(date, time.slice(0, 5));
const stamp = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const feeText = (paise: number) => (paise ? `Fee ${rupees(paise)}` : "Free");

export function RescheduleSection({ bookingId, onChanged }: { bookingId: string; onChanged: () => void }) {
  const { colors } = useAppTheme();
  const q = useQuery({
    queryKey: ["reschedule", bookingId],
    queryFn: () => apiClient.rescheduleSummary(bookingId) as Promise<Summary>,
  });
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = q.data;
  if (!info || (info.blocked_code === "RESCHEDULE_NOT_ALLOWED" && !info.reschedule_count)) return null;
  const performance = info.pujari_performance;

  async function save() {
    if (!date) {
      setError("Choose a new date");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.rescheduleBooking(bookingId, date, time);
      setOpen(false);
      setDate("");
      await q.refetch();
      onChanged();
      showSuccessAlert("Puja rescheduled. We are finding a pujari for the new time.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reschedule");
      await q.refetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <View style={{ gap: 10 }}>
        <AppText variant="h3">Reschedule</AppText>
        <AppText>
          Rescheduled {info.reschedule_count} time{info.reschedule_count === 1 ? "" : "s"}
        </AppText>
        <AppText color={colors.mutedForeground}>
          {info.eligible
            ? `Available until ${stamp(info.deadline)}. ${feeText(info.next_fee_paise)}.`
            : info.blocked_message}
        </AppText>
        <ErrorBanner message={error} />
        {performance ? (
          <AppText color={colors.mutedForeground}>
            {performance.name}: {(performance.rating.average ?? 0).toFixed(1)}/5 ({performance.rating.count}) ·{" "}
            {performance.completed_pujas} pujas completed
          </AppText>
        ) : null}
        {info.eligible && !open ? <PrimaryButton title="Reschedule Puja" variant="outline" onPress={() => setOpen(true)} /> : null}
        {open ? (
          <>
            <AppText color={colors.mutedForeground}>
              Your booking and payment stay the same. The current pujari is released and the puja goes out to available
              pujaris for the new time.
            </AppText>
            <DatePickerField value={date} onChange={setDate} leadHours={info.lead_hours} label="New date" />
            <TimePicker value={time} onChange={setTime} />
            <PrimaryButton title="Confirm new time" loading={saving} onPress={() => void save()} />
            <PrimaryButton title="Cancel" variant="outline" disabled={saving} onPress={() => setOpen(false)} />
          </>
        ) : null}
        {info.history.map((row) => (
          <View key={row.sequence} style={{ gap: 2 }}>
            <AppText>
              #{row.sequence}: {slot(row.old_date, row.old_start_time)} → {slot(row.new_date, row.new_start_time)}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {stamp(row.created_at)} · by {row.initiated_by_name} · {feeText(row.fee_paise)}
            </AppText>
            {row.previous_pujari_name ? (
              <AppText variant="small" color={colors.mutedForeground}>
                Pujari at that time: {row.previous_pujari_name}
                {row.previous_pujari_rating != null ? ` (${row.previous_pujari_rating.toFixed(1)}/5)` : ""}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}
