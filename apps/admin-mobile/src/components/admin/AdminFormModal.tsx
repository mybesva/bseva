import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, PrimaryButton } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";

export function AdminFormModal({
  visible,
  title,
  onClose,
  children,
  submitLabel,
  onSubmit,
  loading,
  disabled,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <AppText variant="h3" style={{ flex: 1 }}>
            {title}
          </AppText>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {children}
          <PrimaryButton title={submitLabel} onPress={onSubmit} loading={loading} disabled={disabled} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
