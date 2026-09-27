import { ActionSheetIOS, Alert, Platform } from "react-native";

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export function showAdminActionSheet(
  title: string,
  options: ActionSheetOption[],
  cancelLabel = "Cancel"
) {
  const enabled = options.filter((o) => !o.disabled);
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...enabled.map((o) => o.label), cancelLabel],
        cancelButtonIndex: enabled.length,
        destructiveButtonIndex: enabled.findIndex((o) => o.destructive),
      },
      (index) => {
        if (index != null && index < enabled.length) enabled[index].onPress();
      }
    );
    return;
  }
  Alert.alert(
    title,
    undefined,
    [
      ...enabled.map((o) => ({
        text: o.label,
        onPress: o.onPress,
        style: (o.destructive ? "destructive" : "default") as "destructive" | "default",
      })),
      { text: cancelLabel, style: "cancel" as const },
    ]
  );
}

export function confirmAdminAction(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Confirm", style: "destructive", onPress: onConfirm },
  ]);
}
