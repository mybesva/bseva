import { useEffect, useState } from "react";
import { api, mediaSrc } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

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
  const { t } = useI18n();
  const card = (
    <div
      className={
        preview
          ? "w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card"
          : "w-[min(84vw,340px)] snap-start rounded-xl border border-border overflow-hidden bg-card shrink-0 shadow-sm"
      }
    >
      {banner.image_url ? (
        <div className="aspect-[16/7] w-full overflow-hidden bg-muted flex items-center justify-center">
          <img
            src={mediaSrc(banner.image_url)}
            alt={banner.title || t("web.promo.imageAlt")}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="aspect-[16/7] w-full bg-primary/10" />
      )}
      <div className="p-3 space-y-1">
        <div className="font-medium text-sm text-foreground line-clamp-2">{banner.title || t("web.promo.untitled")}</div>
        {banner.subtitle ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{banner.subtitle}</p>
        ) : null}
        {banner.is_third_party && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("web.promo.sponsored")}</span>
        )}
      </div>
    </div>
  );
  if (!preview && banner.target_url) {
    return (
      <a href={banner.target_url} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label={banner.title}>
        {card}
      </a>
    );
  }
  return <div className="shrink-0">{card}</div>;
}

/** Horizontally scrollable post-login promo banners (req #89 / #104). */
export default function PromoBannerCarousel() {
  const { t } = useI18n();
  const [banners, setBanners] = useState<PromoBannerCardData[]>([]);

  useEffect(() => {
    api<PromoBannerCardData[]>("/promos/banners?placement=post_login")
      .then(setBanners)
      .catch(() => setBanners([]));
  }, []);

  if (!banners.length) return null;

  return (
    <div className="mb-6">
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" aria-label={t("web.promo.promotions")}>
        {banners.map((b) => (
          <PromoBannerCard key={b.id} banner={b} />
        ))}
      </div>
    </div>
  );
}
