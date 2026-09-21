/** Hide leftover demo/mock wording on customer and pujari wallet history. */
export function publicWalletDescription(raw?: string | null, fallback = "Wallet transaction"): string {
  const s = String(raw || "").trim();
  if (!s) return fallback;
  return (
    s
      .replace(/\s*\((?:demo|mock)[^)]*\)/gi, "")
      .replace(/\b(?:demo|mock)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–]+|[\s\-–]+$/g, "")
      .trim() || fallback
  );
}
