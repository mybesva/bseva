import { Stack } from "expo-router";
import { RoleGate } from "@/components/RoleGate";

export default function CustomerLayout() {
  return (
    <RoleGate allow="customer">
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </RoleGate>
  );
}
