export type PersonNameParts = {
  first_name: string;
  middle_name: string;
  last_name: string;
};

export function splitDisplayName(full: string | null | undefined): PersonNameParts {
  const s = (full || "").trim();
  if (!s) return { first_name: "", middle_name: "", last_name: "" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0], middle_name: "", last_name: "" };
  if (parts.length === 2) return { first_name: parts[0], middle_name: "", last_name: parts[1] };
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

export function composeDisplayName(parts: PersonNameParts): string {
  return [parts.first_name, parts.middle_name, parts.last_name].map((p) => p.trim()).filter(Boolean).join(" ");
}

export function validatePersonNameParts(parts: PersonNameParts): Record<string, string> {
  const errors: Record<string, string> = {};
  const first = parts.first_name.trim();
  const last = parts.last_name.trim();
  if (first.length < 3) errors.first_name = "First name must be at least 3 characters";
  if (!last) errors.last_name = "Last name is required";
  return errors;
}
