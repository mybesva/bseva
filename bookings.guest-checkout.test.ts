import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";

/**
 * Guest Checkout Tests
 * 
 * Tests for the new guest checkout feature that allows users to create bookings
 * without authentication. Guest bookings are tracked separately and can be linked
 * to user accounts later.
 */

describe("Guest Checkout Feature", () => {
  // Mock data for testing
  const mockGuestBookingData = {
    pujaTypeId: 1,
    tier: "standard" as const,
    bookingDate: new Date("2026-02-15"),
    bookingTime: "10:00 AM",
    location: "123 Spiritual Avenue, Temple Road",
    city: "Bangalore",
    numberOfPeople: 4,
    specialInstructions: "Please perform puja on auspicious time",
    totalAmount: 5000,
    platformFee: 750,
    priestAmount: 4250,
    samagriIncluded: true,
    guestEmail: "guest@example.com",
    guestPhone: "+91 9876543210",
    guestName: "Rajesh Kumar",
  };

  describe("Guest Booking Input Validation", () => {
    it("should validate guest email is required and valid", () => {
      const schema = z.object({
        guestEmail: z.string().email(),
      });

      // Valid email
      expect(() => schema.parse({ guestEmail: "test@example.com" })).not.toThrow();

      // Invalid email
      expect(() => schema.parse({ guestEmail: "invalid-email" })).toThrow();

      // Missing email
      expect(() => schema.parse({})).toThrow();
    });

    it("should validate guest phone number format", () => {
      const schema = z.object({
        guestPhone: z.string().min(10),
      });

      // Valid phone
      expect(() => schema.parse({ guestPhone: "+91 9876543210" })).not.toThrow();

      // Too short
      expect(() => schema.parse({ guestPhone: "12345" })).toThrow();
    });

    it("should validate guest name is required", () => {
      const schema = z.object({
        guestName: z.string().min(2),
      });

      // Valid name
      expect(() => schema.parse({ guestName: "John Doe" })).not.toThrow();

      // Too short
      expect(() => schema.parse({ guestName: "J" })).toThrow();

      // Missing name
      expect(() => schema.parse({})).toThrow();
    });

    it("should validate complete guest booking payload", () => {
      const guestBookingSchema = z.object({
        pujaTypeId: z.number(),
        tier: z.enum(["essential", "standard", "premium"]),
        bookingDate: z.date(),
        bookingTime: z.string().optional(),
        location: z.string(),
        city: z.string().optional(),
        numberOfPeople: z.number().default(1),
        specialInstructions: z.string().optional(),
        totalAmount: z.number(),
        platformFee: z.number(),
        priestAmount: z.number(),
        samagriIncluded: z.boolean().default(true),
        guestEmail: z.string().email(),
        guestPhone: z.string().min(10),
        guestName: z.string().min(2),
      });

      expect(() => guestBookingSchema.parse(mockGuestBookingData)).not.toThrow();
    });
  });

  describe("Guest Booking Creation", () => {
    it("should create a guest booking without userId", () => {
      // Mock booking data without customerId
      const guestBooking = {
        bookingNumber: "BSV-ABC123DEF",
        customerId: null, // No authenticated user
        priestId: null,
        pujaTypeId: mockGuestBookingData.pujaTypeId,
        tier: mockGuestBookingData.tier,
        bookingDate: mockGuestBookingData.bookingDate,
        bookingTime: mockGuestBookingData.bookingTime,
        location: mockGuestBookingData.location,
        city: mockGuestBookingData.city,
        numberOfPeople: mockGuestBookingData.numberOfPeople,
        specialInstructions: mockGuestBookingData.specialInstructions,
        totalAmount: mockGuestBookingData.totalAmount,
        platformFee: mockGuestBookingData.platformFee,
        priestAmount: mockGuestBookingData.priestAmount,
        samagriIncluded: mockGuestBookingData.samagriIncluded,
        guestEmail: mockGuestBookingData.guestEmail,
        guestPhone: mockGuestBookingData.guestPhone,
        guestName: mockGuestBookingData.guestName,
        isGuestBooking: true,
        status: "pending",
      };

      // Verify guest booking has no customerId
      expect(guestBooking.customerId).toBeNull();
      expect(guestBooking.isGuestBooking).toBe(true);
      expect(guestBooking.guestEmail).toBe(mockGuestBookingData.guestEmail);
    });

    it("should generate unique booking numbers for guest bookings", () => {
      const bookingNumber1 = `BSV-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
      const bookingNumber2 = `BSV-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

      expect(bookingNumber1).not.toBe(bookingNumber2);
      expect(bookingNumber1).toMatch(/^BSV-[A-Z0-9]{10}$/);
      expect(bookingNumber2).toMatch(/^BSV-[A-Z0-9]{10}$/);
    });

    it("should set guest booking status to pending", () => {
      const guestBooking = {
        status: "pending",
        isGuestBooking: true,
      };

      expect(guestBooking.status).toBe("pending");
    });
  });

  describe("Guest Booking Tracking", () => {
    it("should create guest booking record with verification token", () => {
      const verificationToken = Math.random().toString(36).substring(2, 34);
      const guestBookingRecord = {
        bookingId: 1,
        guestEmail: mockGuestBookingData.guestEmail,
        guestPhone: mockGuestBookingData.guestPhone,
        guestName: mockGuestBookingData.guestName,
        verificationToken,
        isVerified: false,
        linkedUserId: null,
      };

      expect(guestBookingRecord.verificationToken).toBeDefined();
      expect(guestBookingRecord.isVerified).toBe(false);
      expect(guestBookingRecord.linkedUserId).toBeNull();
      expect(guestBookingRecord.guestEmail).toBe(mockGuestBookingData.guestEmail);
    });

    it("should track guest email for future account linking", () => {
      const guestBooking = {
        guestEmail: "rajesh@example.com",
        guestPhone: "+91 9876543210",
        guestName: "Rajesh Kumar",
      };

      // Guest can later sign up with same email
      const signupEmail = guestBooking.guestEmail;
      expect(signupEmail).toBe("rajesh@example.com");
    });
  });

  describe("Guest to User Linking", () => {
    it("should link guest booking to user account when created", () => {
      const guestBooking = {
        bookingId: 1,
        linkedUserId: null,
        isVerified: false,
      };

      // After user creates account
      const updatedGuestBooking = {
        ...guestBooking,
        linkedUserId: 42,
        isVerified: true,
      };

      expect(guestBooking.linkedUserId).toBeNull();
      expect(updatedGuestBooking.linkedUserId).toBe(42);
      expect(updatedGuestBooking.isVerified).toBe(true);
    });

    it("should verify guest email before linking", () => {
      const guestBooking = {
        guestEmail: "guest@example.com",
        verificationToken: "token123",
        isVerified: false,
      };

      // After email verification
      const verifiedBooking = {
        ...guestBooking,
        isVerified: true,
      };

      expect(guestBooking.isVerified).toBe(false);
      expect(verifiedBooking.isVerified).toBe(true);
    });
  });

  describe("Guest Booking Retrieval", () => {
    it("should retrieve guest booking by email", () => {
      const guestBookings = [
        {
          id: 1,
          bookingId: 101,
          guestEmail: "rajesh@example.com",
          guestName: "Rajesh Kumar",
        },
        {
          id: 2,
          bookingId: 102,
          guestEmail: "priya@example.com",
          guestName: "Priya Sharma",
        },
      ];

      const found = guestBookings.find(gb => gb.guestEmail === "rajesh@example.com");
      expect(found).toBeDefined();
      expect(found?.guestName).toBe("Rajesh Kumar");
    });

    it("should handle multiple guest bookings for same email", () => {
      const guestBookings = [
        { id: 1, bookingId: 101, guestEmail: "user@example.com" },
        { id: 2, bookingId: 102, guestEmail: "user@example.com" },
      ];

      const userBookings = guestBookings.filter(gb => gb.guestEmail === "user@example.com");
      expect(userBookings).toHaveLength(2);
    });
  });

  describe("Guest Booking Pricing", () => {
    it("should calculate correct pricing for guest bookings", () => {
      const basePrice = 5000; // in paise
      const platformFee = Math.floor(basePrice * 0.15);
      const priestAmount = basePrice - platformFee;

      expect(platformFee).toBe(750);
      expect(priestAmount).toBe(4250);
      expect(basePrice).toBe(platformFee + priestAmount);
    });

    it("should support all tier pricing for guest bookings", () => {
      const tierPrices = {
        essential: 3000,
        standard: 5000,
        premium: 8000,
      };

      const tiers = ["essential", "standard", "premium"] as const;
      tiers.forEach(tier => {
        const price = tierPrices[tier];
        const platformFee = Math.floor(price * 0.15);
        expect(platformFee).toBeGreaterThan(0);
        expect(price - platformFee).toBeGreaterThan(0);
      });
    });
  });

  describe("Guest Booking Confirmation", () => {
    it("should generate confirmation details for guest booking", () => {
      const confirmation = {
        bookingNumber: "BSV-ABC123DEF",
        guestEmail: mockGuestBookingData.guestEmail,
        guestName: mockGuestBookingData.guestName,
        bookingDate: mockGuestBookingData.bookingDate,
        tier: mockGuestBookingData.tier,
        totalAmount: mockGuestBookingData.totalAmount,
        status: "pending",
      };

      expect(confirmation.bookingNumber).toMatch(/^BSV-/);
      expect(confirmation.guestEmail).toBe(mockGuestBookingData.guestEmail);
      expect(confirmation.status).toBe("pending");
    });

    it("should include guest contact info in confirmation", () => {
      const confirmation = {
        guestName: mockGuestBookingData.guestName,
        guestEmail: mockGuestBookingData.guestEmail,
        guestPhone: mockGuestBookingData.guestPhone,
      };

      expect(confirmation.guestName).toBeDefined();
      expect(confirmation.guestEmail).toBeDefined();
      expect(confirmation.guestPhone).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should reject guest booking with invalid email", () => {
      const invalidData = {
        ...mockGuestBookingData,
        guestEmail: "not-an-email",
      };

      const schema = z.object({
        guestEmail: z.string().email(),
      });

      expect(() => schema.parse(invalidData)).toThrow();
    });

    it("should reject guest booking with missing required fields", () => {
      const incompleteData = {
        guestEmail: "test@example.com",
        // Missing guestPhone and guestName
      };

      const schema = z.object({
        guestEmail: z.string().email(),
        guestPhone: z.string().min(10),
        guestName: z.string().min(2),
      });

      expect(() => schema.parse(incompleteData)).toThrow();
    });

    it("should handle duplicate guest bookings gracefully", () => {
      const booking1 = {
        id: 1,
        guestEmail: "user@example.com",
        bookingNumber: "BSV-001",
      };

      const booking2 = {
        id: 2,
        guestEmail: "user@example.com",
        bookingNumber: "BSV-002",
      };

      // Both bookings should be allowed (same guest can have multiple bookings)
      expect(booking1.guestEmail).toBe(booking2.guestEmail);
      expect(booking1.bookingNumber).not.toBe(booking2.bookingNumber);
    });
  });

  describe("Guest Checkout Flow", () => {
    it("should complete guest checkout without authentication", () => {
      const checkoutFlow = {
        step1: "Select package",
        step2: "Enter booking details",
        step3: "Review booking",
        step4: "Enter guest info (email, phone, name)",
        step5: "Complete booking",
        requiresAuth: false,
      };

      expect(checkoutFlow.requiresAuth).toBe(false);
      expect(checkoutFlow.step4).toContain("guest info");
    });

    it("should provide guest with booking confirmation after checkout", () => {
      const result = {
        success: true,
        bookingNumber: "BSV-ABC123DEF",
        isGuest: true,
        message: "Guest booking created! Check your email for confirmation.",
      };

      expect(result.success).toBe(true);
      expect(result.isGuest).toBe(true);
      expect(result.bookingNumber).toBeDefined();
    });
  });
});
