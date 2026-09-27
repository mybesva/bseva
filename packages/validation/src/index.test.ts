import { describe, expect, it } from "vitest";
import {
  addressSchema,
  hasSettlementMethod,
  parsePhoneParts,
  settlementPayload,
  supportSchema,
  validatePersonNameParts,
  validatePhoneNational,
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
  });

  it("matches web phone validation", () => {
    expect(parsePhoneParts("+919876543210")).toEqual({ countryCode: "+91", national: "9876543210" });
    expect(validatePhoneNational("+91", "")).toBe("validation.phoneRequired");
    expect(validatePhoneNational("+91", "5876543210")).toBe("validation.phoneIndia");
    expect(validatePhoneNational("+91", "9876543210")).toBeNull();
  });
});
