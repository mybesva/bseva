/**
 * SQLite schema for B-Seva demo (Drizzle).
 * Field names mirror the original MySQL schema so existing UI/API keep working.
 */
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    openId: text("openId").notNull().unique(),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    password: text("password"),
    loginMethod: text("loginMethod"),
    role: text("role", { enum: ["customer", "priest", "admin"] })
      .default("customer")
      .notNull(),
    profileImage: text("profileImage"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
    phoneIdx: index("phone_idx").on(table.phone),
    roleIdx: index("role_idx").on(table.role),
  })
);

export const priestProfiles = sqliteTable(
  "priest_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    experience: integer("experience").notNull(),
    languages: text("languages", { mode: "json" }).$type<string[]>().notNull(),
    specializations: text("specializations", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    rating: real("rating").default(0),
    totalReviews: integer("totalReviews").default(0),
    totalBookings: integer("totalBookings").default(0),
    isVerified: integer("isVerified", { mode: "boolean" }).default(false).notNull(),
    verificationDate: integer("verificationDate", { mode: "timestamp_ms" }),
    bio: text("bio"),
    certifications: text("certifications", { mode: "json" }).$type<string[]>(),
    availabilityStatus: text("availabilityStatus", {
      enum: ["available", "busy", "unavailable"],
    }).default("available"),
    basePrice: integer("basePrice").default(0),
    locationCity: text("locationCity"),
    locationArea: text("locationArea"),
    fullAddress: text("fullAddress"),
    landmark: text("landmark"),
    pincode: text("pincode"),
    categoryId: integer("categoryId"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("priest_userId_idx").on(table.userId),
  })
);

export const customerProfiles = sqliteTable(
  "customer_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    dateOfBirth: integer("dateOfBirth", { mode: "timestamp_ms" }),
    gotra: text("gotra"),
    nakshatra: text("nakshatra"),
    rashi: text("rashi"),
    preferredLanguage: text("preferredLanguage"),
    totalBookings: integer("totalBookings").default(0),
    lifetimeValue: integer("lifetimeValue").default(0),
    locationCity: text("locationCity"),
    locationArea: text("locationArea"),
    fullAddress: text("fullAddress"),
    landmark: text("landmark"),
    pincode: text("pincode"),
    categoryId: integer("categoryId"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("customer_userId_idx").on(table.userId),
  })
);

export const serviceCategories = sqliteTable("service_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  displayOrder: integer("displayOrder").default(0),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const pujaTypes = sqliteTable(
  "puja_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("categoryId")
      .notNull()
      .references(() => serviceCategories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("shortDescription"),
    fullDescription: text("fullDescription"),
    rituals: text("rituals", { mode: "json" }).$type<
      Array<{ step: number; name: string; description: string }>
    >(),
    estimatedDuration: integer("estimatedDuration").notNull(),
    priestRequirements: text("priestRequirements", { mode: "json" }).$type<{
      minExperience: number;
      specialization: string[];
    }>(),
    basePriceEssential: integer("basePriceEssential").notNull(),
    basePriceStandard: integer("basePriceStandard").notNull(),
    basePricePremium: integer("basePricePremium").notNull(),
    imageUrl: text("imageUrl"),
    videoUrl: text("videoUrl"),
    isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
    popularityScore: integer("popularityScore").default(0),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
  },
  (table) => ({
    categoryIdx: index("category_idx").on(table.categoryId),
    slugIdx: uniqueIndex("slug_idx").on(table.slug),
  })
);

export const samagriItems = sqliteTable("samagri_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  unit: text("unit"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const pujaSamagri = sqliteTable("puja_samagri", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pujaTypeId: integer("pujaTypeId")
    .notNull()
    .references(() => pujaTypes.id),
  samagriItemId: integer("samagriItemId")
    .notNull()
    .references(() => samagriItems.id),
  quantity: real("quantity").notNull(),
  tier: text("tier", { enum: ["essential", "standard", "premium"] }).notNull(),
  isOptional: integer("isOptional", { mode: "boolean" }).default(false),
});

export const temples = sqliteTable("temples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  deity: text("deity"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  contactPhone: text("contactPhone"),
  contactEmail: text("contactEmail"),
  website: text("website"),
  description: text("description"),
  imageUrl: text("imageUrl"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingNumber: text("bookingNumber").notNull().unique(),
    customerId: integer("customerId")
      .notNull()
      .references(() => users.id),
    priestId: integer("priestId").references(() => users.id),
    pujaTypeId: integer("pujaTypeId")
      .notNull()
      .references(() => pujaTypes.id),
    tier: text("tier", { enum: ["essential", "standard", "premium"] }).notNull(),
    bookingDate: integer("bookingDate", { mode: "timestamp_ms" }).notNull(),
    bookingTime: text("bookingTime"),
    location: text("location").notNull(),
    city: text("city"),
    specialInstructions: text("specialInstructions"),
    status: text("status", {
      enum: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "refunded",
      ],
    })
      .default("pending")
      .notNull(),
    totalAmount: integer("totalAmount").notNull(),
    platformFee: integer("platformFee").notNull(),
    priestAmount: integer("priestAmount").notNull(),
    samagriIncluded: integer("samagriIncluded", { mode: "boolean" }).default(true),
    numberOfPeople: integer("numberOfPeople").default(1),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
      .notNull(),
    completedAt: integer("completedAt", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelledAt", { mode: "timestamp_ms" }),
    cancellationReason: text("cancellationReason"),
  },
  (table) => ({
    customerIdx: index("customer_idx").on(table.customerId),
    priestIdx: index("priest_idx").on(table.priestId),
    statusIdx: index("status_idx").on(table.status),
    bookingDateIdx: index("booking_date_idx").on(table.bookingDate),
  })
);

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: integer("bookingId")
    .notNull()
    .references(() => bookings.id),
  transactionId: text("transactionId").unique(),
  paymentMethod: text("paymentMethod"),
  amount: integer("amount").notNull(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed", "refunded"],
  })
    .default("pending")
    .notNull(),
  paymentGateway: text("paymentGateway"),
  gatewayResponse: text("gatewayResponse", { mode: "json" }),
  paidAt: integer("paidAt", { mode: "timestamp_ms" }),
  refundedAt: integer("refundedAt", { mode: "timestamp_ms" }),
  refundAmount: integer("refundAmount"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: integer("bookingId")
    .notNull()
    .references(() => bookings.id),
  customerId: integer("customerId")
    .notNull()
    .references(() => users.id),
  priestId: integer("priestId")
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isPublished: integer("isPublished", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const auspiciousDates = sqliteTable("auspicious_dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  tithi: text("tithi"),
  nakshatra: text("nakshatra"),
  yoga: text("yoga"),
  isAuspicious: integer("isAuspicious", { mode: "boolean" }).default(true),
  recommendedFor: text("recommendedFor", { mode: "json" }).$type<string[]>(),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type"),
  relatedBookingId: integer("relatedBookingId"),
  isRead: integer("isRead", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const categoryMaster = sqliteTable("category_master", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  applicableTo: text("applicableTo"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  displayOrder: integer("displayOrder").default(0),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const locationMaster = sqliteTable("location_master", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode"),
  area: text("area"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
});

export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const smsTemplates = sqliteTable("sms_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  body: text("body").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const otpVerifications = sqliteTable("otp_verifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: integer("bookingId").notNull(),
  phone: text("phone").notNull(),
  otp: text("otp").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  isVerified: integer("isVerified", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('now') * 1000 as integer))`)
    .notNull(),
});

export const tithiCalendar = sqliteTable("tithi_calendar", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  tithiName: text("tithiName"),
  paksha: text("paksha"),
  month: text("month"),
  isShubh: integer("isShubh", { mode: "boolean" }).default(true),
  notes: text("notes"),
});

export const notificationTemplates = sqliteTable("notification_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  channel: text("channel"),
  body: text("body").notNull(),
});

export const languageStrings = sqliteTable("language_strings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull(),
  language: text("language").notNull(),
  value: text("value").notNull(),
});

export const commissionRules = sqliteTable("commission_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  percentage: real("percentage").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
});

export const bookingAnalytics = sqliteTable("booking_analytics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: integer("date", { mode: "timestamp_ms" }),
  totalBookings: integer("totalBookings").default(0),
  revenue: integer("revenue").default(0),
});

export const priestPerformance = sqliteTable("priest_performance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  priestId: integer("priestId"),
  period: text("period"),
  bookingsCompleted: integer("bookingsCompleted").default(0),
  rating: real("rating").default(0),
});

export const customerMetrics = sqliteTable("customer_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customerId"),
  totalSpend: integer("totalSpend").default(0),
});

export const platformKpis = sqliteTable("platform_kpis", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metric: text("metric"),
  value: real("value"),
  period: text("period"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PriestProfile = typeof priestProfiles.$inferSelect;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type PujaType = typeof pujaTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Temple = typeof temples.$inferSelect;
export type SamagriItem = typeof samagriItems.$inferSelect;
export type AuspiciousDate = typeof auspiciousDates.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type CategoryMaster = typeof categoryMaster.$inferSelect;
export type InsertCategoryMaster = typeof categoryMaster.$inferInsert;
export type LocationMaster = typeof locationMaster.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type TithiCalendar = typeof tithiCalendar.$inferSelect;
