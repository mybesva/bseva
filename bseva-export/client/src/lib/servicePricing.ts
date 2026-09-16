import { formatCurrencyPaise, translate, type Lang } from "@bseva/locales";

/** Lowest bookable package price (Standard vs Premium only — no Basic). */
export function startingPricePaise(service: {
  standard_price_paise?: number | null;
  premium_price_paise?: number | null;
}): number | null {
  const candidates = [service.standard_price_paise, service.premium_price_paise].filter(
    (x): x is number => x != null && Number(x) > 0
  );
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

export function formatStartingFrom(service: {
  standard_price_paise?: number | null;
  premium_price_paise?: number | null;
  bookable?: boolean;
}, lang: Lang | string = "en"): string | null {
  if (service.bookable === false) return null;
  const paise = startingPricePaise(service);
  if (paise == null) return null;
  return translate(lang, "services.startingFromPrice", {
    price: formatCurrencyPaise(paise, lang),
  });
}
