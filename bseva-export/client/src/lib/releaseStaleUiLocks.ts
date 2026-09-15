/**
 * Radix Dialog/Sheet can leave invisible full-screen overlays or body scroll-lock
 * after SPA navigations (e.g. mobile menu open → Customer/Pujari link, logout).
 * Inputs look focusable but clicks/typing hit the stale layer until a full refresh.
 */
export function releaseStaleUiLocks() {
  if (typeof document === "undefined") return;

  const body = document.body;
  const html = document.documentElement;

  body.style.removeProperty("pointer-events");
  body.style.removeProperty("overflow");
  body.style.removeProperty("padding-right");
  html.style.removeProperty("overflow");
  html.style.removeProperty("padding-right");

  const overlaySelector =
    '[data-slot="sheet-overlay"], [data-slot="dialog-overlay"], [data-radix-dialog-overlay]';

  document.querySelectorAll(overlaySelector).forEach((node) => {
    const el = node as HTMLElement;
    const state = el.getAttribute("data-state");
    if (state === "closed" || state === "open") {
      el.closest("[data-radix-portal]")?.remove();
    }
  });
}
