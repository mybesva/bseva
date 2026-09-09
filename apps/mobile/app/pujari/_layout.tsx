import { Stack } from "expo-router";
import { RoleGate } from "@/components/RoleGate";

export default function PujariLayout() {
  return (
    <RoleGate allow="pujari">
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </RoleGate>
  );
}
