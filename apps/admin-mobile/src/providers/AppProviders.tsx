import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { AdminProvider } from "./AdminProvider";
import { AuthProvider } from "./AuthProvider";
import { I18nProvider } from "./I18nProvider";
import { ThemeProvider } from "./ThemeProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 20_000 } },
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
