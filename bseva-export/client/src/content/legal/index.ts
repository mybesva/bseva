import { appTerms } from "./app-terms";
import { customerTerms } from "./customer-terms";
import { privacyPolicy } from "./privacy-policy";
import { pujariTerms } from "./pujari-terms";
import { refundPolicy } from "./refund-policy";
import type { LegalDoc } from "./types";

export type { LegalDoc, LegalSection } from "./types";
export { appTerms, customerTerms, privacyPolicy, pujariTerms, refundPolicy };

/** Legal documents keyed by slug; the slug is also the website path (/privacy-policy, /customer-terms, ...). */
export const legalDocs: Record<string, LegalDoc> = {
  [privacyPolicy.slug]: privacyPolicy,
  [customerTerms.slug]: customerTerms,
  [pujariTerms.slug]: pujariTerms,
  [appTerms.slug]: appTerms,
  [refundPolicy.slug]: refundPolicy,
};

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return legalDocs[slug];
}
