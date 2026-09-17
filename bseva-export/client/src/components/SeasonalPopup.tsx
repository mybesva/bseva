import { useEffect, useState } from "react";
import { api, mediaSrc } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

export type SeasonalPopupData = {
  id?: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

const SEEN_KEY = "bseva_seasonal_popup_seen_v2";

export function SeasonalPopupCard({
  popup,
  onClose,
  preview = false,
}: {
  popup: SeasonalPopupData;
  onClose?: () => void;
  preview?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl">
      {popup.image_url ? (
        <div className="aspect-[16/9] w-full bg-muted flex items-center justify-center overflow-hidden">
          <img src={mediaSrc(popup.image_url)} alt={popup.title || t("web.promo.imageAlt")} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="aspect-[16/9] w-full bg-primary/10" />
      )}
      <div className="p-5 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{popup.title || t("web.promo.untitled")}</h3>
        {popup.description ? <p className="text-sm text-muted-foreground">{popup.description}</p> : null}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" type="button" onClick={() => onClose?.()}>
            {t("common.close")}
          </Button>
          {popup.cta_url || popup.cta_label ? (
            popup.cta_url && !preview ? (
              <Button asChild className="bg-primary">
                <a href={popup.cta_url} onClick={() => onClose?.()}>
                  {popup.cta_label || t("common.view")}
                </a>
              </Button>
            ) : (
              <Button className="bg-primary" type="button">
                {popup.cta_label || t("common.view")}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Shows at most one seasonal popup per 7 days per popup id (req #103). */
export default function SeasonalPopup() {
  const { lang } = useI18n();
  const [popup, setPopup] = useState<SeasonalPopupData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    api<SeasonalPopupData[]>(`/promos/popups?lang=${lang}`)
      .then((rows) => {
        const first = rows?.[0];
        if (!first) return;
        try {
          const raw = localStorage.getItem(SEEN_KEY);
          const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
          const last = Number(seen[first.id || ""] || 0);
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
      if (popup?.id) seen[popup.id] = Date.now();
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      /* ignore */
    }
    setPopup(null);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={popup.title}>
      <SeasonalPopupCard popup={popup} onClose={dismiss} />
    </div>
  );
}
