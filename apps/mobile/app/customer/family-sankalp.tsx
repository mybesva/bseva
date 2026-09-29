import type { FamilyMember, FamilyRelationship } from "@bseva/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DatePickerField } from "@/components/DatePickerField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SelectField } from "@/components/SelectField";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { showSuccessAlert } from "@/utils/actionFeedback";
import { apiErrorMessage } from "@/utils/userMessage";

const RELATIONSHIPS: FamilyRelationship[] = ["self", "spouse", "parent", "child", "other"];

type FormState = {
  name: string;
  gotra: string;
  gotra_unknown: boolean;
  relationship: FamilyRelationship;
  date_of_birth: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  gotra: "",
  gotra_unknown: false,
  relationship: "other",
  date_of_birth: "",
  notes: "",
};

function toForm(member: FamilyMember): FormState {
  return {
    name: String(member.name || ""),
    gotra: String(member.gotra || ""),
    gotra_unknown: Boolean(member.gotra_unknown),
    relationship: member.relationship || "other",
    date_of_birth: String(member.date_of_birth || ""),
    notes: String(member.notes || ""),
  };
}

export default function CustomerFamilySankalp() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const membersQ = useQuery({
    queryKey: ["family-members"],
    queryFn: () => apiClient.listFamilyMembers(),
  });

  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = (membersQ.data || []) as FamilyMember[];

  const relationshipOptions = RELATIONSHIPS.map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
  }));

  function startAdd() {
    setEditId(null);
    setForm(emptyForm);
    setMode("add");
    setError(null);
  }

  function startEdit(member: FamilyMember) {
    setEditId(String(member.id || ""));
    setForm(toForm(member));
    setMode("edit");
    setError(null);
  }

  function cancelForm() {
    setMode("list");
    setEditId(null);
    setForm(emptyForm);
    setError(null);
  }

  function confirmDelete(member: FamilyMember) {
    if (!member.id) return;
    Alert.alert(t("common.delete"), t("common.confirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await apiClient.deleteFamilyMember(member.id!);
              if (editId === member.id) cancelForm();
              await membersQ.refetch();
              await qc.invalidateQueries({ queryKey: ["family-members"] });
              showSuccessAlert(t("common.done"));
            } catch (e: unknown) {
              setError(apiErrorMessage(t, e, "mobile.saveFailed"));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  async function saveMember() {
    if (!form.name.trim()) {
      setError(t("common.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        gotra: form.gotra_unknown ? null : form.gotra.trim() || null,
        gotra_unknown: form.gotra_unknown,
        relationship: form.relationship,
        date_of_birth: form.date_of_birth.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (mode === "edit" && editId) {
        await apiClient.updateFamilyMember(editId, body);
      } else {
        await apiClient.createFamilyMember(body);
      }
      await membersQ.refetch();
      await qc.invalidateQueries({ queryKey: ["family-members"] });
      showSuccessAlert(t("common.done"));
      cancelForm();
    } catch (e: unknown) {
      setError(apiErrorMessage(t, e, "mobile.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (membersQ.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("seva.familySankalp")} back />
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t("seva.familySankalp")} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
            <ErrorBanner message={error} />

            {mode === "list" ? (
              <>
                <PrimaryButton title={t("seva.addMember")} onPress={startAdd} />
                {members.length === 0 ? (
                  <AppText color={colors.mutedForeground}>{t("seva.addMember")}</AppText>
                ) : (
                  members.map((member) => (
                    <Card key={member.id || member.name} style={{ gap: 6 }}>
                      <AppText style={{ fontWeight: "700" }}>{member.name}</AppText>
                      <AppText variant="small" color={colors.mutedForeground}>
                        {member.relationship}
                        {member.gotra_unknown ? ` · ${t("seva.gotraUnknown")}` : member.gotra ? ` · ${member.gotra}` : ""}
                      </AppText>
                      {member.date_of_birth ? (
                        <AppText variant="small" color={colors.mutedForeground}>
                          {member.date_of_birth}
                        </AppText>
                      ) : null}
                      {member.notes ? (
                        <AppText variant="small" color={colors.mutedForeground}>
                          {member.notes}
                        </AppText>
                      ) : null}
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        <PrimaryButton title={t("common.edit")} variant="outline" onPress={() => startEdit(member)} />
                        <PrimaryButton
                          title={t("common.delete")}
                          variant="outline"
                          onPress={() => confirmDelete(member)}
                        />
                      </View>
                    </Card>
                  ))
                )}
              </>
            ) : (
              <>
                <Field
                  label={t("auth.name")}
                  value={form.name}
                  onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                  required
                />
                <SelectField
                  label={t("seva.familyMembers")}
                  value={form.relationship}
                  options={relationshipOptions}
                  placeholder={t("common.select")}
                  onChange={(relationship) =>
                    setForm((prev) => ({ ...prev, relationship: relationship as FamilyRelationship }))
                  }
                />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <AppText style={{ flex: 1 }}>{t("seva.gotraUnknown")}</AppText>
                  <Switch
                    value={form.gotra_unknown}
                    onValueChange={(gotra_unknown) => setForm((prev) => ({ ...prev, gotra_unknown }))}
                  />
                </View>
                {!form.gotra_unknown ? (
                  <Field
                    label={t("seva.gotra")}
                    value={form.gotra}
                    onChangeText={(gotra) => setForm((prev) => ({ ...prev, gotra }))}
                  />
                ) : null}
                <DatePickerField
                  label={t("booking.selectDate")}
                  value={form.date_of_birth}
                  onChange={(date_of_birth) => setForm((prev) => ({ ...prev, date_of_birth }))}
                />
                <Field
                  label={t("seva.sankalp")}
                  value={form.notes}
                  onChangeText={(notes) => setForm((prev) => ({ ...prev, notes }))}
                  multiline
                />
                <PrimaryButton
                  title={busy ? t("common.loading") : t("common.save")}
                  loading={busy}
                  onPress={() => void saveMember()}
                />
                <PrimaryButton title={t("common.cancel")} variant="outline" onPress={cancelForm} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
