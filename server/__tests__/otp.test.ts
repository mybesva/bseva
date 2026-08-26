import { describe, it, expect, vi } from "vitest";
import { generateOTP } from "../services/otpService";

describe("OTP Service", () => {
  describe("generateOTP", () => {
    it("should generate a 6-digit OTP", () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it("should generate different OTPs on multiple calls", () => {
      const otps = new Set();
      for (let i = 0; i < 10; i++) {
        otps.add(generateOTP());
      }
      // With 10 random 6-digit numbers, we should have at least 5 unique values
      expect(otps.size).toBeGreaterThanOrEqual(5);
    });

    it("should generate OTP within valid range (100000-999999)", () => {
      for (let i = 0; i < 100; i++) {
        const otp = generateOTP();
        const numericOtp = parseInt(otp, 10);
        expect(numericOtp).toBeGreaterThanOrEqual(100000);
        expect(numericOtp).toBeLessThanOrEqual(999999);
      }
    });
  });
});
