// OTP Service for B-Seva
import { getDb } from "../db";
import { otpVerifications } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendOTPSMS } from "./smsService";

// Generate a 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP in database
export async function createOTP(
  bookingId: number,
  phone: string
): Promise<{ otp: string; expiresAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  
  // Delete any existing OTPs for this booking
  await db.delete(otpVerifications).where(eq(otpVerifications.bookingId, bookingId));
  
  // Create new OTP record
  await db.insert(otpVerifications).values({
    bookingId,
    otp,
    phone,
    purpose: "booking_confirmation",
    expiresAt,
    isVerified: false,
    attempts: 0,
    createdAt: new Date(),
  });
  
  // Send OTP via SMS
  try {
    await sendOTPSMS(phone, otp);
    console.log(`[OTP] Sent OTP ${otp} to ${phone} for booking ${bookingId}`);
  } catch (error) {
    console.error(`[OTP] Failed to send SMS:`, error);
  }
  
  return { otp, expiresAt };
}

// Verify OTP
export async function verifyOTP(
  bookingId: number,
  inputOtp: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Find the OTP record
  const [otpRecord] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.bookingId, bookingId),
        eq(otpVerifications.isVerified, false)
      )
    )
    .limit(1);
  
  if (!otpRecord) {
    return { success: false, message: "No OTP found for this booking. Please request a new OTP." };
  }
  
  // Check if OTP has expired
  if (new Date() > otpRecord.expiresAt) {
    return { success: false, message: "OTP has expired. Please request a new OTP." };
  }
  
  // Check attempts (max 3)
  if ((otpRecord.attempts || 0) >= 3) {
    return { success: false, message: "Maximum attempts exceeded. Please request a new OTP." };
  }
  
  // Increment attempts
  await db
    .update(otpVerifications)
    .set({ attempts: (otpRecord.attempts || 0) + 1 })
    .where(eq(otpVerifications.id, otpRecord.id));
  
  // Verify OTP
  if (otpRecord.otp !== inputOtp) {
    const remaining = 2 - (otpRecord.attempts || 0);
    return { 
      success: false, 
      message: `Invalid OTP. ${remaining} attempts remaining.` 
    };
  }
  
  // Mark as verified
  await db
    .update(otpVerifications)
    .set({ isVerified: true })
    .where(eq(otpVerifications.id, otpRecord.id));
  
  return { success: true, message: "OTP verified successfully!" };
}

// Check if booking has verified OTP
export async function isBookingOTPVerified(bookingId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [otpRecord] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.bookingId, bookingId),
        eq(otpVerifications.isVerified, true)
      )
    )
    .limit(1);
  
  return !!otpRecord;
}

// Resend OTP (with rate limiting)
export async function resendOTP(
  bookingId: number,
  phone: string
): Promise<{ success: boolean; otp?: string; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if there's a recent OTP (within 1 minute)
  const [recentOtp] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.bookingId, bookingId),
        gt(otpVerifications.createdAt, new Date(Date.now() - 60 * 1000))
      )
    )
    .limit(1);
  
  if (recentOtp) {
    return { 
      success: false, 
      message: "Please wait 1 minute before requesting a new OTP." 
    };
  }
  
  const { otp, expiresAt } = await createOTP(bookingId, phone);
  
  // Send OTP via SMS
  try {
    await sendOTPSMS(phone, otp);
  } catch (error) {
    console.error(`[OTP] Failed to send SMS:`, error);
  }
  
  return { 
    success: true, 
    otp,
    message: `New OTP sent. Valid until ${expiresAt.toLocaleTimeString()}.`
  };
}
