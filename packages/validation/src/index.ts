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
  const last = parts.last_name.trim();
  if (first.length < 3) errors.first_name = "validation.firstNameMin";
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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
