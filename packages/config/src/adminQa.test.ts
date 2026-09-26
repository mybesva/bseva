import { describe, expect, it } from "vitest";
import {
  chipSelectionValue,
  filterPujariRoles,
  filterServiceCategories,
  matchesServiceSearch,
  validateAdminCustomerForm,
  validateAdminTempleForm,
  validateGstPercent,
} from "./adminQa";

describe("chipSelectionValue", () => {
  it("includes empty string for All filter", () => {
    expect(chipSelectionValue("").has("")).toBe(true);
  });
});

describe("validateAdminCustomerForm", () => {
  it("flags invalid email and phone", () => {
    const errors = validateAdminCustomerForm({
      name: "A",
      email: "mhddk",
      phone: "12345",
      password: "short",
      location: "",
    });
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.location).toBeTruthy();
  });
});

describe("validateAdminTempleForm", () => {
  it("requires state pincode deity phone", () => {
    const errors = validateAdminTempleForm({
      name: "Temple",
      state: "",
      pincode: "12",
      deity: "",
      contactPhone: "abc",
    });
    expect(errors.state).toBeTruthy();
    expect(errors.pincode).toBeTruthy();
    expect(errors.deity).toBeTruthy();
    expect(errors.contactPhone).toBeTruthy();
  });
});

describe("validateGstPercent", () => {
  it("accepts valid gst", () => {
    expect(validateGstPercent("18")).toBeNull();
    expect(validateGstPercent("101")).toBeTruthy();
  });
});

describe("filterPujariRoles", () => {
  it("filters by level title", () => {
    const rows = [
      { level: 2, title: "Basic Pujas", summary: "", examples: [] },
      { level: 3, title: "Major", summary: "", examples: [] },
    ];
    expect(filterPujariRoles(rows, "Level 2")).toHaveLength(1);
    expect(filterPujariRoles(rows, "Major")).toHaveLength(1);
  });
});

describe("filterServiceCategories", () => {
  it("filters categories by name", () => {
    const rows = [{ name: "Home & Property", slug: "home", description: "" }];
    expect(filterServiceCategories(rows, "Ganapati")).toHaveLength(0);
    expect(filterServiceCategories(rows, "home")).toHaveLength(1);
  });
});

describe("matchesServiceSearch", () => {
  it("matches aliases", () => {
    expect(matchesServiceSearch({ name: "Puja", search_aliases: ["Ganapati"] }, "ganapati")).toBe(true);
  });
});
