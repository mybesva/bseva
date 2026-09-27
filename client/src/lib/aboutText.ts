/** Approved Vision, Mission, and Brand Essence — mirrors packages/locales/src/aboutContent.ts */
const ABOUT_APPROVED = {
  visionTitle: "Our Vision",
  visionStatement:
    "To become the most trusted digital platform connecting devotees with authentic spiritual services, making devotion accessible, seamless, and meaningful for everyone.",
  missionTitle: "Our Mission",
  missionStatement:
    "B-SEVA makes it simple for people to access meaningful spiritual and service-oriented experiences, nurturing belief, enabling acts of devotion, and spreading blessings through trustworthy, accessible, and heartfelt service.",
  brandEssenceTitle: "Our Brand Essence",
  brandEssenceBook: "Book",
  brandEssenceBelieve: "Believe",
  brandEssenceBless: "Bless",
  brandEssenceWithEase: " with Ease.",
  brandEssenceWithFaith: " with Faith.",
  brandEssenceThroughSeva: " through Seva.",
} as const;

type AboutApprovedField = keyof typeof ABOUT_APPROVED;

const ABOUT_APPROVED_I18N_KEYS: Record<AboutApprovedField, string> = {
  visionTitle: "about.visionTitle",
  visionStatement: "about.visionStatement",
  missionTitle: "about.missionTitle",
  missionStatement: "about.missionStatement",
  brandEssenceTitle: "about.brandEssenceTitle",
  brandEssenceBook: "about.brandEssenceBook",
  brandEssenceBelieve: "about.brandEssenceBelieve",
  brandEssenceBless: "about.brandEssenceBless",
  brandEssenceWithEase: "about.brandEssenceWithEase",
  brandEssenceWithFaith: "about.brandEssenceWithFaith",
  brandEssenceThroughSeva: "about.brandEssenceThroughSeva",
};

export function aboutText(t: (key: string) => string, field: AboutApprovedField): string {
  const key = ABOUT_APPROVED_I18N_KEYS[field];
  const translated = t(key);
  if (!translated || translated === key) return ABOUT_APPROVED[field];
  return translated;
}
