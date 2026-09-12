/** Canonical pujari specializations (master list). Keep spellings stable to avoid duplicates. */
export const PUJARI_SPECIALIZATIONS = [
  "Satyanarayan Puja",
  "Gruha Pravesam",
  "Wedding",
  "Brahmana Wedding",
  "Homalu",
  "Vastu Shanti",
  "Namkaran",
  "Upanayanam",
  "Santhulu",
  "Pitru Karma",
  "Alankaram",
] as const;

export type PujariSpecialization = (typeof PUJARI_SPECIALIZATIONS)[number];

/** Normalize for duplicate detection (case/spacing/synonyms). */
const SYNONYMS: Record<string, string> = {
  "griha pravesh": "Gruha Pravesam",
  "gruha pravesham": "Gruha Pravesam",
  "griha pravesham": "Gruha Pravesam",
  havan: "Homalu",
  homa: "Homalu",
  homam: "Homalu",
};

export function specializationKey(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mergeSpecializations(existing: string[], extra: string[] = []) {
  const map = new Map<string, string>();
  for (const s of [...PUJARI_SPECIALIZATIONS, ...existing, ...extra]) {
    let label = s.trim();
    if (!label) continue;
    const syn = SYNONYMS[specializationKey(label)];
    if (syn) label = syn;
    const k = specializationKey(label);
    if (!map.has(k)) map.set(k, label);
  }
  return Array.from(map.values());
}
