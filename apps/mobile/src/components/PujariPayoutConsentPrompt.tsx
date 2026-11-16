import { useState } from "react";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { showSuccessAlert } from "@/utils/actionFeedback";

/**
 * One tap: a pujari paid by UPI agrees that B-Seva may verify the UPI ID with a ₹1 check before payouts
 * (backend app.payouts.verification). Shown only while the server says consent is needed.
 */
export function PujariPayoutConsentPrompt({
  profile,
  onDone,
}: {
  profile: Record<string, unknown> | undefined;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  if (!profile?.payout_consent_needed) return null;

  async function allow() {
    setBusy(true);
    try {
      await apiClient.givePayoutVerificationConsent();
      showSuccessAlert(t("payout.consent.done"));
      onDone();
    } catch {
      // Left visible so the pujari can try again.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 8, borderColor: "#F59E0B", backgroundColor: "#F59E0B14" }}>
      <AppText style={{ fontWeight: "700" }}>{t("payout.consent.title")}</AppText>
      <AppText variant="small" color={colors.mutedForeground}>
        {t("payout.consent.body")}
      </AppText>
      <PrimaryButton title={t("payout.consent.allow")} loading={busy} disabled={busy} onPress={() => void allow()} />
    </Card>
  );
}
