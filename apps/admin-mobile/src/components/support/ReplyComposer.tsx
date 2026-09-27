import { useState } from "react";
import { View } from "react-native";
import { SUPPORT_NOTE_KINDS } from "@bseva/config";
import { AppText, ErrorBanner, Field, PrimaryButton, SuccessBanner } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { SupportSelect } from "./SupportSelect";

export function ReplyComposer({
  disabled,
  sending,
  error,
  success,
  onSend,
}: {
  disabled?: boolean;
  sending?: boolean;
  error?: string | null;
  success?: string | null;
  onSend: (body: string, kind: string) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const [reply, setReply] = useState("");
  const [noteKind, setNoteKind] = useState("reply");

  async function handleSend() {
    const trimmed = reply.trim();
    if (!trimmed || sending) return;
    try {
      await onSend(trimmed, noteKind);
      setReply("");
    } catch {
      // keep typed reply on failure
    }
  }

  return (
    <View style={{ gap: 10, paddingTop: 4 }}>
      <AppText variant="h3" color={colors.navy}>
        Reply
      </AppText>
      <ErrorBanner message={error || null} />
      <SuccessBanner message={success || null} />
      <SupportSelect
        label="Message type"
        value={noteKind}
        options={SUPPORT_NOTE_KINDS.map((k) => ({ id: k.id, label: k.label }))}
        onChange={setNoteKind}
        disabled={disabled || sending}
      />
      <Field
        label="Write a reply"
        value={reply}
        onChangeText={setReply}
        multiline
        editable={!disabled && !sending}
        placeholder="Write a reply…"
        style={{ minHeight: 96, textAlignVertical: "top" }}
      />
      <View style={{ alignItems: "flex-end" }}>
        <View style={{ minWidth: 140, alignSelf: "flex-end" }}>
          <PrimaryButton
            title={sending ? "Sending…" : noteKind === "reply" ? "Send Reply" : "Add Note"}
            loading={sending}
            disabled={disabled || !reply.trim()}
            onPress={() => void handleSend()}
          />
        </View>
      </View>
    </View>
  );
}
