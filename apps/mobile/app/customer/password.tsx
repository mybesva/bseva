import { Redirect } from "expo-router";

export default function ChangePasswordScreen() {
  return <Redirect href="/customer/profile?tab=password" />;
}
