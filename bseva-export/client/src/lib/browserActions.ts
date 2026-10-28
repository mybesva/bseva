export async function copyTextSafely(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy unavailable");
}

export async function shareSafely(data: ShareData): Promise<"shared" | "copied"> {
  if (navigator.share) {
    await navigator.share(data);
    return "shared";
  }
  await copyTextSafely([data.text, data.url].filter(Boolean).join("\n"));
  return "copied";
}

// How many pages deep the user has navigated inside this app (not counting pages from other sites).
let inAppDepth = 0;

/** Call once at startup so `goBackOr` knows whether the previous page belongs to this app. */
export function trackInAppNavigation(): void {
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    inAppDepth += 1;
    push(...args);
  };
  window.addEventListener("popstate", () => {
    inAppDepth = Math.max(0, inAppDepth - 1);
  });
}

/** Go to the previous page in the app; when the page was opened directly, go to `fallback`. */
export function goBackOr(fallback: string, setLocation: (to: string) => void): void {
  if (inAppDepth > 0) window.history.back();
  else setLocation(fallback);
}
