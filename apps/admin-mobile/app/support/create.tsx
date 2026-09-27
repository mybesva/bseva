import {
  EMPTY_SUPPORT_TICKET,
  SUPPORT_CATEGORIES,
  SUPPORT_CONTACT_SOURCES,
  SUPPORT_PRIORITIES,
  SUPPORT_REPORTER_TYPES,
} from "@bseva/config";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SupportSelect, type DirectoryPerson } from "@/components/support";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function CreateSupportTicketScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_SUPPORT_TICKET });
  const [dirQ, setDirQ] = useState("");
  const [person, setPerson] = useState<DirectoryPerson | null>(null);
  const [hits, setHits] = useState<DirectoryPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [bookingId, setBookingId] = useState("");

  async function searchPeople() {
    if (!dirQ.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const found = await apiClient.supportDirectory(dirQ.trim(), form.reporter_type);
      setHits(found as DirectoryPerson[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function createTicket() {
    if (!form.subject.trim() || !form.description.trim()) {
      setError("Subject and description are required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        sla_hours: form.sla_hours ? Number(form.sla_hours) : undefined,
        assigned_admin_id: form.assigned_admin_id || undefined,
        related_booking_id: bookingId || undefined,
        user_id: person && form.reporter_type !== "temple" ? person.id : undefined,
        guest_name:
          form.reporter_type === "other" || form.reporter_type === "temple"
            ? form.guest_name || person?.name
            : undefined,
        guest_phone:
          form.reporter_type === "other" || form.reporter_type === "temple"
            ? form.guest_phone || person?.phone
            : undefined,
        guest_email:
          form.reporter_type === "other" || form.reporter_type === "temple"
            ? form.guest_email || person?.email
            : undefined,
      };
      await apiClient.createSupportTicket(payload);
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Create Ticket" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error} />
          <Card style={{ gap: 12 }}>
            <SupportSelect
              label="Reported by"
              value={form.reporter_type}
              options={SUPPORT_REPORTER_TYPES.map((o) => ({ id: o.id, label: o.label }))}
              onChange={(reporter_type) => {
                setForm({ ...form, reporter_type });
                setPerson(null);
                setHits([]);
              }}
            />
            <Field
              label="Find person"
              value={dirQ}
              onChangeText={setDirQ}
              placeholder="Search customer / pujari / ID…"
            />
            <PrimaryButton title="Search Directory" variant="outline" loading={searching} onPress={() => void searchPeople()} />
            {hits.length > 0 ? (
              <View style={{ gap: 6 }}>
                {hits.map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => setPerson(h)}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: person?.id === h.id ? "#ea580c" : "#e5e7eb",
                      backgroundColor: person?.id === h.id ? "#fff7ed" : "#fff",
                    }}
                  >
                    <AppText style={{ fontWeight: person?.id === h.id ? "700" : "500" }}>
                      {h.name || h.id}
                    </AppText>
                    <AppText variant="small">{h.public_id || h.id}</AppText>
                    <AppText variant="small">{h.phone || h.email || ""}</AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {person ? (
              <AppText variant="small">Selected: {person.name || person.id}</AppText>
            ) : null}
            <Field label="Subject *" value={form.subject} onChangeText={(subject) => setForm({ ...form, subject })} />
            <Field
              label="Description *"
              value={form.description}
              onChangeText={(description) => setForm({ ...form, description })}
              multiline
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />
            <SupportSelect
              label="Category *"
              value={form.category}
              options={SUPPORT_CATEGORIES.map((o) => ({ id: o.id, label: o.label }))}
              onChange={(category) => setForm({ ...form, category })}
            />
            <SupportSelect
              label="Priority *"
              value={form.priority}
              options={SUPPORT_PRIORITIES.map((o) => ({ id: o.id, label: o.label }))}
              onChange={(priority) => setForm({ ...form, priority })}
            />
            <SupportSelect
              label="Contact source *"
              value={form.contact_source}
              options={SUPPORT_CONTACT_SOURCES.map((o) => ({ id: o.id, label: o.label }))}
              onChange={(contact_source) => setForm({ ...form, contact_source })}
            />
            <Field
              label="Expected resolution"
              value={form.expected_resolution}
              onChangeText={(expected_resolution) => setForm({ ...form, expected_resolution })}
            />
            <Field label="Related booking ID" value={bookingId} onChangeText={setBookingId} />
            {form.reporter_type === "other" || form.reporter_type === "temple" ? (
              <>
                <Field label="Guest name" value={form.guest_name} onChangeText={(guest_name) => setForm({ ...form, guest_name })} />
                <Field label="Guest phone" value={form.guest_phone} onChangeText={(guest_phone) => setForm({ ...form, guest_phone })} />
                <Field label="Guest email" value={form.guest_email} onChangeText={(guest_email) => setForm({ ...form, guest_email })} />
              </>
            ) : null}
            <PrimaryButton title="Create Ticket" loading={creating} onPress={() => void createTicket()} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
