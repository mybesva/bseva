import { describe, expect, it } from "vitest";
import { hasAdminPermission, mapNotificationLinkToMobile } from "./index";

describe("mapNotificationLinkToMobile", () => {
  it("maps customer booking links", () => {
    expect(mapNotificationLinkToMobile("/booking/abc", "consumer")).toBe("/customer/booking/abc");
    expect(mapNotificationLinkToMobile("/customer/notifications", "consumer")).toBe("/customer/notifications");
    expect(mapNotificationLinkToMobile("/pujari/bookings", "consumer")).toBe("/pujari/jobs");
    expect(mapNotificationLinkToMobile("/join/tok", "consumer")).toBe("/join/tok");
  });

  it("maps admin links", () => {
    expect(mapNotificationLinkToMobile("/admin/bookings", "admin")).toBe("/(app)/bookings");
    expect(mapNotificationLinkToMobile("/admin/pujaris/xyz", "admin")).toBe("/pujari/xyz");
    expect(mapNotificationLinkToMobile("/admin", "admin")).toBe("/(app)");
  });
});

describe("hasAdminPermission", () => {
  it("lets super_admin through", () => {
    expect(hasAdminPermission("super_admin", [], "manage_admins")).toBe(true);
  });
  it("blocks admin without the permission", () => {
    expect(hasAdminPermission("admin", ["view_customers"], "manage_admins")).toBe(false);
  });
  it("blocks customer accounts", () => {
    expect(hasAdminPermission("customer", ["manage_admins"], "manage_admins")).toBe(false);
  });
});
