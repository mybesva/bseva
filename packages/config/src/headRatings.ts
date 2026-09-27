import { formatIndianPhone } from "./adminQa";

export type HeadRatingPujari = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type HeadRatingRecord = {
  id?: string;
  pujari_id?: string;
  pujari_name?: string;
  stars?: number | string;
  comments?: string;
  created_at?: string;
};

export type HeadRatingSort = "newest" | "oldest";

export function headRatingPujariSubtitle(p: HeadRatingPujari): string {
  const parts: string[] = [];
  if (p.email?.trim()) parts.push(p.email.trim());
  const phone = formatIndianPhone(p.phone);
  if (phone && phone !== "—") parts.push(phone);
  return parts.join(" • ");
}

export function filterHeadRatingPujaris(pujaris: HeadRatingPujari[], query: string): HeadRatingPujari[] {
  const q = query.trim().toLowerCase();
  if (!q) return pujaris;
  return pujaris.filter((p) => {
    const hay = [p.name, p.email, p.phone, p.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function resolveHeadRatingPujariName(
  pujariId: string | undefined | null,
  pujaris: HeadRatingPujari[],
  fallbackName?: string | null,
): string {
  if (fallbackName?.trim()) return fallbackName.trim();
  if (!pujariId) return "Unknown Pujari";
  const match = pujaris.find((p) => p.id === pujariId);
  if (match?.name) return match.name;
  return "Unknown Pujari";
}

export function validateHeadRatingSubmission(input: {
  pujariId: string;
  manualId?: string;
  stars: number;
  comments: string;
}): { ok: true; targetId: string } | { ok: false; message: string; field?: "pujari" | "stars" | "comments" } {
  const target = (input.pujariId || input.manualId || "").trim();
  if (!target) {
    return { ok: false, field: "pujari", message: "Select a pujari or enter their UUID / email / phone" };
  }
  const stars = Math.round(input.stars);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { ok: false, field: "stars", message: "Rating must be between 1 and 5 stars" };
  }
  const comments = input.comments.trim();
  if (comments.length < 5) {
    return { ok: false, field: "comments", message: "Comment is required." };
  }
  return { ok: true, targetId: target };
}

export function filterHeadRatingHistory(
  rows: HeadRatingRecord[],
  opts: { search: string; starsFilter: number | "all"; sort: HeadRatingSort },
  pujaris: HeadRatingPujari[],
): HeadRatingRecord[] {
  let list = [...rows];
  const q = opts.search.trim().toLowerCase();
  if (q) {
    list = list.filter((r) => {
      const name = resolveHeadRatingPujariName(r.pujari_id, pujaris, r.pujari_name);
      const hay = [name, r.pujari_id, r.comments, String(r.stars)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  if (opts.starsFilter !== "all") {
    list = list.filter((r) => Number(r.stars) === opts.starsFilter);
  }
  list.sort((a, b) => {
    const ta = new Date(String(a.created_at || 0)).getTime();
    const tb = new Date(String(b.created_at || 0)).getTime();
    return opts.sort === "newest" ? tb - ta : ta - tb;
  });
  return list;
}

export function clampHeadRatingStars(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value)));
}
