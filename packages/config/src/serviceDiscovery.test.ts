import { describe, expect, it } from "vitest";
import {
  buildServicesApiQuery,
  buildServicesSearch,
  enabledSevaServiceTypes,
  isPujaService,
  pujaServicesOnly,
  resolveSevaServiceType,
  servicesOfType,
  servicesPathForType,
  splitAvailableUpcoming,
} from "./serviceDiscovery";

type Row = { slug: string; service_type?: string | null; bookable?: boolean };

/** Mirrors the audited GET /services payload: Puja rows plus the leaking Chadhava / Pravachan rows. */
const exploreRows: Row[] = [
  { slug: "rudrabhishek-group", service_type: "puja", bookable: true },
  { slug: "lakshmi-puja", service_type: "puja", bookable: false },
  { slug: "legacy-row" },
  { slug: "temple-flowers", service_type: "chadhava", bookable: true },
  { slug: "gita-pravachan", service_type: "pravachan", bookable: true },
];

describe("Puja discovery type filter", () => {
  it("drops Chadhava and Pravachan from the Puja grid", () => {
    const slugs = pujaServicesOnly(exploreRows).map((r) => r.slug);
    expect(slugs).toEqual(["rudrabhishek-group", "lakshmi-puja", "legacy-row"]);
  });

  it("treats rows without service_type as Puja", () => {
    expect(isPujaService({})).toBe(true);
    expect(isPujaService({ service_type: null })).toBe(true);
    expect(isPujaService({ service_type: "chadhava" })).toBe(false);
  });

  it("puja + chadhava + pravachan partitions the explore rows with no loss or duplication", () => {
    const puja = pujaServicesOnly(exploreRows).map((r) => r.slug);
    const chadhava = servicesOfType(exploreRows, "chadhava").map((r) => r.slug);
    const pravachan = servicesOfType(exploreRows, "pravachan").map((r) => r.slug);
    const all = [...puja, ...chadhava, ...pravachan].sort();
    expect(all).toEqual(exploreRows.map((r) => r.slug).sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it("Chadhava and Pravachan panes never include other types", () => {
    expect(servicesOfType(exploreRows, "chadhava").every((r) => r.service_type === "chadhava")).toBe(true);
    expect(servicesOfType(exploreRows, "pravachan").every((r) => r.service_type === "pravachan")).toBe(true);
  });

  it("keeps awaiting-pricing (not bookable) Pujas as upcoming", () => {
    const { available, upcoming, combined } = splitAvailableUpcoming(pujaServicesOnly(exploreRows));
    expect(available.map((r) => r.slug)).toEqual(["rudrabhishek-group"]);
    expect(upcoming.map((r) => r.slug)).toEqual(["lakshmi-puja", "legacy-row"]);
    expect(combined).toHaveLength(3);
  });
});

describe("tab selection", () => {
  it("defaults to Puja", () => {
    expect(resolveSevaServiceType(undefined)).toBe("puja");
    expect(resolveSevaServiceType("")).toBe("puja");
    expect(resolveSevaServiceType("unknown")).toBe("puja");
  });

  it("accepts each Seva line", () => {
    expect(resolveSevaServiceType("chadhava")).toBe("chadhava");
    expect(resolveSevaServiceType("PRAVACHAN")).toBe("pravachan");
  });

  it("falls back to Puja when a line is disabled", () => {
    const enabled = enabledSevaServiceTypes({ chadhava_enabled: false });
    expect(enabled).toEqual(["puja", "pravachan"]);
    expect(resolveSevaServiceType("chadhava", enabled)).toBe("puja");
  });

  it("hides Chadhava and Pravachan when Seva is switched off but keeps Puja", () => {
    expect(enabledSevaServiceTypes({ seva_events_enabled: false })).toEqual(["puja"]);
  });

  it("enables every line by default", () => {
    expect(enabledSevaServiceTypes(null)).toEqual(["puja", "chadhava", "pravachan"]);
    expect(enabledSevaServiceTypes({})).toEqual(["puja", "chadhava", "pravachan"]);
  });

  it("builds legacy-compatible URLs", () => {
    expect(servicesPathForType("puja")).toBe("/services");
    expect(servicesPathForType("chadhava")).toBe("/services?type=chadhava");
    expect(buildServicesSearch({ type: "puja" })).toBe("");
    expect(buildServicesSearch({ type: "puja", q: "lakshmi", category: "lakshmi-wealth" })).toBe(
      "?q=lakshmi&category=lakshmi-wealth"
    );
    expect(buildServicesSearch({ type: "chadhava" })).toBe("?type=chadhava");
    expect(buildServicesSearch({ category: "all", q: "  " })).toBe("");
  });
});

describe("server query", () => {
  it("passes q and category through and omits all", () => {
    expect(buildServicesApiQuery({ q: " homam ", category: "all" })).toEqual({ q: "homam" });
    expect(buildServicesApiQuery({ category: "popular" })).toEqual({ category: "popular" });
    expect(buildServicesApiQuery({ q: "a", category: "shiva" })).toEqual({ q: "a", category: "shiva" });
    expect(buildServicesApiQuery({})).toEqual({});
  });
});
