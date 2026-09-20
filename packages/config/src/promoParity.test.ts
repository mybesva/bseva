import { describe, expect, it } from "vitest";
import { EMPTY_PROMO_BANNER, EMPTY_PROMO_POPUP, promoBannerBody, validatePromoBanner, validatePromoPopup } from "./promoParity";

describe("promoParity", () => {
  it("requires title and image like web PromosAdmin", () => {
    expect(validatePromoBanner(EMPTY_PROMO_BANNER)).toBe("Title is required");
    expect(validatePromoBanner({ ...EMPTY_PROMO_BANNER, title: "Diwali" })).toBe("Please upload an image");
    expect(validatePromoPopup({ ...EMPTY_PROMO_POPUP, title: "Hi", image_url: "/x", description: "" })).toBe(
      "Message is required"
    );
  });

  it("converts date inputs to UTC bounds", () => {
    const body = promoBannerBody(
      { ...EMPTY_PROMO_BANNER, title: "A", image_url: "/img", start_at: "2026-10-01", end_at: "2026-10-31" },
      true
    );
    expect(body.start_at).toBe("2026-10-01T00:00:00Z");
    expect(body.end_at).toBe("2026-10-31T23:59:59Z");
    expect(body.active).toBe(true);
  });
});
