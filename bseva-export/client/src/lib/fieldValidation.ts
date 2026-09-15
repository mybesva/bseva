/** Shared client-side validators mirroring backend/app/validation_rules.py */

import { validatePersonNameParts } from "@/lib/personName";
import { validatePhoneNational } from "@/lib/phone";

export const PUJARI_QUALIFICATION_YEAR_MIN = 1950;
export const PUJARI_EXPERIENCE_MAX = 80;

const MOBILE_RE = /^(?:\+?91[-\s]?|0)?([6-9]\d{9})$/;
const PIN_RE = /^\d{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeMobile(raw: string): string | null {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(-10);
  } else if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

export function isValidMobile(raw: string): boolean {
  return normalizeMobile(raw) != null;
}

export function ageFromDob(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

export function isValidPujariDob(iso: string, minAge = 18): boolean {
  const age = ageFromDob(iso);
  return age != null && age >= minAge && age <= 100;
}

export function isMeaningfulText(raw: string, minLen: number): boolean {
  const s = String(raw || "").trim();
  if (s.length < minLen) return false;
  const alnum = (s.match(/[A-Za-z0-9]/g) || []).length;
  return alnum >= Math.max(1, Math.floor(minLen / 2));
}

export function isValidPincode(raw: string): boolean {
  return PIN_RE.test(String(raw || "").trim());
}

export function isValidIfsc(raw: string): boolean {
  return IFSC_RE.test(String(raw || "").trim().toUpperCase());
}

export function validateAddress(v: {
  address_line1?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMeaningfulText(v.address_line1 || "", 3)) errors.address_line1 = "Enter a valid address (min 3 characters)";
  if (!isMeaningfulText(v.city || "", 2)) errors.city = "Enter a valid city";
  if (!isMeaningfulText(v.district || "", 2)) errors.district = "Enter a valid district";
  if (!isMeaningfulText(v.state || "", 2)) errors.state = "Enter a valid state";
  if (!isValidPincode(v.pincode || "")) errors.pincode = "PIN code must be exactly 6 digits";
  return errors;
}

const UPI_ID_RE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z0-9][a-z0-9.-]{1,63}$/i;

export function isValidUpiId(raw: string) {
  const s = (raw || "").trim().toLowerCase();
  return s.length > 0 && s.length <= 256 && UPI_ID_RE.test(s);
}

export function validateBank(v: {
  holder?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  accountConfirm?: string;
  last4?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMeaningfulText(v.holder || "", 2)) errors.holder = "Account holder name is required";
  if (!isMeaningfulText(v.bankName || "", 2)) errors.bankName = "Bank name is required";
  if (!isValidIfsc(v.ifsc || "")) errors.ifsc = "Enter a valid IFSC (e.g. SBIN0001234)";
  const acct = String(v.accountNumber || "").replace(/\D/g, "");
  const confirm = String(v.accountConfirm || "").replace(/\D/g, "");
  if (acct || v.accountConfirm != null || !v.last4) {
    if (acct.length < 9 || acct.length > 18) {
      errors.accountNumber = "Enter full account number (9–18 digits)";
    }
    if (confirm !== acct) {
      errors.accountConfirm = "Account number and confirmation do not match";
    }
  } else if (!/^\d{4}$/.test(String(v.last4 || "").trim())) {
    errors.last4 = "Enter exactly 4 account digits";
  }
  return errors;
}

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
      String(v.accountNumber || "").replace(/\D/g, ""),
  );
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

  if (upi && !isValidUpiId(upi)) {
    errors.upiId = "Enter a valid UPI ID (e.g. name@oksbi)";
  }

  if (bankOn) {
    Object.assign(errors, validateBank(v));
  }

  if (!upi && !bankOn) {
    errors.settlement = "Add a UPI ID or complete bank account details";
    return errors;
  }

  if (!upi && bankOn && Object.keys(validateBank(v)).length) {
    return errors;
  }

  if (upi && !bankOn) {
    return errors.upiId ? errors : {};
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

export function validateQualificationYear(
  raw: unknown,
  yearNow = new Date().getFullYear(),
): string | undefined {
  if (raw === "" || raw == null) return "Qualification year is required";
  const y = Number(raw);
  if (!Number.isFinite(y) || !Number.isInteger(y)) return "Enter a valid year";
  if (y < PUJARI_QUALIFICATION_YEAR_MIN) {
    return `Year must be ${PUJARI_QUALIFICATION_YEAR_MIN} or later`;
  }
  if (y > yearNow) return "Qualification year cannot be in the future";
  return undefined;
}

export function validateExperienceYears(raw: unknown): string | undefined {
  if (raw === "" || raw == null || (typeof raw === "string" && !String(raw).trim())) {
    return "Years of experience is required";
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Enter a valid number of years";
  if (n < 0) return "Experience cannot be negative";
  if (n > PUJARI_EXPERIENCE_MAX) return `Experience cannot exceed ${PUJARI_EXPERIENCE_MAX} years`;
  return undefined;
}

export function validatePujariLanguages(langs: string[] | undefined): string | undefined {
  if (!langs?.length) return "Select at least one language";
  return undefined;
}

export type PujariProfileFormInput = {
  profile_photo_path?: string | null;
  hasPhotoUrl?: boolean;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  date_of_birth?: string;
  countryCode?: string;
  phoneNational?: string;
  gotra?: string;
  pravara?: string;
  qualifications?: string[];
  qualification_year?: unknown;
  sampradaya?: string;
  experience_years?: unknown;
  languages?: string[];
};

export function validatePujariProfileForm(
  input: PujariProfileFormInput,
  opts?: { minLastLength?: number; yearNow?: number },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const yearNow = opts?.yearNow ?? new Date().getFullYear();

  if (!input.profile_photo_path && !input.hasPhotoUrl) {
    errors.profile_photo_path = "Profile photo is required";
  }

  Object.assign(
    errors,
    validatePersonNameParts(
      {
        first_name: String(input.first_name ?? ""),
        middle_name: String(input.middle_name ?? ""),
        last_name: String(input.last_name ?? ""),
      },
      { minLastLength: opts?.minLastLength ?? 3 },
    ),
  );

  const dob = String(input.date_of_birth || "").trim();
  if (!dob) errors.date_of_birth = "Date of birth is required";
  else if (!isValidPujariDob(dob)) {
    errors.date_of_birth = "You must be at least 18 years old (date cannot be in the future)";
  }

  const phoneErr = validatePhoneNational(input.countryCode || "+91", input.phoneNational || "");
  if (phoneErr) errors.mobile_number = phoneErr;

  if (!String(input.gotra || "").trim()) errors.gotra = "Gotra is required";
  if (!String(input.pravara || "").trim()) errors.pravara = "Pravara is required";

  const quals = input.qualifications || [];
  if (quals.length === 0) errors.qualifications = "Select at least one qualification";

  const qyErr = validateQualificationYear(input.qualification_year, yearNow);
  if (qyErr) errors.qualification_year = qyErr;

  if (!String(input.sampradaya || "").trim()) errors.sampradaya = "Sampradaya is required";

  const expErr = validateExperienceYears(input.experience_years);
  if (expErr) errors.experience_years = expErr;

  const langErr = validatePujariLanguages(input.languages);
  if (langErr) errors.languages = langErr;

  return errors;
}

export function validateSupport(subject: string, description: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMeaningfulText(subject, 5)) errors.subject = "Subject must contain at least 5 meaningful characters";
  if (!isMeaningfulText(description, 10)) errors.description = "Description must contain at least 10 meaningful characters";
  return errors;
}
