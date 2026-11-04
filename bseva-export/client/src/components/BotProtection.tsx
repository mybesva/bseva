import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Bot signals for public forms. The server makes every decision: a honeypot field people never see,
 * the time the form took, and a self-hosted image CAPTCHA whose answer only the server knows.
 */

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

export type CaptchaPurpose = "contact" | "register" | "login";
export type CaptchaValues = { captcha_id?: string; captcha_answer?: string };
export type CaptchaHandle = {
  /** Fetch a new image and retire the current one (after every send: each image works once). */
  refresh: () => void;
  values: () => CaptchaValues;
};

type Challenge = { captcha_id: string; image: string; length: number };

/** Error codes the server uses when the CAPTCHA answer is missing or wrong. */
export function isCaptchaError(code?: string) {
  return code === "CAPTCHA_REQUIRED" || code === "CAPTCHA_INVALID";
}

/**
 * Five-character image CAPTCHA. The image comes from the server with an opaque id; the answer never
 * reaches the browser. Not case-sensitive.
 */
export const CaptchaField = forwardRef<CaptchaHandle, { purpose: CaptchaPurpose; className?: string; disabled?: boolean }>(
  function CaptchaField({ purpose, className, disabled }, ref) {
    const inputId = useId();
    const helpId = useId();
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const current = useRef<string | null>(null);
    const answerRef = useRef("");
    answerRef.current = answer;

    const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await api<Challenge>("/captcha", {
          method: "POST",
          body: JSON.stringify({ purpose, replaces: current.current || undefined }),
        });
        current.current = next.captcha_id;
        setChallenge(next);
        setAnswer("");
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "The security image could not load. Please try again.");
      } finally {
        setLoading(false);
      }
    }, [purpose]);

    useEffect(() => {
      void load();
    }, [load]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => void load(),
        values: () => ({
          captcha_id: current.current || undefined,
          captcha_answer: answerRef.current.trim() || undefined,
        }),
      }),
      [load],
    );

    return (
      <div className={className}>
        <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">
          Security check
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <div className="flex h-[60px] w-[200px] items-center justify-center overflow-hidden rounded-md border border-border bg-white">
            {challenge ? (
              <img
                src={challenge.image}
                width={200}
                height={60}
                alt="Security check image with 5 letters and numbers. If you cannot read it, choose New image or contact us."
                className="block h-[60px] w-[200px] select-none"
                draggable={false}
              />
            ) : loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || disabled}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
            aria-label="Show a new security image"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            New image
          </button>
        </div>
        <input
          id={inputId}
          name="captcha_answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
          disabled={disabled || !challenge}
          required
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={5}
          placeholder="5 characters"
          aria-describedby={helpId}
          className="mt-2 h-11 w-full max-w-[200px] rounded-md border border-input bg-background px-3 font-mono text-base uppercase tracking-[0.35em] text-foreground placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <p id={helpId} className="mt-1 text-xs text-muted-foreground">
          Not case-sensitive. Can&apos;t read it? Choose New image, or email or WhatsApp us instead.
        </p>
        {error ? (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
