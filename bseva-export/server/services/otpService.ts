// OTP Service for B-Seva (SQLite demo)
import { getDb } from "../db";
import { otpVerifications } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendOTPSMS } from "./smsService";

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createOTP(
  bookingId: number,
  phone: string
): Promise<{ otp: string; expiresAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.delete(otpVerifications).where(eq(otpVerifications.bookingId, bookingId));

  await db.insert(otpVerifications).values({
    bookingId,
    otp,
    phone,
    expiresAt,
    isVerified: false,
    createdAt: new Date(),
  });

  try {
    await sendOTPSMS(phone, otp);
  } catch (error) {
    console.error(`[OTP] Failed to send SMS:`, error);
  }
  console.log(`[OTP] Booking ${bookingId}: ${otp}`);

  return { otp, expiresAt };
}

export async function verifyOTP(
  bookingId: number,
  inputOtp: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [otpRecord] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(eq(otpVerifications.bookingId, bookingId), eq(otpVerifications.isVerified, false))
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  if (!otpRecord) {
    return { success: false, message: "No OTP found for this booking. Please request a new OTP." };
  }

  if (new Date() > new Date(otpRecord.expiresAt)) {
    return { success: false, message: "OTP has expired. Please request a new OTP." };
  }

  if (otpRecord.otp !== inputOtp) {
    return { success: false, message: "Invalid OTP. Please try again." };
  }

  await db
    .update(otpVerifications)
    .set({ isVerified: true })
    .where(eq(otpVerifications.id, otpRecord.id));

  return { success: true, message: "OTP verified successfully." };
}

export async function resendOTP(bookingId: number, phone: string) {
  return createOTP(bookingId, phone);
}

export async function isBookingOTPVerified(bookingId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select()
    .from(otpVerifications)
    .where(and(eq(otpVerifications.bookingId, bookingId), eq(otpVerifications.isVerified, true)))
    .limit(1);
  return !!row;
}
