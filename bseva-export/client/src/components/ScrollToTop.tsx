import { useEffect } from "react";
import { useLocation } from "wouter";

function resetScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.querySelectorAll<HTMLElement>("[data-scroll-reset]").forEach((el) => {
    try {
      el.scrollTop = 0;
    } catch {
      /* ignore */
    }
  });
}

/**
 * Reset window (and portal main panes) to top on every route change.
 * Without this, SPA navigations keep the previous page's scroll offset
 * (e.g. Services → Contact via "Request Custom Puja" opening mid/bottom).
 */
export default function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    resetScroll();
    // Re-apply after paint / late layout (images, fonts) so we don't stay at prior offset
    const t0 = window.setTimeout(resetScroll, 0);
    const t1 = window.setTimeout(resetScroll, 50);
    const t2 = window.setTimeout(resetScroll, 150);
    const raf = window.requestAnimationFrame(resetScroll);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.cancelAnimationFrame(raf);
    };
  }, [location]);

  return null;
}
