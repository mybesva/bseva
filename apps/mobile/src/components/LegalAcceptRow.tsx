import { Switch, View } from "react-native";
import { InlineLink } from "@/components/InlineLink";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

type LegalAcceptRowProps = {
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
  termsSlug?: string;
  cancellationSlug?: string;
  accessibilityLabel?: string;
};

export function LegalAcceptRow({
  accepted,
  onAcceptedChange,
  termsSlug = "pujari_booking_terms",
  cancellationSlug = "cancellation_policy",
  accessibilityLabel,
}: LegalAcceptRowProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Switch
        value={accepted}
        onValueChange={onAcceptedChange}
        trackColor={{ true: colors.primary }}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel || t("mobile.acceptTerms")}
        accessibilityState={{ checked: accepted }}
      />
      <AppText variant="small" style={{ flex: 1, paddingTop: 2 }}>
        {t("mobile.acceptTermsPrefix")}{" "}
        <InlineLink label={t("mobile.terms")} href={`/legal/${termsSlug}`} />
        {" "}
        {t("mobile.acceptTermsAnd")}{" "}
        <InlineLink label={t("booking.cancellationPolicy")} href={`/legal/${cancellationSlug}`} />
        .
      </AppText>
    </View>
  );
}
