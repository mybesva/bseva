import { useCallback, useEffect, useState } from "react";

/** Seconds-remaining countdown, e.g. for the OTP resend gap or a 429 retry wait. */
export function useCountdown() {
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt <= Date.now()) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + Math.max(0, seconds) * 1000);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return { remaining, start, active: remaining > 0 };
}

/** "1 min 05 s" style text for a wait of `seconds`. */
export function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")} s` : `${m} min`;
}
