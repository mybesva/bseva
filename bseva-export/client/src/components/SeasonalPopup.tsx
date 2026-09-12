import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

type Popup = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

const SEEN_KEY = "bseva_seasonal_popup_seen_v2";

/** Shows at most one seasonal popup per 7 days per popup id (req #103). */
export default function SeasonalPopup() {
  const { lang } = useI18n();
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    api<Popup[]>(`/promos/popups?lang=${lang}`)
      .then((rows) => {
        const first = rows?.[0];
        if (!first) return;
        try {
          const raw = localStorage.getItem(SEEN_KEY);
          const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
          const last = Number(seen[first.id] || 0);
          const weekMs = 7 * 24 * 60 * 60 * 1000;
          if (last && Date.now() - last < weekMs) return;
        } catch {
          /* ignore */
        }
        setPopup(first);
      })
      .catch(() => undefined);
  }, [lang]);

  if (!popup) return null;

  function dismiss() {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      seen[popup!.id] = Date.now();
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      /* ignore */
    }
    setPopup(null);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg overflow-hidden">
        {popup.image_url && <img src={popup.image_url} alt="" className="w-full h-40 object-cover" />}
        <div className="p-5 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">{popup.title}</h3>
          {popup.description && <p className="text-sm text-muted-foreground">{popup.description}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={dismiss}>
              Close
            </Button>
            {popup.cta_url && (
              <Button
                className="bg-primary"
                onClick={() => {
                  dismiss();
                  window.location.href = popup.cta_url!;
                }}
              >
                {popup.cta_label || "View"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
