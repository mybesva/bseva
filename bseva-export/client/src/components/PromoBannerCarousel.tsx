import { useEffect, useState } from "react";
import { api, mediaSrc } from "@/lib/api";

export type PromoBannerCardData = {
  id?: string;
  title: string;
  subtitle?: string | null;
  image_url?: string | null;
  target_url?: string | null;
  is_third_party?: boolean;
};

export function PromoBannerCard({
  banner,
  preview = false,
}: {
  banner: PromoBannerCardData;
  preview?: boolean;
}) {
  const card = (
    <div className="min-w-[260px] max-w-[320px] w-[280px] snap-start rounded-lg border border-border overflow-hidden bg-card shrink-0">
      {banner.image_url ? (
        <img src={mediaSrc(banner.image_url)} alt="" className="h-28 w-full object-cover" />
      ) : (
        <div className="h-28 w-full bg-primary/10" />
      )}
      <div className="p-3 space-y-1">
        <div className="font-medium text-sm text-foreground line-clamp-2">{banner.title || "Untitled"}</div>
        {banner.subtitle ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{banner.subtitle}</p>
        ) : null}
        {banner.is_third_party && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sponsored</span>
        )}
      </div>
    </div>
  );
  if (!preview && banner.target_url) {
    return (
      <a href={banner.target_url} target="_blank" rel="noreferrer" className="shrink-0">
        {card}
      </a>
    );
  }
  return <div className="shrink-0">{card}</div>;
}

/** Horizontally scrollable post-login promo banners (req #89 / #104). */
export default function PromoBannerCarousel() {
  const [banners, setBanners] = useState<PromoBannerCardData[]>([]);

  useEffect(() => {
    api<PromoBannerCardData[]>("/promos/banners?placement=post_login")
      .then(setBanners)
      .catch(() => setBanners([]));
  }, []);

  if (!banners.length) return null;

  return (
    <div className="mb-6">
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {banners.map((b) => (
          <PromoBannerCard key={b.id} banner={b} />
        ))}
      </div>
    </div>
  );
}
