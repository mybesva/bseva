import { describe, expect, it } from "vitest";
import { formatPujariDistance, pujariMatchesQuery, searchAndSortPujaris, type AssignablePujari } from "./pujariAssign";

const list: AssignablePujari[] = [
  { id: "a", name: "Test Head Pujari", approved_level: 3, distance_km: 9.26, city: "Hyderabad", experience_years: null },
  { id: "b", name: "Ganesh Kumar", approved_level: 2, distance_km: 0.02, city: "Nallagandla", experience_years: 10,
    specializations: '["Bhoomi Puja","Diwali Puja"]', phone: "+91 98480 12345" },
  { id: "c", name: "radha krishna", approved_level: 1, distance_km: 0.21, city: "Hyderabad", experience_years: 0,
    specializations: ["Satyanarayana Puja"] },
  { id: "d", name: "Far Away", approved_level: 1, distance_km: null, city: "Vizag", experience_years: 25 },
  { id: "e", name: "Pandit", approved_level: 2, distance_km: 0.01, city: "Bengaluru", experience_years: 10 },
];

describe("searchAndSortPujaris", () => {
  it("sorts nearest first, unknown distance last", () => {
    expect(searchAndSortPujaris(list, "").map((p) => p.id)).toEqual(["e", "b", "c", "a", "d"]);
  });

  it("searches name, area and pujas, case-insensitive, keeping nearest-first order", () => {
    expect(searchAndSortPujaris(list, "hyderabad").map((p) => p.id)).toEqual(["c", "a"]);
    expect(searchAndSortPujaris(list, "KRISHNA").map((p) => p.id)).toEqual(["c"]);
    expect(searchAndSortPujaris(list, "satyanarayana").map((p) => p.id)).toEqual(["c"]);
    expect(searchAndSortPujaris(list, "diwali ganesh").map((p) => p.id)).toEqual(["b"]);
    expect(searchAndSortPujaris(list, "zzz")).toEqual([]);
  });

  it("finds a pujari by phone digits", () => {
    expect(pujariMatchesQuery(list[1], "98480")).toBe(true);
    expect(pujariMatchesQuery(list[0], "98480")).toBe(false);
  });

  it("sorts by experience or name on request", () => {
    expect(searchAndSortPujaris(list, "", "experience").map((p) => p.id)).toEqual(["d", "e", "b", "c", "a"]);
    expect(searchAndSortPujaris(list, "", "name").map((p) => p.id)).toEqual(["d", "b", "e", "c", "a"]);
  });

  it("does not change the original list", () => {
    const copy = list.map((p) => p.id);
    searchAndSortPujaris(list, "", "name");
    expect(list.map((p) => p.id)).toEqual(copy);
  });
});

describe("formatPujariDistance", () => {
  it("formats km for display", () => {
    expect(formatPujariDistance(0.02)).toBe("20 m away");
    expect(formatPujariDistance(0.001)).toBe("10 m away");
    expect(formatPujariDistance(0.21)).toBe("210 m away");
    expect(formatPujariDistance(9.26)).toBe("9.3 km away");
    expect(formatPujariDistance(14.6)).toBe("15 km away");
    expect(formatPujariDistance(null)).toBe("Distance unknown");
  });
});
