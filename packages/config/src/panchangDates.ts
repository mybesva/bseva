/** Shared ISO date helpers for Panchangam (local calendar day, no UTC shift). */

export const DEFAULT_PANCHANG_CALENDAR = "lunar" as const;

export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysToIsoDate(iso: string, delta: number): string {
  const d = parseIsoDateLocal(iso);
  d.setDate(d.getDate() + delta);
  return todayIsoDate(d);
}

export function isSameIsoDate(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function isTodayIsoDate(iso: string, now: Date = new Date()): boolean {
  return isSameIsoDate(iso, todayIsoDate(now));
}
