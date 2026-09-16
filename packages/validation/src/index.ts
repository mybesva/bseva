import { z } from "zod";

export function passwordStrengthOk(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export const loginSchema = z.object({
  identifier: z.string().min(3, "validation.identifier"),
  password: z.string().min(1, "validation.passwordRequired"),
});

export const registerSchema = z
  .object({
    account_type: z.enum(["customer", "pujari"]),
    name: z.string().min(2, "validation.name").max(120),
    email: z.string().email("validation.email"),
    phone: z.string().min(10, "validation.phone").max(15),
    password: z.string().min(8, "validation.password"),
    confirmPassword: z.string().min(1, "validation.confirmPassword"),
    otp: z.string().min(4, "validation.otp").max(8),
    language: z.enum(["en", "hi", "te", "mr", "ta", "kn"]).default("en"),
    calendar_preference: z.enum(["north", "south", "lunar"]).default("north"),
    requested_level: z.number().int().min(1).max(4).optional(),
    registration_consent: z.boolean(),
    referral_code: z.string().max(40).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "validation.passwordMatch",
    path: ["confirmPassword"],
  })
  .refine((d) => passwordStrengthOk(d.password), {
    message: "validation.password",
    path: ["password"],
  })
  .refine((d) => d.registration_consent === true, {
    message: "validation.consent",
    path: ["registration_consent"],
  });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "validation.currentPassword"),
    new_password: z.string().min(8, "validation.password"),
    confirm: z.string().min(1, "validation.confirmPassword"),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: "validation.passwordMatch",
    path: ["confirm"],
  })
  .refine((d) => passwordStrengthOk(d.new_password), {
    message: "validation.password",
    path: ["new_password"],
  });

export const addressSchema = z.object({
  address_line1: z.string().min(1, "validation.address"),
  address_line2: z.string().optional(),
  city: z.string().min(1, "validation.city"),
  district: z.string().min(1, "validation.district"),
  state: z.string().min(1, "validation.state"),
  pincode: z.string().min(4, "validation.pincode"),
  country: z.string().optional(),
  location_label: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const supportSchema = z.object({
  subject: z.string().min(3, "validation.subject"),
  body: z.string().min(8, "validation.issue"),
});

export const walletLoadSchema = z.object({
  amountRupees: z.number().positive("validation.amount").max(500000),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
