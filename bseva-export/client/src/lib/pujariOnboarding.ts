import { api } from "@/lib/api";
import {
  validateAddress,
  validatePujariProfileForm,
  validateQualificationYear,
  validatePujariLanguages,
} from "@/lib/fieldValidation";
import { parsePhoneParts } from "@/lib/phone";
import { splitDisplayName } from "@/lib/personName";

export const ONBOARDING_STEPS = 6;

export type OnboardingPage =
  | "profile"
  | "address"
  | "documents"
  | "services"
  | "availability"
  | "bank"
  | "review";

/** Route for the tab the pujari should complete at this onboarding_step. */
export function routeForOnboardingStep(step: number): string {
  switch (step) {
    case 1:
      return "/pujari/profile";
    case 2:
      return "/pujari/address";
    case 3:
      return "/pujari/profile#professional";
    case 4:
      return "/pujari/documents";
    case 5:
      return "/pujari/services";
    case 6:
      return "/pujari/onboarding";
    default:
      return "/pujari/profile";
  }
}

export function previousOnboardingStep(step: number): number {
  if (step === 4) return 2;
  if (step === 6) return 5;
  return Math.max(1, step - 1);
}

export function nextOnboardingStep(
  step: number,
  from: OnboardingPage,
): number {
  if (step === 1) return 2;
  if (step === 2) return 4;
  if (step === 3) return 4;
  if (step === 4) return 5;
  if (step === 5 && from === "availability") return 5;
  if (step === 5 && from === "bank") return 6;
  return Math.min(ONBOARDING_STEPS, step + 1);
}

export function stepLabel(step: number): string {
  switch (step) {
    case 1:
      return "My Profile";
    case 2:
      return "Address";
    case 3:
      return "My Profile (professional)";
    case 4:
      return "Documents";
    case 5:
      return "Services, availability & bank";
    case 6:
      return "Review & submit";
    default:
      return `Step ${step}`;
  }
}

type ValidateOpts = {
  userPhone?: string;
  consent?: boolean;
};

export async function validateOnboardingStep(
  step: number,
  profile: any,
  opts: ValidateOpts & { from?: OnboardingPage } = {},
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  const miss = (key: string, message: string, ok: boolean) => {
    if (!ok) errors[key] = message;
  };

  if (step === 1) {
    const split = splitDisplayName(profile.full_name || "");
    const parsed = parsePhoneParts(profile.mobile_number || opts.userPhone || "");
    Object.assign(
      errors,
      validatePujariProfileForm({
        profile_photo_path: profile.profile_photo_path,
        hasPhotoUrl: !!profile.profile_photo_path,
        first_name: String(profile.first_name ?? split.first_name),
        middle_name: String(profile.middle_name ?? split.middle_name),
        last_name: String(profile.last_name ?? split.last_name),
        date_of_birth: profile.date_of_birth,
        countryCode: parsed.countryCode,
        phoneNational: parsed.national,
        gotra: profile.gotra,
        pravara: profile.pravara,
        qualifications: profile.qualifications || [],
        qualification_year: profile.qualification_year,
        sampradaya: profile.sampradaya,
        experience_years: profile.experience_years,
        languages: profile.languages || [],
      }),
    );
  }

  if (step === 2) {
    Object.assign(
      errors,
      validateAddress({
        address_line1: profile.address_line1,
        city: profile.city,
        district: profile.district,
        state: profile.state,
        pincode: profile.pincode,
      }),
    );
    miss("latitude", "Pin your location on the map", profile.latitude != null && profile.longitude != null);
  }

  if (step === 3) {
    const quals: string[] = profile.qualifications || [];
    miss("qualifications", "Select at least one qualification", quals.length > 0);
    const qyErr = validateQualificationYear(profile.qualification_year);
    if (qyErr) errors.qualification_year = qyErr;
    miss("sampradaya", "Sampradaya is required", !!String(profile.sampradaya || "").trim());
    const langErr = validatePujariLanguages(profile.languages || []);
    if (langErr) errors.languages = langErr;
  }

  if (step === 4) {
    try {
      const docs = await api<any[]>("/pujari/documents");
      const hasAadhaar = docs.some((d) => d.document_type === "identity");
      miss("identity", "Upload Aadhaar (identity document)", hasAadhaar);
      let licenceType = String(profile.licence_type || "").toLowerCase();
      if (licenceType === "driving_licence" || licenceType === "cab_commercial") {
        const hasDl = docs.some((d) => d.document_type === "driving_licence");
        miss("driving_licence", "Upload driving licence", hasDl);
      }
    } catch {
      errors.identity = "Could not verify documents — upload Aadhaar and try again";
    }
  }

  if (step === 5) {
    const from = opts.from;
    if (from === "services") {
      try {
        const offers = await api<{ services: { applied?: boolean }[]; applied_count?: number }>(
          "/pujari/service-offers",
        );
        const hasService =
          (offers.applied_count ?? 0) > 0 || (offers.services || []).some((s) => s.applied);
        miss("services", "Apply for at least one puja service from the catalog", hasService);
      } catch {
        errors.services = "Could not verify service applications — try again";
      }
    }
    if (from === "availability") {
      miss("service_radius_km", "Set service radius (km)", !!profile.service_radius_km);
    }
    if (from === "bank") {
      miss("bank_holder_name", "Account holder name is required", !!String(profile.bank_holder_name || "").trim());
      miss("bank_ifsc", "IFSC is required", !!String(profile.bank_ifsc || "").trim());
      miss(
        "bank_account_number",
        "Account number is required",
        !!String(profile.bank_account_number || "").replace(/\D/g, ""),
      );
    }
  }

  if (step === 6) {
    miss("consent", "Accept final submission consent", !!opts.consent);
  }

  return errors;
}

export async function patchOnboardingStep(nextStep: number): Promise<any> {
  return api<any>("/pujari/profile", {
    method: "PATCH",
    body: JSON.stringify({ onboarding_step: nextStep }),
  });
}
