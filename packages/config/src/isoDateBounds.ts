/** Date input (yyyy-MM-dd) → ISO start of day UTC for APIs */
export function dateInputToIsoStart(value: string | null | undefined): string | null {
  const day = (value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `${day}T00:00:00Z`;
}

/** Date input (yyyy-MM-dd) → ISO end of day UTC for APIs */
export function dateInputToIsoEnd(value: string | null | undefined): string | null {
  const day = (value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `${day}T23:59:59Z`;
}
