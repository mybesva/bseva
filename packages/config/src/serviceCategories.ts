/** Category slugs used for death / ancestor rituals — no Alankaram on booking (same as web). */
const DEATH_SLUGS = new Set([
  "death-ancestor",
  "death",
  "death_anniversary",
  "antyeshti",
  "shraddha-death-anniversary",
]);

export function isDeathRelatedService(
  categories?: { slug?: string; category?: string }[] | string | null
): boolean {
  if (typeof categories === "string") {
    const slug = categories.toLowerCase();
    return DEATH_SLUGS.has(slug) || slug.includes("death") || slug.includes("shraddha");
  }
  return (categories || []).some((c) => {
    const slug = (c.slug || c.category || "").toLowerCase();
    return DEATH_SLUGS.has(slug) || slug.includes("death") || slug.includes("shraddha");
  });
}
