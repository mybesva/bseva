/** Shared Customer Dashboard hero helpers — Web is source of truth; Mobile mirrors these rules. */

export function customerGreetingName(fullName: string | null | undefined, fallback: string) {
  const trimmed = String(fullName || "").trim();
  return trimmed || fallback;
}

export function namasteParts(template: string) {
  const idx = template.indexOf("🙏");
  if (idx < 0) return { before: template, after: "" };
  return {
    before: template.slice(0, idx),
    after: template.slice(idx + "🙏".length).replace(/^\s+/, ""),
  };
}

/** CSS clamp equivalent used by the Web hero heading. */
export function customerHeroHeadingClamp(name: string): string {
  const n = name.trim().length;
  if (n > 28) return "clamp(1rem, 0.65rem + 1.45vw, 1.5rem)";
  if (n > 16) return "clamp(1.08rem, 0.72rem + 1.6vw, 1.85rem)";
  return "clamp(1.15rem, 0.8rem + 1.8vw, 2.25rem)";
}

/** React Native font size equivalent of `customerHeroHeadingClamp`. */
export function customerHeroHeadingFontSize(name: string, width: number): number {
  const n = name.trim().length;
  const vw = width / 100;
  if (n > 28) return Math.min(24, Math.max(16, 16 + vw * 1.45));
  if (n > 16) return Math.min(30, Math.max(17, 17.28 + vw * 1.6));
  return Math.min(36, Math.max(18, 18.4 + vw * 1.8));
}

export const CUSTOMER_HERO_TRUST_KEYS = [
  "customer.hero.trust.rituals",
  "customer.hero.trust.pujaris",
  "customer.hero.trust.services",
  "customer.hero.trust.wellness",
] as const;
