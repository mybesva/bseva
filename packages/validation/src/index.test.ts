import { describe, expect, it } from "vitest";
import {
  addressSchema,
  hasSettlementMethod,
  parsePhoneParts,
  settlementPayload,
  supportSchema,
  validatePersonNameParts,
  validatePhoneNational,
  validatePujariOnboardingStep,
  validateSettlement,
} from "./index";

describe("validation parity with web", () => {
  it("requires 6-digit PIN and meaningful address", () => {
    expect(addressSchema.safeParse({
      address_line1: "12",
      city: "Hyderabad",
      district: "Hyderabad",
      state: "Telangana",
      pincode: "5000",
    }).success).toBe(false);
    expect(addressSchema.safeParse({
      address_line1: "12 MG Road",
      city: "Hyderabad",
      district: "Hyderabad",
      state: "Telangana",
      pincode: "500081",
    }).success).toBe(true);
  });

  it("matches web support min lengths", () => {
    expect(supportSchema.safeParse({ subject: "ab", body: "short" }).success).toBe(false);
    expect(supportSchema.safeParse({ subject: "Need help", body: "Please help with my booking." }).success).toBe(true);
  });

  it("requires UPI or full bank like web", () => {
    expect(Object.keys(validateSettlement({}))).toContain("settlement");
    expect(hasSettlementMethod({ upiId: "ram.kumar@oksbi" })).toBe(true);
    const payload = settlementPayload({
      holder: "Ram Kumar",
      bankName: "SBI",
      ifsc: "SBIN0001234",
      accountNumber: "123456789012",
      accountConfirm: "123456789012",
    });
    expect(payload.bank_account_last4).toBe("9012");
    expect(payload.bank_account_number).toBe("123456789012");
    expect(
      validateSettlement({
        upiId: "2369007544",
        holder: "Ram Kumar",
        bankName: "SBI",
        ifsc: "SBIN0001234",
        accountNumber: "123456789012",
        accountConfirm: "999999999999",
      }).accountConfirm,
    ).toBe("web.validation.accountMatch");
  });

  it("matches web customer profile name rules", () => {
    expect(validatePersonNameParts({ first_name: "ab", middle_name: "", last_name: "Kumar" })).toEqual({
      first_name: "validation.firstNameMin",
    });
    expect(validatePersonNameParts({ first_name: "Ram", middle_name: "", last_name: "" })).toEqual({
      last_name: "validation.lastNameRequired",
    });
    expect(validatePersonNameParts({ first_name: "Ram", middle_name: "K", last_name: "Kumar" })).toEqual({});
    expect(validatePersonNameParts({ first_name: "000", middle_name: "", last_name: "Kumar" })).toEqual({
      first_name: "validation.nameLetters",
    });
  });

  it("matches web phone validation", () => {
    expect(parsePhoneParts("+919876543210")).toEqual({ countryCode: "+91", national: "9876543210" });
    expect(validatePhoneNational("+91", "")).toBe("validation.phoneRequired");
    expect(validatePhoneNational("+91", "5876543210")).toBe("validation.phoneIndia");
    expect(validatePhoneNational("+91", "9876543210")).toBeNull();
  });
});

describe("pujari onboarding steps", () => {
  const today = new Date(2026, 10, 4);
  const step1 = {
    first_name: "Ravi",
    middle_name: "",
    last_name: "Sharma",
    date_of_birth: "1990-05-12",
    mobile_number: "+919876543210",
    gotra: "Bharadwaja",
    pravara: "Angirasa",
    experience_years: 5,
    sampradaya: "smartha",
    languages: ["Telugu"],
  };

  it("step 1 (profile page) needs photo, names, adult DOB, mobile, gotra, pravara and professional fields", () => {
    expect(validatePujariOnboardingStep(1, step1, { hasPhoto: true, today })).toEqual({});
    const errors = validatePujariOnboardingStep(1, {}, { today });
    expect(Object.keys(errors).sort()).toEqual(
      [
        "date_of_birth",
        "experience_years",
        "first_name",
        "gotra",
        "languages",
        "last_name",
        "mobile_number",
        "pravara",
        "profile_photo_path",
        "sampradaya",
      ].sort(),
    );
    expect(validatePujariOnboardingStep(1, { ...step1, date_of_birth: "2015-01-01" }, { hasPhoto: true, today }).date_of_birth).toBe(
      "web.validation.adult",
    );
    expect(validatePujariOnboardingStep(1, { ...step1, last_name: "Ra" }, { hasPhoto: true, today }).last_name).toBe(
      "validation.pujariLastNameMin",
    );
    // Older profiles with only full_name are split like the web does.
    const { first_name: _f, middle_name: _m, last_name: _l, ...legacy } = step1;
    expect(validatePujariOnboardingStep(1, { ...legacy, full_name: "Ravi Kumar Sharma" }, { hasPhoto: true, today })).toEqual({});
  });

  it("step 2 needs a full address and a map pin", () => {
    const address = { address_line1: "12 MG Road", city: "Hyderabad", district: "Hyderabad", state: "Telangana", pincode: "500081" };
    expect(validatePujariOnboardingStep(2, address).latitude).toBe("web.validation.mapPin");
    expect(validatePujariOnboardingStep(2, { ...address, latitude: 17.4, longitude: 78.5 })).toEqual({});
    expect(validatePujariOnboardingStep(2, { ...address, pincode: "5000", latitude: 1, longitude: 1 })).toEqual({
      pincode: "validation.pincode",
    });
  });

  it("step 3 needs experience, sampradaya and a language; year only with a qualification", () => {
    const pro = { experience_years: 5, sampradaya: "Smarta", languages: ["Telugu"] };
    expect(validatePujariOnboardingStep(3, pro, { today })).toEqual({});
    expect(validatePujariOnboardingStep(3, { ...pro, qualifications: ["veda"] }, { today }).qualification_year).toBe(
      "web.validation.qualificationYear",
    );
    expect(Object.keys(validatePujariOnboardingStep(3, {}, { today })).sort()).toEqual(
      ["experience_years", "languages", "sampradaya"].sort(),
    );
  });

  it("steps 4 to 6 need Aadhaar, a service with radius, and consent", () => {
    expect(validatePujariOnboardingStep(4, {}, { documentTypes: [] }).identity).toBe("web.validation.aadhaar");
    expect(validatePujariOnboardingStep(4, { licence_type: "driving_licence" }, { documentTypes: ["identity"] })).toEqual({
      driving_licence: "web.validation.drivingLicence",
    });
    expect(validatePujariOnboardingStep(5, { service_radius_km: 10 }, { appliedServices: 1 })).toEqual({});
    expect(Object.keys(validatePujariOnboardingStep(5, {}, {})).sort()).toEqual(["service_radius_km", "services"]);
    expect(validatePujariOnboardingStep(6, {}, { consent: false })).toEqual({ consent: "web.validation.finalConsent" });
  });
});
