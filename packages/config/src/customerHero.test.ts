import { describe, expect, it } from "vitest";
import {
  customerGreetingName,
  customerHeroHeadingFontSize,
  namasteParts,
} from "./customerHero";

describe("customerHero", () => {
  it("builds namaste greeting parts", () => {
    expect(namasteParts("Namaste 🙏 Ram!")).toEqual({ before: "Namaste ", after: "Ram!" });
  });

  it("falls back greeting name", () => {
    expect(customerGreetingName("  ", "Customer")).toBe("Customer");
    expect(customerGreetingName("Ram", "Customer")).toBe("Ram");
  });

  it("scales heading font size by name length", () => {
    const width = 390;
    expect(customerHeroHeadingFontSize("Ram", width)).toBeGreaterThan(
      customerHeroHeadingFontSize("Very Long Customer Name Here", width),
    );
  });
});
