import { describe, expect, it } from "vitest";
import { validateAdminPujariForm } from "./adminQa";
import {
  assignmentEligibilityLead,
  clampServiceRequiredLevel,
  priestCoversService,
  pujariAlreadyHoldsRole,
  pujariCanSelectRole,
} from "./pujariLevels";
import { buildAdminServicePayload, emptyAdminServiceForm } from "./serviceForm";

function legacyCovers(approved: number, required: number) {
  if (!approved) return false;
  if (approved >= 4) return true;
  return approved >= required;
}

describe("Level 1–4 priest cover is unchanged", () => {
  it("matches the previous hierarchy for every Level 1–4 pair", () => {
    for (const approved of [1, 2, 3, 4]) {
      for (const required of [1, 2, 3, 4]) {
        expect(priestCoversService(approved, required)).toBe(legacyCovers(approved, required));
      }
    }
  });
});

describe("specialized role eligibility", () => {
  it("lets Chava cover only Chava and Pravachana cover only Pravachana", () => {
    expect(priestCoversService(5, 5)).toBe(true);
    expect(priestCoversService(6, 5)).toBe(false);
    expect(priestCoversService(5, 6)).toBe(false);
    expect(priestCoversService(6, 6)).toBe(true);
  });

  it("does not give Level 5 or 6 the Level 1–4 catalog", () => {
    for (const required of [1, 2, 3, 4]) {
      expect(priestCoversService(5, required)).toBe(false);
      expect(priestCoversService(6, required)).toBe(false);
    }
    expect(priestCoversService(4, 5)).toBe(false);
    expect(priestCoversService(4, 6)).toBe(false);
  });
});

describe("assignment UI and service level clamp", () => {
  it("keeps the Level 1–4 assignment sentence and uses an exact match for Levels 5 and 6", () => {
    expect(assignmentEligibilityLead(1)).toBe("Level 1 or above.");
    expect(assignmentEligibilityLead(4)).toBe("Level 4 or above.");
    expect(assignmentEligibilityLead(5)).toBe("Only Level 5 providers.");
    expect(assignmentEligibilityLead(6)).toBe("Only Level 6 providers.");
  });

  it("clamps Levels 1–4 the same way and keeps 5 and 6", () => {
    for (const level of [1, 2, 3, 4]) {
      expect(clampServiceRequiredLevel(level)).toBe(Math.min(4, Math.max(1, level)));
    }
    expect(clampServiceRequiredLevel(5)).toBe(5);
    expect(clampServiceRequiredLevel(6)).toBe(6);
    const form = emptyAdminServiceForm();
    expect(buildAdminServicePayload({ ...form, required_level: 2 }).required_level).toBe(2);
    expect(buildAdminServicePayload({ ...form, required_level: 4 }).required_level).toBe(4);
    expect(buildAdminServicePayload({ ...form, required_level: 5 }).required_level).toBe(5);
    expect(buildAdminServicePayload({ ...form, required_level: 6 }).required_level).toBe(6);
  });
});

describe("pujari role list", () => {
  it("still treats Level 1–4 as a ladder and specialized roles as exact", () => {
    expect(pujariAlreadyHoldsRole(3, 1)).toBe(true);
    expect(pujariAlreadyHoldsRole(3, 2)).toBe(true);
    expect(pujariAlreadyHoldsRole(2, 4)).toBe(false);
    expect(pujariCanSelectRole(2, 3)).toBe(true);
    expect(pujariCanSelectRole(4, 2)).toBe(false);
    expect(pujariAlreadyHoldsRole(5, 2)).toBe(false);
    expect(pujariAlreadyHoldsRole(5, 5)).toBe(true);
    expect(pujariCanSelectRole(5, 1)).toBe(false);
    expect(pujariCanSelectRole(5, 6)).toBe(true);
    expect(pujariCanSelectRole(6, 5)).toBe(true);
  });
});

describe("admin pujari form", () => {
  const base = {
    name: "Rama",
    email: "rama@example.com",
    phone: "9876543210",
    password: "password1",
    location: "Hyderabad",
  };

  it("accepts Levels 1–4 and the two specialized roles", () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(validateAdminPujariForm({ ...base, requested_level: level }).requested_level).toBeUndefined();
    }
    expect(validateAdminPujariForm({ ...base, requested_level: 7 }).requested_level).toBeTruthy();
  });
});
