import {
  filterHeadRatingPujaris,
  formatIndianPhone,
  headRatingPujariSubtitle,
  type HeadRatingPujari,
} from "@bseva/config";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, PrimaryButton } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";

export function SearchablePujariSelect({
  label,
  pujaris,
  value,
  onChange,
  loading,
  error,
}: {
  label: string;
  pujaris: HeadRatingPujari[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = pujaris.find((p) => p.id === value);
  const filtered = useMemo(() => filterHeadRatingPujaris(pujaris, query), [pujaris, query]);

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small" style={{ fontWeight: "600", color: colors.mutedForeground }}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected?.name || "Choose a pujari"}
        disabled={loading}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: error ? colors.destructive : colors.border,
          borderRadius: 10,
          paddingVertical: 14,
          paddingHorizontal: 14,
          minHeight: 48,
          backgroundColor: colors.card,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginRight: 4 }} />
        ) : (
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        )}
        <AppText style={{ flex: 1 }} numberOfLines={2}>
          {loading ? "Loading pujaris..." : selected?.name || "Choose a pujari"}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>
      {error ? <AppText variant="small" color={colors.destructive}>{error}</AppText> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setOpen(false)} />
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.background, maxHeight: "78%" }}>
            <View
              style={{
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
                gap: 10,
              }}
            >
              <AppText variant="h3">{label}</AppText>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  minHeight: 48,
                  backgroundColor: colors.card,
                }}
              >
                <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search pujari by name, email or phone"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  style={{ flex: 1, color: colors.foreground, fontSize: 16, paddingVertical: 10 }}
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
                {filtered.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <AppText color={colors.mutedForeground}>No pujaris found.</AppText>
                  </View>
                ) : (
                  filtered.map((p) => {
                    const active = value === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          onChange(p.id);
                          setOpen(false);
                          setQuery("");
                        }}
                        style={{
                          minHeight: 56,
                          paddingVertical: 10,
                          paddingHorizontal: 4,
                          borderBottomWidth: 0.5,
                          borderBottomColor: colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          backgroundColor: active ? colors.secondary : "transparent",
                          borderRadius: 8,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="body" style={{ fontWeight: active ? "700" : "600" }}>
                            {p.name}
                          </AppText>
                          <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
                            {headRatingPujariSubtitle(p) || formatIndianPhone(p.phone)}
                          </AppText>
                        </View>
                        {active ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <PrimaryButton title="Close" variant="outline" onPress={() => setOpen(false)} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export function SelectedPujariCard({
  pujari,
  onChange,
}: {
  pujari: HeadRatingPujari;
  onChange: () => void;
}) {
  const { colors } = useAppTheme();
  const phone = formatIndianPhone(pujari.phone);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.primary + "44",
        backgroundColor: colors.primary + "11",
        borderRadius: 12,
        padding: 12,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <AppText style={{ fontWeight: "700", flex: 1 }} numberOfLines={2}>
              {pujari.name}
            </AppText>
          </View>
          {phone !== "—" ? <AppText variant="small" color={colors.mutedForeground}>{phone}</AppText> : null}
          {pujari.email ? (
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
              {pujari.email}
            </AppText>
          ) : null}
        </View>
        <Pressable onPress={onChange} accessibilityRole="button" accessibilityLabel="Change pujari">
          <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
            Change
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
