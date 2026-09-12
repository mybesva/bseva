import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Banner = {
  id: string;
  title: string;
  image_url?: string | null;
  target_url?: string | null;
  is_third_party?: boolean;
};

/** Horizontally scrollable post-login promo banners (req #89 / #104). */
export default function PromoBannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    api<Banner[]>("/promos/banners?placement=post_login")
      .then(setBanners)
      .catch(() => setBanners([]));
  }, []);

  if (!banners.length) return null;

  return (
    <div className="mb-6">
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {banners.map((b) => {
          const card = (
            <div className="min-w-[260px] max-w-[320px] snap-start rounded-lg border border-border overflow-hidden bg-card shrink-0">
              {b.image_url ? (
                <img src={b.image_url} alt="" className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 w-full bg-primary/10" />
              )}
              <div className="p-3 space-y-1">
                <div className="font-medium text-sm text-foreground line-clamp-2">{b.title}</div>
                {b.is_third_party && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sponsored</span>
                )}
              </div>
            </div>
          );
          if (b.target_url) {
            return (
              <a key={b.id} href={b.target_url} target="_blank" rel="noreferrer" className="shrink-0">
                {card}
              </a>
            );
          }
          return (
            <div key={b.id} className="shrink-0">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
