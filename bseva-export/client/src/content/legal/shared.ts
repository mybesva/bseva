import type { LegalDoc } from "./types";

/** Placeholder for a fact the company or counsel has not confirmed yet. */
export const toConfirm = (what: string): string => `{{TO_CONFIRM: ${what}}}`;

export const LEGAL_VERSION = "1.1-draft";
export const EFFECTIVE_DATE = toConfirm("effective date");

export const COMPANY = "B-SEVA PRIVATE LIMITED";
export const CIN = toConfirm("CIN");
export const ADDRESS =
  "Divyasree Holdings Pvt Ltd, Plot No. 5 & 43, HITEC City Layout, Madhapur, Shaikpet, Hyderabad – 500081, Telangana, India";
/** The draft address begins with another company's name, so it must be checked against the MCA record. */
export const REGISTERED_OFFICE = `${ADDRESS} ${toConfirm("registered office as per MCA record")}`;
export const GSTIN = "36AAPCB2396C1ZK";
export const PHONE = "+91 90146 54994";
export const SUPPORT_EMAIL = "support@b-seva.com";
export const PARTNER_EMAIL = "partners@b-seva.com";
export const GRIEVANCE_EMAIL = "grievance@b-seva.com";
export const GRIEVANCE_OFFICER_NAME = toConfirm("Grievance Officer name");
export const DATA_PROTECTION_CONTACT = toConfirm("data protection contact");
export const WEBSITE = "https://www.b-seva.com";
export const DELETE_ACCOUNT_URL = "https://www.b-seva.com/delete-account";
export const WORKING_HOURS = "Monday to Saturday, 10:00 AM – 6:00 PM IST";

/** Grievance Officer contact table used by every document. */
export function grievanceTable(opts: { nameLabel?: string; designation?: boolean; workingHours?: boolean } = {}): string[][] {
  const rows: string[][] = [["Detail", "Information"], [opts.nameLabel ?? "Name", GRIEVANCE_OFFICER_NAME]];
  if (opts.designation !== false) rows.push(["Designation", "Grievance Officer"]);
  rows.push(["Company", COMPANY], ["Address", REGISTERED_OFFICE], ["Email", GRIEVANCE_EMAIL], ["Phone", PHONE]);
  if (opts.workingHours !== false) rows.push(["Working hours", WORKING_HOURS]);
  return rows;
}

const PLACEHOLDER = /\{\{TO_CONFIRM: [^}]+\}\}/g;

/** Fills `toConfirm` with every placeholder used anywhere in the document, so the list can never drift. */
export function withToConfirm(doc: Omit<LegalDoc, "toConfirm">): LegalDoc {
  const found = JSON.stringify(doc).match(PLACEHOLDER) ?? [];
  return { ...doc, toConfirm: Array.from(new Set(found)) };
}
