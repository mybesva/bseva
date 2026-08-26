/**
 * Guest Checkout Endpoint for Bookings Router
 * 
 * Add this endpoint to the bookingsRouter in server/routers.ts
 * Place it after the existing create: protectedProcedure endpoint
 */

import { z } from "zod";
import { publicProcedure } from "./_core/trpc";
import { nanoid } from "nanoid";
import * as db from "./db";

// Add this to the bookingsRouter object:
export const createGuestEndpoint = {
  // Create a guest booking (no authentication required)
  createGuest: publicProcedure
    .input(z.object({
      pujaTypeId: z.number(),
      priestId: z.number().optional(),
      tier: z.enum(["essential", "standard", "premium"]),
      bookingDate: z.date(),
      bookingTime: z.string().optional(),
      location: z.string(),
      city: z.string().optional(),
      specialInstructions: z.string().optional(),
      totalAmount: z.number(),
      platformFee: z.number(),
      priestAmount: z.number(),
      samagriIncluded: z.boolean().default(true),
      numberOfPeople: z.number().default(1),
      guestEmail: z.string().email(),
      guestPhone: z.string().min(10),
      guestName: z.string().min(2),
    }))
    .mutation(async ({ input }) => {
      const bookingNumber = `BSV-${nanoid(10)}`.toUpperCase();
      const verificationToken = nanoid(32);
      
      // Create booking without customerId (guest booking)
      const result = await db.createBooking({
        bookingNumber,
        customerId: null,
        priestId: input.priestId || null,
        pujaTypeId: input.pujaTypeId,
        tier: input.tier,
        bookingDate: input.bookingDate,
        bookingTime: input.bookingTime,
        location: input.location,
        city: input.city,
        specialInstructions: input.specialInstructions,
        status: "pending",
        totalAmount: input.totalAmount,
        platformFee: input.platformFee,
        priestAmount: input.priestAmount,
        samagriIncluded: input.samagriIncluded,
        numberOfPeople: input.numberOfPeople,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        guestName: input.guestName,
        isGuestBooking: true,
      });

      // Get the booking ID from the insert result
      const bookingId = (result as any).insertId || result[0];

      // Create guest booking tracking record
      await db.createGuestBooking(
        bookingId,
        input.guestEmail,
        input.guestPhone,
        input.guestName,
        verificationToken
      );

      // TODO: Send verification email with link to create account
      // await sendGuestVerificationEmail(input.guestEmail, verificationToken, bookingNumber);

      return { success: true, bookingNumber, isGuest: true };
    }),
};
