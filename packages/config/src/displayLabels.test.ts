import { describe, expect, it } from "vitest";
import { displayTokenLabel, translatedTokenLabel } from "./displayLabels";

describe("displayTokenLabel", () => {
  it("title-cases short English tokens without changing the lookup key", () => {
    expect(displayTokenLabel("all")).toBe("All");
    expect(displayTokenLabel("puja")).toBe("Puja");
    expect(displayTokenLabel("chadhava")).toBe("Chadhava");
    expect(displayTokenLabel("pravachan")).toBe("Pravachan");
    expect(displayTokenLabel("group_live")).toBe("Group Live");
    expect(displayTokenLabel("pending_acceptance")).toBe("Pending Acceptance");
    expect(displayTokenLabel("in_person")).toBe("In Person");
    expect(displayTokenLabel("offline")).toBe("Offline");
  });

  it("preserves acronyms and intentional mixed case", () => {
    expect(displayTokenLabel("UPI")).toBe("UPI");
    expect(displayTokenLabel("upi")).toBe("UPI");
    expect(displayTokenLabel("OTP")).toBe("OTP");
    expect(displayTokenLabel("B-Seva")).toBe("B-Seva");
    expect(displayTokenLabel("OK")).toBe("OK");
    expect(displayTokenLabel("WhatsApp")).toBe("WhatsApp");
    expect(displayTokenLabel("whatsapp")).toBe("WhatsApp");
  });

  it("does not rewrite non-Latin text", () => {
    expect(displayTokenLabel("चढ़ावा")).toBe("चढ़ावा");
    expect(displayTokenLabel("ప్రవచన")).toBe("ప్రవచన");
  });
});

describe("translatedTokenLabel", () => {
  it("keeps a real translation and only labels missing keys", () => {
    expect(translatedTokenLabel("अनुरोधित", "status.requested", "requested")).toBe("अनुरोधित");
    expect(translatedTokenLabel("In progress", "status.in_progress", "in_progress")).toBe("In progress");
    expect(translatedTokenLabel("status.guided", "status.guided", "guided")).toBe("Guided");
  });
});
