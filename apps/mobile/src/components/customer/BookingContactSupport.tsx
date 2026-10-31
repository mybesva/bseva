import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { AppText, Card } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

/** Digits with country code. A 10-digit number is treated as Indian. */
function dialDigits(raw: unknown): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

async function open(url: string, label: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`${label} is not available on this device`);
  }
}

export function BookingContactSupport({ bookingNumber }: { bookingNumber: string }) {
  const { colors } = useAppTheme();
  const config = useQuery({ queryKey: ["public-config"], queryFn: () => apiClient.publicConfig() });
  const data = config.data || {};
  const whatsapp = dialDigits(data.bseva_whatsapp_number);
  const phone = dialDigits(data.support_phone || data.bseva_whatsapp_number);
  const email = String(data.support_email || data.email_from_support || "");
  const message = `Hi B-Seva, I need help with my booking ${bookingNumber}.`;
  const subject = `Support for booking ${bookingNumber}`;
  const actions: { label: string; icon: ComponentProps<typeof Ionicons>["name"]; color: string; url: string }[] = [
    ...(whatsapp
      ? [{ label: "WhatsApp", icon: "logo-whatsapp" as const, color: "#25D366", url: `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}` }]
      : []),
    ...(phone ? [{ label: "Call", icon: "call" as const, color: colors.primary, url: `tel:+${phone}` }] : []),
    ...(email
      ? [
          {
            label: "Email",
            icon: "mail" as const,
            color: colors.primary,
            url: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Booking ID: ${bookingNumber}\n\n`)}`,
          },
        ]
      : []),
  ];
  if (!actions.length) return null;
  return (
    <Card>
      <View style={{ gap: 10 }}>
        <AppText variant="h3">Need help with this booking?</AppText>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => void open(action.url, action.label)}
              style={{
                flex: 1,
                minHeight: 64,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
              }}
            >
              <Ionicons name={action.icon} size={22} color={action.color} />
              <AppText variant="small">{action.label}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
  );
}
