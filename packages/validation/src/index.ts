import { z } from "zod";

export function passwordStrengthOk(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function isMeaningfulText(raw: string, minLen: number): boolean {
  const s = String(raw || "").trim();
  if (s.length < minLen) return false;
  const alnum = (s.match(/[A-Za-z0-9]/g) || []).length;
  return alnum >= Math.max(1, Math.floor(minLen / 2));
}

/** Reject numeric-only or symbol-only personal names; allow Unicode letters. */
export function isValidPersonNamePart(raw: string): boolean {
  const s = String(raw || "").trim();
  if (!s) return true;
  if (/^\d+$/.test(s)) return false;
  if (!/\p{L}/u.test(s)) return false;
  return true;
}

export function isValidPincode(raw: string): boolean {
  return /^\d{6}$/.test(String(raw || "").trim());
}

export function isValidIfsc(raw: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(raw || "").trim().toUpperCase());
}

const UPI_ID_RE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z0-9][a-z0-9.-]{1,63}$/i;

export function isValidUpiId(raw: string) {
  const s = (raw || "").trim().toLowerCase();
  return s.length > 0 && s.length <= 256 && UPI_ID_RE.test(s);
}

export const loginSchema = z.object({
  identifier: z.string().min(3, "validation.identifier"),
  password: z.string().min(1, "validation.passwordRequired"),
});

export const registerSchema = z
  .object({
    account_type: z.enum(["customer", "pujari"]),
    name: z.string().min(2, "validation.name").max(120),
    first_name: z.string().max(80).optional(),
    middle_name: z.string().max(80).optional(),
    last_name: z.string().max(80).optional(),
    email: z.string().email("validation.email"),
    phone: z.string().min(10, "validation.phone").max(16),
    password: z.string().min(8, "validation.password"),
    confirmPassword: z.string().min(1, "validation.confirmPassword"),
    otp: z.string().min(4, "validation.otp").max(8),
    language: z.enum(["en", "hi", "te", "mr", "ta", "kn", "ml"]).default("en"),
    calendar_preference: z
      .enum(["lunar", "solar", "north", "south"])
      .default("solar")
      .transform((v) => (v === "lunar" ? "lunar" : "solar")),
    registration_consent: z.boolean(),
    referral_code: z.string().max(40).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "validation.passwordMatch",
    path: ["confirmPassword"],
  })
  .refine((d) => passwordStrengthOk(d.password), {
    message: "validation.password",
    path: ["password"],
  })
  .refine((d) => d.registration_consent === true, {
    message: "validation.consent",
    path: ["registration_consent"],
  })
  .refine(
    (d) =>
      d.account_type !== "pujari" ||
      (String(d.first_name || "").trim().length >= 1 && String(d.last_name || "").trim().length >= 3),
    {
      message: "validation.name",
      path: ["last_name"],
    }
  );

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "validation.currentPassword"),
    new_password: z.string().min(8, "validation.password"),
    confirm: z.string().min(1, "validation.confirmPassword"),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: "validation.passwordMatch",
    path: ["confirm"],
  })
  .refine((d) => passwordStrengthOk(d.new_password), {
    message: "validation.password",
    path: ["new_password"],
  });

export const addressSchema = z
  .object({
    address_line1: z.string().min(3, "validation.address"),
    address_line2: z.string().optional(),
    city: z.string().min(2, "validation.city"),
    district: z.string().min(2, "validation.district"),
    state: z.string().min(2, "validation.state"),
    pincode: z.string().regex(/^\d{6}$/, "validation.pincode"),
    country: z.string().optional(),
    location_label: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    gstin: z.string().max(20).optional(),
  })
  .superRefine((d, ctx) => {
    if (!isMeaningfulText(d.address_line1, 3)) {
      ctx.addIssue({ code: "custom", message: "validation.address", path: ["address_line1"] });
    }
  });

export const supportSchema = z.object({
  subject: z.string().min(5, "validation.subject"),
  body: z.string().min(10, "validation.issue"),
});

export const contactSchema = z.object({
  name: z.string().min(2, "validation.name"),
  email: z.string().email("validation.email"),
  country_code: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/, "validation.phone"),
  subject: z.string().min(3, "validation.subject"),
  message: z.string().min(10, "validation.issue"),
});

export const walletLoadSchema = z.object({
  amountRupees: z.number().positive("validation.amount").max(500000),
});

export function bankDraftTouched(v: {
  holder?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
}) {
  return Boolean(
    (v.holder || "").trim() ||
      (v.bankName || "").trim() ||
      (v.ifsc || "").trim() ||
      String(v.accountNumber || "").replace(/\D/g, "")
  );
}

export function validateBank(v: {
  holder?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  accountConfirm?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMeaningfulText(v.holder || "", 2)) errors.holder = "web.validation.bankHolder";
  if (!isMeaningfulText(v.bankName || "", 2)) errors.bankName = "web.validation.bankName";
  if (!isValidIfsc(v.ifsc || "")) errors.ifsc = "web.validation.ifsc";
  const acct = String(v.accountNumber || "").replace(/\D/g, "");
  const confirm = String(v.accountConfirm || "").replace(/\D/g, "");
  if (acct.length < 9 || acct.length > 18) errors.accountNumber = "web.validation.accountNumber";
  if (confirm !== acct) errors.accountConfirm = "web.validation.accountMatch";
  return errors;
}

export function validateSettlement(v: {
  upiId?: string;
  holder?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  accountConfirm?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const upi = (v.upiId || "").trim().toLowerCase();
  const bankOn = bankDraftTouched(v);
  if (upi && !isValidUpiId(upi)) errors.upiId = "web.validation.upi";
  if (bankOn) Object.assign(errors, validateBank(v));
  if (!upi && !bankOn) {
    errors.settlement = "web.validation.settlement";
    return errors;
  }
  return errors;
}

export function hasSettlementMethod(v: {
  upiId?: string;
  holder?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  accountConfirm?: string;
}) {
  const upi = (v.upiId || "").trim();
  if (upi && isValidUpiId(upi)) return true;
  const acct = String(v.accountNumber || "").replace(/\D/g, "");
  const confirm = String(v.accountConfirm || "").replace(/\D/g, "");
  return (
    isMeaningfulText(v.holder || "", 2) &&
    isMeaningfulText(v.bankName || "", 2) &&
    isValidIfsc(v.ifsc || "") &&
    acct.length >= 9 &&
    acct.length <= 18 &&
    confirm === acct
  );
}

export function settlementPayload(v: {
  upiId?: string;
  holder?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  accountConfirm?: string;
}): Record<string, string> {
  const payload: Record<string, string> = {};
  const upi = (v.upiId || "").trim().toLowerCase();
  const digits = String(v.accountNumber || "").replace(/\D/g, "");
  const bankComplete =
    (v.holder || "").trim() &&
    (v.bankName || "").trim() &&
    (v.ifsc || "").trim() &&
    digits.length >= 9 &&
    String(v.accountConfirm || "").replace(/\D/g, "") === digits;
  if (upi) payload.upi_id = upi;
  if (bankComplete) {
    payload.bank_holder_name = String(v.holder).trim();
    payload.bank_name = String(v.bankName).trim();
    payload.bank_ifsc = String(v.ifsc).trim().toUpperCase();
    payload.bank_account_number = digits;
    payload.bank_account_confirm = digits;
    payload.bank_account_last4 = digits.slice(-4);
  }
  return payload;
}

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

/** Returns i18n keys for invalid fields (matches web customer profile rules). */
export function validatePersonNameParts(
  parts: PersonNameParts,
  opts?: { minLastLength?: number },
): Partial<Record<keyof PersonNameParts, string>> {
  const errors: Partial<Record<keyof PersonNameParts, string>> = {};
  const minLast = opts?.minLastLength ?? 1;
  const first = parts.first_name.trim();
  const middle = parts.middle_name.trim();
  const last = parts.last_name.trim();
  if (first.length < 3) errors.first_name = "validation.firstNameMin";
  else if (!isValidPersonNamePart(first)) errors.first_name = "validation.nameLetters";
  if (middle && !isValidPersonNamePart(middle)) errors.middle_name = "validation.nameLetters";
  if (last && !isValidPersonNamePart(last)) errors.last_name = "validation.nameLetters";
  if (last.length < minLast) {
    errors.last_name = last.length === 0 ? "validation.lastNameRequired" : "validation.lastNameMin";
  }
  return errors;
}

export function parsePhoneParts(raw: string | null | undefined): { countryCode: string; national: string } {
  const s = String(raw || "").trim();
  if (!s) return { countryCode: "+91", national: "" };

  const known = ["+91", "+1", "+44", "+971", "+65", "+61", "+49", "+33", "+81", "+86"].sort(
    (a, b) => b.length - a.length,
  );
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
  if (digits.length >= 12 && digits.startsWith("91")) {
    return { countryCode: "+91", national: digits.slice(-10) };
  }
  return { countryCode: "+91", national: digits.slice(0, 12) };
}

/** Returns i18n key or null if valid. */
export function validatePhoneNational(countryCode: string, national: string): string | null {
  const digits = String(national || "").replace(/\D/g, "");
  if (!digits) return "validation.phoneRequired";
  if (countryCode === "+91") {
    if (!/^[6-9]\d{9}$/.test(digits)) return "validation.phoneIndia";
    return null;
  }
  if (digits.length < 8 || digits.length > 12) return "validation.phoneIntl";
  return null;
}

export type AddressComparable = {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function normalizeAddressField(raw?: string | null): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function addressesMatch(a: AddressComparable, b: AddressComparable): boolean {
  const fields = ["address_line1", "address_line2", "city", "district", "state", "pincode"] as const;
  for (const field of fields) {
    if (normalizeAddressField(a[field]) !== normalizeAddressField(b[field])) return false;
  }
  if (normalizeAddressField(a.country || "india") !== normalizeAddressField(b.country || "india")) {
    return false;
  }
  const latA = a.latitude != null ? Number(a.latitude) : null;
  const latB = b.latitude != null ? Number(b.latitude) : null;
  const lngA = a.longitude != null ? Number(a.longitude) : null;
  const lngB = b.longitude != null ? Number(b.longitude) : null;
  if (latA != null && latB != null && lngA != null && lngB != null) {
    if (Math.abs(latA - latB) > 0.0001 || Math.abs(lngA - lngB) > 0.0001) return false;
  }
  return true;
}

export function formatAddressLines(parts: {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
}): string {
  return [
    parts.address_line1,
    parts.address_line2,
    parts.city,
    parts.district,
    parts.state,
    parts.pincode,
    parts.country || "India",
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
}

export const PUJARI_QUALIFICATION_YEAR_MIN = 1950;
export const PUJARI_EXPERIENCE_MAX = 80;

/** Whole years between an ISO date of birth (YYYY-MM-DD) and today, or null when it is not a real date. */
export function ageFromDob(iso: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "").trim());
  if (!m) return null;
  const dob = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dob.getTime()) || dob.getMonth() !== Number(m[2]) - 1) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isValidPujariDob(iso: string, minAge = 18, today: Date = new Date()): boolean {
  const age = ageFromDob(iso, today);
  return age != null && age >= minAge && age <= 100;
}

/** Returns an i18n key, or undefined when the year is fine. */
export function validateQualificationYear(raw: unknown, yearNow = new Date().getFullYear()): string | undefined {
  if (raw === "" || raw == null) return "web.validation.qualificationYear";
  const y = Number(raw);
  if (!Number.isFinite(y) || !Number.isInteger(y)) return "web.validation.validYear";
  if (y < PUJARI_QUALIFICATION_YEAR_MIN) return "web.validation.yearMinimum";
  if (y > yearNow) return "web.validation.yearFuture";
  return undefined;
}

/** Returns an i18n key, or undefined when the number of years is fine. */
export function validateExperienceYears(raw: unknown): string | undefined {
  if (raw === "" || raw == null || (typeof raw === "string" && !raw.trim())) return "web.validation.experienceRequired";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "web.validation.experienceNumber";
  if (n < 0) return "web.validation.experienceNegative";
  if (n > PUJARI_EXPERIENCE_MAX) return "web.validation.experienceMaximum";
  return undefined;
}

type PujariStepProfile = Record<string, unknown>;

/**
 * Required-field checks for one step of the pujari onboarding (same rules as the web).
 * Returns { field: i18nKey } for every problem; empty means the step can be saved.
 * Step 1 profile, 2 address, 3 professional, 4 documents, 5 services + payout, 6 review.
 */
export function validatePujariOnboardingStep(
  step: number,
  profile: PujariStepProfile,
  ctx: {
    hasPhoto?: boolean;
    documentTypes?: string[];
    appliedServices?: number;
    consent?: boolean;
    today?: Date;
  } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  const text = (key: string) => String(profile[key] ?? "").trim();

  if (step === 1) {
    if (!ctx.hasPhoto && !text("profile_photo_path")) errors.profile_photo_path = "web.validation.profilePhoto";
    // Same as the web profile form: first and last name (3+ letters each), optional middle name.
    const hasParts = ["first_name", "middle_name", "last_name"].some((k) => profile[k] != null);
    const name = hasParts
      ? { first_name: text("first_name"), middle_name: text("middle_name"), last_name: text("last_name") }
      : splitDisplayName(text("full_name"));
    const nameErrors = validatePersonNameParts(name, { minLastLength: 3 });
    if (nameErrors.first_name) errors.first_name = nameErrors.first_name;
    if (nameErrors.middle_name) errors.middle_name = nameErrors.middle_name;
    if (nameErrors.last_name) {
      errors.last_name = nameErrors.last_name === "validation.lastNameMin" ? "validation.pujariLastNameMin" : nameErrors.last_name;
    }
    const dob = text("date_of_birth").slice(0, 10);
    if (!dob) errors.date_of_birth = "web.validation.dob";
    else if (!isValidPujariDob(dob, 18, ctx.today)) errors.date_of_birth = "web.validation.adult";
    const phone = parsePhoneParts(text("mobile_number"));
    const phoneError = validatePhoneNational(phone.countryCode, phone.national);
    if (phoneError) errors.mobile_number = phoneError;
    if (!text("gotra")) errors.gotra = "web.validation.gotra";
    if (!text("pravara")) errors.pravara = "web.validation.pravara";
  }

  if (step === 2) {
    const parsed = addressSchema.safeParse({
      address_line1: text("address_line1"),
      city: text("city"),
      district: text("district"),
      state: text("state"),
      pincode: text("pincode"),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || "address_line1");
        if (!errors[key]) errors[key] = issue.message;
      }
    }
    if (profile.latitude == null || profile.longitude == null) errors.latitude = "web.validation.mapPin";
  }

  if (step === 1 || step === 3) {
    const expError = validateExperienceYears(profile.experience_years);
    if (expError) errors.experience_years = expError;
    const quals = Array.isArray(profile.qualifications) ? profile.qualifications : [];
    // Qualifications are optional; the year is only needed once one is ticked.
    if (quals.length > 0) {
      const yearError = validateQualificationYear(profile.qualification_year, (ctx.today || new Date()).getFullYear());
      if (yearError) errors.qualification_year = yearError;
    }
    if (!text("sampradaya")) errors.sampradaya = "web.validation.sampradaya";
    const langs = Array.isArray(profile.languages) ? profile.languages : [];
    if (!langs.length) errors.languages = "web.validation.languages";
  }

  if (step === 4) {
    const docs = ctx.documentTypes || [];
    if (!docs.includes("identity")) errors.identity = "web.validation.aadhaar";
    const licence = text("licence_type").toLowerCase();
    if ((licence === "driving_licence" || licence === "cab_commercial") && !docs.includes("driving_licence")) {
      errors.driving_licence = "web.validation.drivingLicence";
    }
  }

  if (step === 5) {
    if (!ctx.appliedServices) errors.services = "web.validation.services";
    const radius = Number(profile.service_radius_km);
    if (!Number.isFinite(radius) || radius <= 0) errors.service_radius_km = "web.validation.serviceRadius";
  }

  if (step === 6 && !ctx.consent) errors.consent = "web.validation.finalConsent";

  return errors;
}

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
