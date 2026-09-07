import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Reset window (and portal main panes) to top on every route change.
 * Without this, SPA navigations keep the previous page's scroll offset
 * (e.g. Register / Book opening mid-page or at the footer).
 */
export default function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      document.querySelectorAll<HTMLElement>("[data-scroll-reset], main").forEach((el) => {
        try {
          el.scrollTop = 0;
        } catch {
          /* ignore */
        }
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location]);

  return null;
}
