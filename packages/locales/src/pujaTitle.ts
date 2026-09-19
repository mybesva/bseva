/** Sacred marks used only in UI. Never persist these on stored puja names. */
export const PUJA_OM = "ॐ";
export const PUJA_SWASTIKA = "卐";

const LEADING_MARKS = /^[\sॐ🕉卐卍]+/u;
const TRAILING_MARKS = /[\sॐ🕉卐卍]+$/u;

export function stripPujaTitleMarks(name: string | null | undefined): string {
  return String(name || "")
    .replace(LEADING_MARKS, "")
    .replace(TRAILING_MARKS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPujaTitleText(name: string | null | undefined): string {
  const clean = stripPujaTitleMarks(name);
  if (!clean) return "";
  return `${PUJA_OM} ${clean} ${PUJA_SWASTIKA}`;
}
