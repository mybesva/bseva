import { describe, expect, it } from "vitest";
import { LANGS, translate } from "./index";

/** Keys rendered by the unified Explore Services screen (web + mobile). */
const EXPLORE_KEYS = [
  "nav.exploreServices",
  "common.all",
  "services.title",
  "services.subtitle",
  "services.popular",
  "services.searchPujas",
  "services.noPujas",
  "services.availablePujas",
  "services.upcomingServices",
  "mobile.services",
  "seva.puja",
  "seva.chadhava",
  "seva.pravachan",
  "seva.events",
  "seva.noEvents",
  "seva.register",
  "seva.mySeva",
  "errors.generic",
];

describe("Explore Services locale keys", () => {
  for (const lang of LANGS) {
    it(`${lang}: no raw keys are rendered`, () => {
      for (const key of EXPLORE_KEYS) {
        const value = translate(lang, key);
        expect(value, `${lang}:${key}`).toBeTruthy();
        expect(value, `${lang}:${key}`).not.toBe(key);
      }
    });
  }
});
