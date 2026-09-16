import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANG,
  LANGS,
  collectKeys,
  dictionaries,
  interpolate,
  localeOverrides,
  missingKeysAgainst,
  normalizeLang,
  translate,
} from "./index";

const IDENTICAL_OK = new Set([
  "app.name",
  "booking.gst",
  "booking.id",
  "payment.transactionId",
  "invoice.type",
  "pujari.gotra",
  "pujari.pravara",
  "pujari.q1",
  "pujari.q2",
  "pujari.q3",
  "pujari.smartha",
  "pujari.madhwa",
  "pujari.vaishnava",
  "pujari.public.gotra",
  "pujari.angikara.address",
  "footer.rights",
  "booking.basic",
  "booking.standard",
  "booking.premium",
  "mobile.basic",
  "mobile.standard",
  "mobile.premium",
  "mobile.themeDark",
  "mobile.themeLight",
]);

describe("locale catalog", () => {
  const enKeys = collectKeys(dictionaries.en);

  it("registers all six languages", () => {
    expect(LANGS).toEqual(["en", "hi", "te", "mr", "ta", "kn"]);
    expect(Object.keys(dictionaries).sort()).toEqual([...LANGS].sort());
  });

  it("has 100% key coverage vs English for every locale", () => {
    for (const lang of LANGS) {
      if (lang === "en") continue;
      expect(missingKeysAgainst(dictionaries.en, dictionaries[lang])).toEqual([]);
    }
  });

  it("translates in-scope keys instead of leaving English copies", () => {
    const publicKeys = enKeys.filter((k) => !k.startsWith("admin."));
    for (const lang of ["hi", "te", "mr", "kn", "ta"] as const) {
      const missingReal = publicKeys.filter((key) => {
        if (IDENTICAL_OK.has(key)) return false;
        const value = localeOverrides[lang][key];
        return !value || value === dictionaries.en[key];
      });
      expect(missingReal, `${lang} still English`).toEqual([]);
    }
  });

  it("falls back to English for unknown keys and invalid locales", () => {
    expect(translate("te", "nav.home")).not.toBe("nav.home");
    expect(translate("xx" as never, "nav.home")).toBe(dictionaries.en["nav.home"]);
    expect(normalizeLang("TE-IN")).toBe("te");
    expect(normalizeLang("fr")).toBe(DEFAULT_LANG);
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("interpolates and pluralizes", () => {
    expect(interpolate("Hello {{name}}", { name: "Asha" })).toBe("Hello Asha");
    expect(translate("en", "booking.youHave", { count: 1 })).toContain("1");
    expect(translate("en", "booking.youHave", { count: 3 })).toContain("3");
    expect(translate("hi", "booking.onDate", { date: "16-09-2026" })).toContain("16-09-2026");
  });
});
