/**
 * Shape of a legal document rendered on the website legal pages
 * (/privacy-policy, /customer-terms, /pujari-terms, /app-terms, /refund-policy).
 * Matches docs/compliance/api-contract.md, section "Legal pages".
 */
export type LegalSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** First row is the header row. */
  table?: string[][];
};

export type LegalDoc = {
  slug: string;
  title: string;
  version: string;
  /** "{{TO_CONFIRM: effective date}}" until confirmed. */
  effectiveDate: string;
  intro?: string[];
  sections: LegalSection[];
  /** Every unconfirmed placeholder used in the document; shown in a banner on QA. */
  toConfirm: string[];
};
