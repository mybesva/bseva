import { useEffect, type ReactNode } from "react";
import * as SplashScreen from "expo-splash-screen";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Native splash (official logo) hides once, then the app shows. No second JS splash. */
export function BrandSplash({ children }: { children: ReactNode }) {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return <>{children}</>;
}
