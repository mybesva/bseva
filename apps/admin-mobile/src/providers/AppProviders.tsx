import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { type ReactNode, useState, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { AdminProvider } from "./AdminProvider";
import { AuthProvider } from "./AuthProvider";
import { I18nProvider } from "./I18nProvider";
import { ThemeProvider } from "./ThemeProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  // Reload stale data when the app returns to the foreground (React Native has no window focus).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      if (Platform.OS !== "web") focusManager.setFocused(status === "active");
    });
    return () => sub.remove();
  }, []);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: true } },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <AdminProvider>{children}</AdminProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
