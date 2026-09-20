import { describe, expect, it } from "vitest";
import {
  buildCreateBookingPayload,
  composePhysicalServiceAddress,
  customerBookablePackages,
  toE164,
  virtualPujaCity,
  virtualPujaLocationLabel,
} from "./bookingParity";

describe("bookingParity", () => {
  it("excludes basic from customer packages", () => {
    expect(customerBookablePackages({ standard: 1000, premium: 2000 })).toEqual(["standard", "premium"]);
    expect(customerBookablePackages({ standard: 0, premium: 2000 })).toEqual(["premium"]);
  });

  it("builds virtual location like web BookingWizard", () => {
    expect(virtualPujaCity("US")).toBe("United States");
    expect(virtualPujaLocationLabel("US", "America/New_York")).toBe(
      "Virtual Puja · United States · America/New_York"
    );
  });

  it("omits lat/lng and uses country label as city for virtual bookings", () => {
    const body = buildCreateBookingPayload({
      service_id: "svc",
      package_type: "standard",
      mode: "virtual",
      booking_date: "2026-10-01",
      start_time: "10:00",
      physicalAddress: "should not appear",
      city: "Hyderabad",
      latitude: 17.3,
      longitude: 78.4,
      include_samagri: false,
      include_alankaram: false,
      include_food: false,
      recurring: "none",
      customer_country: "US",
      customer_timezone: "America/New_York",
    });
    expect(body.city).toBe("United States");
    expect(body.address).toBe("Virtual Puja · United States · America/New_York");
    expect(body.location_label).toBe(body.address);
    expect(body.latitude).toBeUndefined();
    expect(body.longitude).toBeUndefined();
    expect(body.customer_country).toBe("US");
  });

  it("keeps physical address and coordinates", () => {
    const street = composePhysicalServiceAddress({ doorNumber: "12", street: "MG Road", landmark: "Temple" });
    const body = buildCreateBookingPayload({
      service_id: "svc",
      package_type: "premium",
      mode: "in_person",
      booking_date: "2026-10-01",
      start_time: "09:30",
      physicalAddress: street,
      city: "Hyderabad",
      latitude: 17.3,
      longitude: 78.4,
      include_samagri: true,
      include_alankaram: false,
      include_food: false,
      recurring: "none",
    });
    expect(body.address).toBe("12, MG Road, Temple");
    expect(body.city).toBe("Hyderabad");
    expect(body.latitude).toBe(17.3);
    expect(body.customer_country).toBeUndefined();
  });

  it("formats E.164 India numbers", () => {
    expect(toE164("+91", "9876543210")).toBe("+919876543210");
  });
});
