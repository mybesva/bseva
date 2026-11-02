import { useCallback, useEffect, useState } from "react";

/** Seconds left before an action (e.g. OTP resend) is allowed again. */
export function useCountdown() {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const tmr = setTimeout(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(tmr);
  }, [left]);

  const start = useCallback((seconds: number) => setLeft(Math.max(0, Math.round(seconds))), []);

  return { left, start };
}
