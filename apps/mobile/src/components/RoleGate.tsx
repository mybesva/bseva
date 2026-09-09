import { isAdminRole, isCustomerRole, isPujariRole } from "@bseva/config";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export function RoleGate({
  allow,
  children,
}: {
  allow: "customer" | "pujari";
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/" />;
  if (isAdminRole(user.role)) return <Redirect href="/admin-web" />;
  if (allow === "customer" && !isCustomerRole(user.role)) {
    return <Redirect href={isPujariRole(user.role) ? "/pujari" : "/"} />;
  }
  if (allow === "pujari" && !isPujariRole(user.role)) {
    return <Redirect href={isCustomerRole(user.role) ? "/customer" : "/"} />;
  }
  return <>{children}</>;
}
