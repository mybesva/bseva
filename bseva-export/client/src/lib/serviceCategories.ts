/** Category slugs used for death / ancestor rituals — no Alankaram on booking. */
const DEATH_SLUGS = new Set([
  "death-ancestor",
  "death",
  "death_anniversary",
  "antyeshti",
  "shraddha-death-anniversary",
]);

export function isDeathRelatedService(categories?: { slug?: string }[] | null): boolean {
  return (categories || []).some((c) => {
    const slug = (c.slug || "").toLowerCase();
    return DEATH_SLUGS.has(slug) || slug.includes("death") || slug.includes("shraddha");
  });
}
