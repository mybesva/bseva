import { spacing } from "@bseva/tokens";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { MoreMenuRow } from "@/components/MoreMenuRow";
import { AppText } from "@/components/ui";
import { text } from "@/content/compliance";
import { useAppTheme } from "@/theme/ThemeContext";
import { openLegal } from "@/utils/webLinks";

function SectionLabel({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <AppText
      variant="small"
      color={colors.mutedForeground}
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xs,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {label}
    </AppText>
  );
}

/** More → Account (password, reports, delete) and More → Legal (opens the website pages). */
export function MoreAccountLegal({ role }: { role: "customer" | "pujari" }) {
  const router = useRouter();
  const profileBase = role === "pujari" ? "/pujari/profile" : "/customer/profile";
  return (
    <>
      <SectionLabel label={text.accountSection} />
      <MoreMenuRow
        icon="key-outline"
        label={text.changePassword}
        onPress={() => router.push(`${profileBase}?tab=password` as never)}
      />
      <MoreMenuRow icon="flag-outline" label={text.myReports} onPress={() => router.push("/account/reports" as never)} />
      <MoreMenuRow
        icon="trash-outline"
        label={text.deleteAccount}
        destructive
        chevron
        onPress={() => router.push("/account/delete" as never)}
      />

      <SectionLabel label={text.legalSection} />
      <MoreMenuRow icon="shield-checkmark-outline" label={text.privacyPolicy} onPress={() => void openLegal("privacy")} />
      {role === "pujari" ? (
        <MoreMenuRow icon="document-text-outline" label={text.pujariTerms} onPress={() => void openLegal("pujariTerms")} />
      ) : (
        <MoreMenuRow icon="document-text-outline" label={text.customerTerms} onPress={() => void openLegal("customerTerms")} />
      )}
      <MoreMenuRow icon="phone-portrait-outline" label={text.appTerms} onPress={() => void openLegal("appTerms")} />
      <MoreMenuRow icon="receipt-outline" label={text.refundPolicy} onPress={() => void openLegal("refundPolicy")} />
      <MoreMenuRow icon="open-outline" label={text.deleteAccountWeb} onPress={() => void openLegal("deleteAccount")} />
      <View style={{ height: spacing.lg }} />
    </>
  );
}
