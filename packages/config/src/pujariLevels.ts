/** Level 1–4 stay on the existing hierarchy. Levels 5 and 6 match only their own service. */

export const HIERARCHY_LEVEL_MAX = 4;
export const CHAVA_SEVA_LEVEL = 5;
export const PRAVACHANA_SEVA_LEVEL = 6;
export const MAX_PUJARI_LEVEL = 6;
export const CHAVA_SEVA_CODE = "chava_seva";
export const PRAVACHANA_SEVA_CODE = "pravachana_seva";

export function isSpecializedPujariLevel(level: number | null | undefined): boolean {
  const n = Number(level);
  return n === CHAVA_SEVA_LEVEL || n === PRAVACHANA_SEVA_LEVEL;
}

/** Same clamp as before for Levels 1–4. Levels 5 and 6 pass through. */
export function clampServiceRequiredLevel(level: number): number {
  return Math.min(MAX_PUJARI_LEVEL, Math.max(1, Number(level) || 2));
}

/**
 * Level 1–4: unchanged (`approved >= 4` covers the hierarchy, otherwise `approved >= required`).
 * Level 5 / 6: exact match only, and they do not cover Levels 1–4.
 */
export function priestCoversService(approvedLevel: number | null | undefined, requiredLevel: number): boolean {
  const approved = Number(approvedLevel || 0);
  if (!approved) return false;
  if (isSpecializedPujariLevel(approved) || isSpecializedPujariLevel(requiredLevel)) {
    return approved === Number(requiredLevel);
  }
  if (approved >= 4) return true;
  return approved >= requiredLevel;
}

/** First sentence of the admin assignment dialog. Levels 1–4 keep "or above". */
export function assignmentEligibilityLead(requiredLevel: number | null | undefined): string {
  if (requiredLevel === CHAVA_SEVA_LEVEL || requiredLevel === PRAVACHANA_SEVA_LEVEL) {
    return `Only Level ${requiredLevel} providers.`;
  }
  return `Level ${requiredLevel} or above.`;
}

/** Mobile role list: Level 1–4 "already held" stays numeric. Specialized roles match exactly. */
export function pujariAlreadyHoldsRole(approvedLevel: number, roleLevel: number): boolean {
  if (isSpecializedPujariLevel(approvedLevel) || isSpecializedPujariLevel(roleLevel)) {
    return approvedLevel === roleLevel;
  }
  return roleLevel <= approvedLevel;
}

export function pujariCanSelectRole(approvedLevel: number, roleLevel: number): boolean {
  if (isSpecializedPujariLevel(roleLevel)) return roleLevel !== approvedLevel;
  if (isSpecializedPujariLevel(approvedLevel)) return false;
  return roleLevel > approvedLevel;
}
