
export const LEGAL_VERSION = "1.1";
export const EFFECTIVE_DATE = "4 November 2026";

export const COMPANY = "B-SEVA PRIVATE LIMITED";
export const ADDRESS =
  "Divyasree Holdings Pvt Ltd, Plot No. 5 & 43, HITEC City Layout, Madhapur, Shaikpet, Hyderabad – 500081, Telangana, India";
export const REGISTERED_OFFICE = ADDRESS;
export const GSTIN = "36AAPCB2396C1ZK";
export const PHONE = "+91 90146 54994";
export const SUPPORT_EMAIL = "support@b-seva.com";
export const PARTNER_EMAIL = "partners@b-seva.com";
export const GRIEVANCE_EMAIL = SUPPORT_EMAIL;
export const GRIEVANCE_OFFICER_NAME = "Pavan Kumar Kulkarni";
export const DATA_PROTECTION_CONTACT = `${GRIEVANCE_OFFICER_NAME}, ${SUPPORT_EMAIL}`;
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

