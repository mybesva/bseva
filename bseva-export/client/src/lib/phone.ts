/** Shared phone country codes + E.164 helpers (registration / profile / onboarding). */

export const PHONE_COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
] as const;

export type PhoneCountryCode = (typeof PHONE_COUNTRY_CODES)[number]["code"];

export function toE164(countryCode: string, national: string): string {
  const digits = String(national || "").replace(/\D/g, "");
  const cc = (countryCode || "+91").trim() || "+91";
  return `${cc}${digits}`;
}

/** Split a stored phone (+91… / 10-digit / bare digits) into country code + national number. */
export function parsePhoneParts(raw: string | null | undefined): { countryCode: string; national: string } {
  const s = String(raw || "").trim();
  if (!s) return { countryCode: "+91", national: "" };

  const known = PHONE_COUNTRY_CODES.map((c) => c.code).sort((a, b) => b.length - a.length);
  const compact = s.replace(/\s/g, "");
  if (compact.startsWith("+")) {
    for (const cc of known) {
      if (compact.startsWith(cc)) {
        return { countryCode: cc, national: compact.slice(cc.length).replace(/\D/g, "") };
      }
    }
    const digits = compact.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length >= 12) {
      return { countryCode: "+91", national: digits.slice(-10) };
    }
    return { countryCode: "+91", national: digits.slice(-10) };
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return { countryCode: "+91", national: digits };
  if (digits.length === 12 && digits.startsWith("91")) {
    return { countryCode: "+91", national: digits.slice(-10) };
  }
  if (digits.length > 10 && digits.startsWith("91")) {
    return { countryCode: "+91", national: digits.slice(-10) };
  }
  return { countryCode: "+91", national: digits.slice(0, 12) };
}

export function nationalMaxLen(countryCode: string): number {
  return countryCode === "+91" ? 10 : 12;
}

/** Returns error message or null if valid. */
export function validatePhoneNational(countryCode: string, national: string): string | null {
  const digits = String(national || "").replace(/\D/g, "");
  if (!digits) return "Mobile number is required";
  if (countryCode === "+91") {
    if (!/^[6-9]\d{9}$/.test(digits)) return "Enter a valid 10-digit Indian mobile number";
    return null;
  }
  if (digits.length < 8 || digits.length > 12) return "Enter a valid phone number (8–12 digits)";
  return null;
}
