import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, type RefreshControlProps } from "react-native";

type Props = Omit<RefreshControlProps, "refreshing" | "onRefresh"> & {
  /** Reload the screen's data; return the promise so the spinner stays until it finishes. */
  onRefresh: () => unknown;
};

/**
 * Pull-to-refresh whose spinner shows only while the user's own pull is reloading. Background refetches
 * (returning to a tab, the app coming back to the foreground, polling) stay silent, so switching tabs never
 * flashes the spinner or makes the page jump.
 */
export function PullToRefresh({ onRefresh, ...rest }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch {
      /* each query shows its own error state */
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [onRefresh]);
  return <RefreshControl {...rest} refreshing={refreshing} onRefresh={handleRefresh} />;
}
