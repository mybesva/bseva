import type { FamilyMember, SevaEvent, ServicePackage } from "@bseva/types";
import { rupees } from "@bseva/config";
import { ApiError } from "@bseva/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  AppText,
  Card,
  ChoiceChips,
  ErrorBanner,
  Field,
  LoadingBlock,
  PrimaryButton,
  Screen,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { showSuccessAlert } from "@/utils/actionFeedback";
import { formatDisplaySlot } from "@/utils/formatDate";
import { apiErrorMessage } from "@/utils/userMessage";

const SEVA_ERROR_CODES: Record<string, string> = {
  DUPLICATE_REGISTRATION: "seva.error.duplicate",
  CUTOFF_PASSED: "seva.error.cutoff",
  REGISTRATION_CLOSED: "seva.error.cutoff",
  EVENT_SOLD_OUT: "seva.error.soldOut",
  INSUFFICIENT_WALLET: "seva.error.insufficientWallet",
};

function sevaErrorMessage(t: (key: string) => string, e: unknown): string {
  if (e instanceof ApiError && e.code) {
    const key = SEVA_ERROR_CODES[e.code.toUpperCase()];
    if (key) {
      const msg = t(key);
      if (msg !== key) return msg;
    }
  }
  return apiErrorMessage(t, e, "mobile.saveFailed");
}

function participationOptions(t: (key: string) => string, event: SevaEvent) {
  const mode = String(event.participation_mode || "offline");
  if (mode === "hybrid") {
    return [
      { id: "offline", label: t("seva.offline") },
      { id: "online", label: t("seva.online") },
    ];
  }
  if (mode === "online") {
    return [{ id: "online", label: t("seva.online") }];
  }
  return [{ id: "offline", label: t("seva.offline") }];
}

function eventKindLabel(t: (key: string) => string, kind?: string | null): string | null {
  if (kind === "group_live") return t("seva.groupLivePuja");
  if (kind === "proxy") return t("seva.proxyPuja");
  return null;
}

export default function CustomerSevaEventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const qc = useQueryClient();

  const eventQ = useQuery({
    queryKey: ["seva-event", id],
    queryFn: () => apiClient.getSevaEvent(String(id)),
    enabled: !!id,
  });

  const familyQ = useQuery({
    queryKey: ["family-members"],
    queryFn: () => apiClient.listFamilyMembers(),
  });

  const event = eventQ.data as SevaEvent | undefined;
  const packages = (event?.packages || []) as ServicePackage[];
  const partOptions = useMemo(() => (event ? participationOptions(t, event) : []), [event, t]);

  const [participationMode, setParticipationMode] = useState("offline");
  const [packageId, setPackageId] = useState("");
  const [gotra, setGotra] = useState("");
  const [gotraUnknown, setGotraUnknown] = useState(false);
  const [sankalpText, setSankalpText] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    const defaultPart = partOptions[0]?.id || "offline";
    setParticipationMode(defaultPart);
  }, [event?.id, partOptions]);

  useEffect(() => {
    if (packages.length === 1) setPackageId(packages[0].id);
  }, [packages]);

  const familyMembers = (familyQ.data || []) as FamilyMember[];
  const selectedMembers = familyMembers.filter((m) => m.id && selectedMemberIds.includes(m.id));

  const title = event?.title || event?.service_name || t("seva.events");
  const startIso = String(event?.start_at || "");
  const timePart = startIso.includes("T") ? startIso.split("T")[1]?.slice(0, 5) : null;
  const kindLabel = eventKindLabel(t, event?.puja_event_kind);
  const registrationClosed = event?.sold_out || event?.registration_open === false;

  async function submitRegistration() {
    if (!event || !id) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        participation_mode: participationMode,
        primary_name: String(user?.name || "").trim() || null,
        gotra: gotraUnknown ? null : gotra.trim() || null,
        gotra_unknown: gotraUnknown,
        sankalp_text: sankalpText.trim() || null,
        family_members: selectedMembers.map((m) => ({
          name: m.name,
          gotra: m.gotra_unknown ? null : m.gotra || null,
          gotra_unknown: Boolean(m.gotra_unknown),
          relationship: m.relationship,
          date_of_birth: m.date_of_birth || null,
        })),
      };
      if (packageId) body.package_id = packageId;
      await apiClient.registerSevaEvent(String(id), body);
      await qc.invalidateQueries({ queryKey: ["my-seva-registrations"] });
      showSuccessAlert(t("seva.registrationConfirmed"));
      router.replace("/customer/my-seva");
    } catch (e: unknown) {
      setError(sevaErrorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  if (eventQ.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("seva.events")} back />
        <LoadingBlock />
      </Screen>
    );
  }

  if (eventQ.error || !event) {
    return (
      <Screen>
        <ScreenHeader title={t("seva.events")} back />
        <ErrorBanner message={eventQ.error instanceof Error ? eventQ.error.message : t("seva.noEvents")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={title} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <Card style={{ gap: 8 }}>
              {event.service_name ? <AppText variant="h3">{event.service_name}</AppText> : null}
              {kindLabel ? <AppText variant="small" color={colors.mutedForeground}>{kindLabel}</AppText> : null}
              {event.temple_name ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  {event.temple_name}
                  {event.temple_city ? ` · ${event.temple_city}` : ""}
                </AppText>
              ) : null}
              <AppText>{formatDisplaySlot(event.start_at, timePart)}</AppText>
              {event.description ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  {String(event.description)}
                </AppText>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
                  {event.is_free ? t("seva.free") : event.price_paise != null ? rupees(Number(event.price_paise)) : t("seva.paid")}
                </AppText>
                {event.sold_out ? (
                  <AppText variant="small" color={colors.destructive}>
                    {t("seva.soldOut")}
                  </AppText>
                ) : event.seats_remaining != null ? (
                  <AppText variant="small" color={colors.mutedForeground}>
                    {t("seva.seatsRemaining", { count: String(event.seats_remaining) })}
                  </AppText>
                ) : null}
              </View>
            </Card>

            {registrationClosed ? (
              <ErrorBanner message={event.sold_out ? t("seva.soldOut") : t("seva.registrationClosed")} />
            ) : (
              <>
                <ErrorBanner message={error} />

                {packages.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    <AppText variant="h3">{t("seva.selectPackage")}</AppText>
                    {packages.map((pkg) => {
                      const selected = packageId === pkg.id;
                      return (
                        <Pressable
                          key={pkg.id}
                          onPress={() => setPackageId(pkg.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Card
                            style={{
                              gap: 4,
                              borderColor: selected ? colors.primary : colors.border,
                              borderWidth: selected ? 2 : 1,
                            }}
                          >
                            <AppText style={{ fontWeight: "700" }}>{pkg.name}</AppText>
                            <AppText color={colors.primary}>{rupees(Number(pkg.price_paise || 0))}</AppText>
                            {pkg.inclusions ? (
                              <AppText variant="small" color={colors.mutedForeground}>
                                {String(pkg.inclusions)}
                              </AppText>
                            ) : null}
                          </Card>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {partOptions.length > 1 ? (
                  <View style={{ gap: 8 }}>
                    <AppText variant="h3">{t("seva.participationMode")}</AppText>
                    <ChoiceChips
                      options={partOptions}
                      value={participationMode}
                      onChange={(next) => setParticipationMode(String(next))}
                    />
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <AppText style={{ flex: 1 }}>{t("seva.gotraUnknown")}</AppText>
                  <Switch value={gotraUnknown} onValueChange={setGotraUnknown} />
                </View>

                {!gotraUnknown ? (
                  <Field label={t("seva.gotra")} value={gotra} onChangeText={setGotra} />
                ) : null}

                <Field
                  label={t("seva.sankalp")}
                  value={sankalpText}
                  onChangeText={setSankalpText}
                  multiline
                  placeholder={t("seva.sankalp")}
                />

                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <AppText variant="h3" style={{ flex: 1 }}>
                      {t("seva.familyMembers")}
                    </AppText>
                    <Pressable onPress={() => router.push("/customer/family-sankalp")} accessibilityRole="button">
                      <AppText color={colors.primary} style={{ fontWeight: "600" }}>
                        {t("seva.addMember")}
                      </AppText>
                    </Pressable>
                  </View>
                  {familyMembers.length === 0 ? (
                    <AppText variant="small" color={colors.mutedForeground}>
                      {t("seva.addMember")}
                    </AppText>
                  ) : (
                    familyMembers.map((member) => {
                      const mid = String(member.id || member.name);
                      const on = member.id ? selectedMemberIds.includes(member.id) : false;
                      return (
                        <Pressable
                          key={mid}
                          onPress={() => {
                            if (!member.id) return;
                            setSelectedMemberIds((prev) =>
                              prev.includes(member.id!) ? prev.filter((x) => x !== member.id) : [...prev, member.id!],
                            );
                          }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                        >
                          <Card
                            style={{
                              gap: 4,
                              borderColor: on ? colors.primary : colors.border,
                              borderWidth: on ? 2 : 1,
                            }}
                          >
                            <AppText style={{ fontWeight: "700" }}>{member.name}</AppText>
                            <AppText variant="small" color={colors.mutedForeground}>
                              {member.relationship}
                              {member.gotra_unknown ? "" : member.gotra ? ` · ${member.gotra}` : ""}
                            </AppText>
                          </Card>
                        </Pressable>
                      );
                    })
                  )}
                </View>

                <PrimaryButton
                  title={busy ? t("common.loading") : t("seva.register")}
                  loading={busy}
                  disabled={busy || (packages.length > 0 && !packageId)}
                  onPress={() => void submitRegistration()}
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
