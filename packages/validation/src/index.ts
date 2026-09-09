import { z } from "zod";

export function passwordStrengthOk(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export const loginSchema = z.object({
  identifier: z.string().min(3, "Enter email or phone"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    account_type: z.enum(["customer", "pujari"]),
    name: z.string().min(2, "Enter your full name").max(120),
    email: z.string().email("Enter a valid email"),
    phone: z.string().min(10, "Enter a valid phone").max(15),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    otp: z.string().min(4, "Enter the verification code").max(8),
    language: z.enum(["en", "hi", "te"]).default("en"),
    calendar_preference: z.enum(["north", "south", "lunar"]).default("north"),
    requested_level: z.number().int().min(1).max(4).optional(),
    registration_consent: z.boolean(),
    referral_code: z.string().max(40).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Password and confirmation do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => passwordStrengthOk(d.password), {
    message: "Password must be at least 8 characters and include letters and numbers",
    path: ["password"],
  })
  .refine((d) => d.registration_consent === true, {
    message: "You must accept the Terms & Privacy Policy",
    path: ["registration_consent"],
  });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(1),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  })
  .refine((d) => passwordStrengthOk(d.new_password), {
    message: "Password must be at least 8 characters and include letters and numbers",
    path: ["new_password"],
  });

export const addressSchema = z.object({
  address_line1: z.string().min(1, "Address is required"),
  address_line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  district: z.string().min(1, "District is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(4, "Pincode is required"),
  country: z.string().optional(),
  location_label: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const supportSchema = z.object({
  subject: z.string().min(3, "Enter a subject"),
  body: z.string().min(8, "Describe the issue"),
});

export const walletLoadSchema = z.object({
  amountRupees: z.number().positive("Enter an amount").max(500000),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
