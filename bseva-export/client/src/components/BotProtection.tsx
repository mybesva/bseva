import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Bot signals for public forms. The server makes every decision; these only collect evidence:
 * a honeypot field people never see, the time the form took, and a Cloudflare Turnstile token
 * when the server publishes a site key (nothing renders without one).
 */

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi | null> | null = null;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = TURNSTILE_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(window.turnstile || null);
      s.onerror = () => {
        scriptPromise = null;
        resolve(null);
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/** Milliseconds since the form first rendered, and a reset for after a successful send. */
export function useFormTimer() {
  const startedAt = useRef(Date.now());
  const elapsedMs = useCallback(() => Date.now() - startedAt.current, []);
  const restart = useCallback(() => {
    startedAt.current = Date.now();
  }, []);
  return { elapsedMs, restart };
}

/** Off-screen field that people never see or reach with the keyboard; bots that fill every input fill it. */
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Website
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

export type TurnstileHandle = { reset: () => void };

type TurnstileProps = {
  siteKey?: string;
  action: string;
  onToken: (token: string | null) => void;
  className?: string;
};

/** Cloudflare Turnstile widget. Renders nothing without a site key. Tokens are single use: reset after each send. */
export const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileProps>(function TurnstileWidget(
  { siteKey, action, onToken, className },
  ref,
) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  tokenCb.current = onToken;
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      tokenCb.current(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    void loadTurnstile().then((api) => {
      if (cancelled || !holder.current) return;
      if (!api) {
        setFailed(true);
        return;
      }
      widgetId.current = api.render(holder.current, {
        sitekey: siteKey,
        action,
        appearance: "interaction-only",
        callback: (token: string) => tokenCb.current(token),
        "expired-callback": () => tokenCb.current(null),
        "error-callback": () => tokenCb.current(null),
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action]);

  if (!siteKey) return null;
  return (
    <div className={className}>
      <div ref={holder} />
      {failed ? (
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          The security check could not load. If sending fails, please email or WhatsApp us instead.
        </p>
      ) : null}
    </div>
  );
});
