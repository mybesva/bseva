import { Alert, type AlertButton } from "react-native";

export function showSuccessAlert(title: string, message?: string, buttons?: AlertButton[]) {
  Alert.alert(title, message, buttons ?? [{ text: "OK" }]);
}

export function confirmDestructiveAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  cancelLabel = "Cancel",
) {
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
