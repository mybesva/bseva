export const PREFERRED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "te", label: "Telugu" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "ta", label: "Tamil" },
  { code: "kn", label: "Kannada" },
] as const;

export type PreferredLang = (typeof PREFERRED_LANGUAGES)[number]["code"];

const PREFERRED_CODES = new Set<string>(PREFERRED_LANGUAGES.map((l) => l.code));

export function isPreferredLang(code: string | null | undefined): code is PreferredLang {
  return !!code && PREFERRED_CODES.has(code);
}

export function preferredLangLabel(code: string | null | undefined) {
  return PREFERRED_LANGUAGES.find((l) => l.code === code)?.label || "English";
}

/** Site chrome is translated for en/hi/te only; other preferences still save. */
export function uiLangFromPreferred(code: string | null | undefined): "en" | "hi" | "te" {
  if (code === "hi" || code === "te") return code;
  return "en";
}
