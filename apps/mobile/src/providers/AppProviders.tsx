import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { AuthProvider } from "./AuthProvider";
import { I18nProvider } from "./I18nProvider";
import { ThemeProvider } from "./ThemeProvider";

/** React Native has no window focus: tell React Query when the app returns to the foreground. */
function useRefetchOnAppForeground() {
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (Platform.OS !== "web") focusManager.setFocused(status === "active");
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);
}

export function AppProviders({ children }: { children: ReactNode }) {
  useRefetchOnAppForeground();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Data older than 30 s is reloaded when the app comes back from the background
          // (refetchOnWindowFocus follows focusManager above), so admin changes show up without a restart.
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
