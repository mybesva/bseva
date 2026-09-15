export type PackageTier = "basic" | "standard" | "premium";

export type ServicePujariConfig = {
  pujaris_required?: number | null;
  priests_min?: number | null;
  basic_pujaris_required?: number | null;
  standard_pujaris_required?: number | null;
  premium_pujaris_required?: number | null;
  package_pujaris?: Partial<Record<PackageTier, number>>;
};

function clamp(n: number) {
  return Math.min(20, Math.max(1, Math.round(n)));
}

export function pujarisForPackage(service: ServicePujariConfig | null | undefined, tier: PackageTier): number {
  if (!service) return 1;
  const fromMap = service.package_pujaris?.[tier];
  if (fromMap != null && fromMap >= 1) return clamp(fromMap);
  const col =
    tier === "basic"
      ? service.basic_pujaris_required
      : tier === "premium"
        ? service.premium_pujaris_required
        : service.standard_pujaris_required;
  if (col != null && col >= 1) return clamp(col);
  const fallback = service.pujaris_required ?? service.priests_min ?? 1;
  return clamp(Number(fallback) || 1);
}

export function pujarisIncludedLabel(count: number) {
  const n = clamp(count);
  return n === 1 ? "1 Pujari" : `${n} Pujaris`;
}

export function pujarisIncludedShort(count: number) {
  return `Pujaris included: ${pujarisIncludedLabel(count)}`;
}

export function pujariTeamAcceptNotice(total: number) {
  const n = clamp(total);
  if (n <= 1) return null;
  const add = n - 1;
  return `This booking requires ${n} Pujaris. You need to bring ${add} additional Pujari${add === 1 ? "" : "s"} with you.`;
}

export function pujariTeamPaymentNotice(total: number) {
  if (clamp(total) <= 1) return null;
  return "The full Dakshina is paid to you as the assigned Pujari. Bring your team and distribute payment among them.";
}
