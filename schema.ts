import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index, uniqueIndex } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * CORE USER MANAGEMENT
 * ============================================================================
 */

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["customer", "priest", "admin"]).default("customer").notNull(),
  profileImage: text("profileImage"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pincode: varchar("pincode", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  phoneIdx: index("phone_idx").on(table.phone),
  roleIdx: index("role_idx").on(table.role),
}));

export const priestProfiles = mysqlTable("priest_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  experience: int("experience").notNull(), // Years of experience
  languages: json("languages").$type<string[]>().notNull(), // ["Hindi", "Sanskrit", "English"]
  specializations: json("specializations").$type<string[]>().notNull(), // Service IDs or names
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalReviews: int("totalReviews").default(0),
  totalBookings: int("totalBookings").default(0),
  isVerified: boolean("isVerified").default(false).notNull(),
  verificationDate: timestamp("verificationDate"),
  bio: text("bio"),
  certifications: json("certifications").$type<string[]>(), // URLs to certificates
  availabilityStatus: mysqlEnum("availabilityStatus", ["available", "busy", "unavailable"]).default("available"),
  basePrice: int("basePrice").default(0), // Base consultation/service fee in paise
  // Location fields
  locationCity: varchar("locationCity", { length: 100 }),
  locationArea: varchar("locationArea", { length: 100 }),
  fullAddress: text("fullAddress"),
  landmark: varchar("landmark", { length: 200 }),
  pincode: varchar("pincode", { length: 10 }),
  categoryId: int("categoryId"), // References category_master
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex("priest_userId_idx").on(table.userId),
  ratingIdx: index("priest_rating_idx").on(table.rating),
  verifiedIdx: index("priest_verified_idx").on(table.isVerified),
  cityIdx: index("priest_city_idx").on(table.locationCity),
  pincodeIdx: index("priest_pincode_idx").on(table.pincode),
}));

export const customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  dateOfBirth: timestamp("dateOfBirth"),
  gotra: varchar("gotra", { length: 100 }),
  nakshatra: varchar("nakshatra", { length: 50 }),
  rashi: varchar("rashi", { length: 50 }),
  preferredLanguage: varchar("preferredLanguage", { length: 50 }),
  totalBookings: int("totalBookings").default(0),
  lifetimeValue: int("lifetimeValue").default(0), // Total spent in paise
  // Location fields
  locationCity: varchar("locationCity", { length: 100 }),
  locationArea: varchar("locationArea", { length: 100 }),
  fullAddress: text("fullAddress"),
  landmark: varchar("landmark", { length: 200 }),
  pincode: varchar("pincode", { length: 10 }),
  categoryId: int("categoryId"), // References category_master
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex("customer_userId_idx").on(table.userId),
  cityIdx: index("customer_city_idx").on(table.locationCity),
  pincodeIdx: index("customer_pincode_idx").on(table.pincode),
}));

/**
 * ============================================================================
 * SERVICES & PUJAS
 * ============================================================================
 */

export const serviceCategories = mysqlTable("service_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // Lucide icon name
  displayOrder: int("displayOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pujaTypes = mysqlTable("puja_types", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull().references(() => serviceCategories.id),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  shortDescription: text("shortDescription"),
  fullDescription: text("fullDescription"),
  rituals: json("rituals").$type<Array<{ step: number; name: string; description: string }>>(),
  estimatedDuration: int("estimatedDuration").notNull(), // in minutes
  priestRequirements: json("priestRequirements").$type<{ minExperience: number; specialization: string[] }>(),
  basePriceEssential: int("basePriceEssential").notNull(), // in paise
  basePriceStandard: int("basePriceStandard").notNull(),
  basePricePremium: int("basePricePremium").notNull(),
  imageUrl: text("imageUrl"),
  videoUrl: text("videoUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  popularityScore: int("popularityScore").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("category_idx").on(table.categoryId),
  slugIdx: uniqueIndex("slug_idx").on(table.slug),
}));

export const samagriItems = mysqlTable("samagri_items", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }), // "Grains", "Flowers", "Oils", etc.
  description: text("description"),
  unit: varchar("unit", { length: 50 }), // "kg", "pieces", "liters"
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pujaSamagri = mysqlTable("puja_samagri", {
  id: int("id").autoincrement().primaryKey(),
  pujaTypeId: int("pujaTypeId").notNull().references(() => pujaTypes.id),
  samagriItemId: int("samagriItemId").notNull().references(() => samagriItems.id),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  tier: mysqlEnum("tier", ["essential", "standard", "premium"]).notNull(),
  isOptional: boolean("isOptional").default(false),
}, (table) => ({
  pujaIdx: index("puja_idx").on(table.pujaTypeId),
  samagriIdx: index("samagri_idx").on(table.samagriItemId),
}));

/**
 * ============================================================================
 * TEMPLES
 * ============================================================================
 */

export const temples = mysqlTable("temples", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  deity: varchar("deity", { length: 100 }),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  pincode: varchar("pincode", { length: 10 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  website: text("website"),
  description: text("description"),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  cityIdx: index("city_idx").on(table.city),
  stateIdx: index("state_idx").on(table.state),
}));

/**
 * ============================================================================
 * BOOKINGS & TRANSACTIONS
 * ============================================================================
 */

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  bookingNumber: varchar("bookingNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").references(() => users.id), // Nullable for guest bookings
  priestId: int("priestId").references(() => users.id),
  pujaTypeId: int("pujaTypeId").notNull().references(() => pujaTypes.id),
  tier: mysqlEnum("tier", ["essential", "standard", "premium"]).notNull(),
  bookingDate: timestamp("bookingDate").notNull(), // When puja is scheduled
  bookingTime: varchar("bookingTime", { length: 20 }), // Time slot
  location: text("location").notNull(), // Customer address or temple
  city: varchar("city", { length: 100 }),
  specialInstructions: text("specialInstructions"),
  status: mysqlEnum("status", ["pending", "confirmed", "in_progress", "completed", "cancelled", "refunded"]).default("pending").notNull(),
  totalAmount: int("totalAmount").notNull(), // in paise
  platformFee: int("platformFee").notNull(), // in paise
  priestAmount: int("priestAmount").notNull(), // in paise
  samagriIncluded: boolean("samagriIncluded").default(true),
  numberOfPeople: int("numberOfPeople").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancellationReason: text("cancellationReason"),
  guestEmail: varchar("guestEmail", { length: 320 }), // For guest checkouts
  guestPhone: varchar("guestPhone", { length: 20 }), // For guest checkouts
  guestName: varchar("guestName", { length: 100 }), // For guest checkouts
  isGuestBooking: boolean("isGuestBooking").default(false),
}, (table) => ({
  customerIdx: index("customer_idx").on(table.customerId),
  priestIdx: index("priest_idx").on(table.priestId),
  statusIdx: index("status_idx").on(table.status),
  bookingDateIdx: index("booking_date_idx").on(table.bookingDate),
  bookingNumberIdx: uniqueIndex("booking_number_idx").on(table.bookingNumber),
  guestEmailIdx: index("guest_email_idx").on(table.guestEmail),
}));

/**
 * Guest bookings tracking table - links guest bookings to eventual user accounts
 */
export const guestBookings = mysqlTable("guest_bookings", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().references(() => bookings.id),
  guestEmail: varchar("guestEmail", { length: 320 }).notNull(),
  guestPhone: varchar("guestPhone", { length: 20 }).notNull(),
  guestName: varchar("guestName", { length: 100 }).notNull(),
  linkedUserId: int("linkedUserId").references(() => users.id), // Set when guest creates account
  verificationToken: varchar("verificationToken", { length: 255 }), // For email verification
  isVerified: boolean("isVerified").default(false),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  bookingIdx: uniqueIndex("guest_booking_idx").on(table.bookingId),
  emailIdx: index("guest_email_idx").on(table.guestEmail),
  phoneIdx: index("guest_phone_idx").on(table.guestPhone),
  linkedUserIdx: index("linked_user_idx").on(table.linkedUserId),
}));

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().references(() => bookings.id),
  transactionId: varchar("transactionId", { length: 100 }).unique(),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // "card", "upi", "netbanking"
  amount: int("amount").notNull(), // in paise
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "refunded"]).default("pending").notNull(),
  paymentGateway: varchar("paymentGateway", { length: 50 }),
  gatewayResponse: json("gatewayResponse"),
  paidAt: timestamp("paidAt"),
  refundedAt: timestamp("refundedAt"),
  refundAmount: int("refundAmount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  bookingIdx: index("booking_idx").on(table.bookingId),
  statusIdx: index("status_idx").on(table.status),
  transactionIdx: uniqueIndex("transaction_idx").on(table.transactionId),
}));

/**
 * ============================================================================
 * REVIEWS & RATINGS
 * ============================================================================
 */

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().references(() => bookings.id),
  customerId: int("customerId").notNull().references(() => users.id),
  priestId: int("priestId").notNull().references(() => users.id),
  rating: int("rating").notNull(), // 1-5
  comment: text("comment"),
  isVerified: boolean("isVerified").default(true), // Verified purchase
  isVisible: boolean("isVisible").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  priestIdx: index("priest_idx").on(table.priestId),
  bookingIdx: uniqueIndex("booking_idx").on(table.bookingId),
  ratingIdx: index("rating_idx").on(table.rating),
}));

/**
 * ============================================================================
 * CONFIGURATION & MASTER DATA
 * ============================================================================
 */

export const auspiciousDates = mysqlTable("auspicious_dates", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  occasion: varchar("occasion", { length: 200 }), // "Akshaya Tritiya", "Diwali", etc.
  muhurtaStart: varchar("muhurtaStart", { length: 20 }),
  muhurtaEnd: varchar("muhurtaEnd", { length: 20 }),
  nakshatra: varchar("nakshatra", { length: 50 }),
  tithi: varchar("tithi", { length: 50 }),
  description: text("description"),
  isHighlyAuspicious: boolean("isHighlyAuspicious").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  dateIdx: index("date_idx").on(table.date),
}));

export const commissionRules = mysqlTable("commission_rules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ruleType: mysqlEnum("ruleType", ["percentage", "fixed", "tiered"]).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(), // Percentage or fixed amount
  minAmount: int("minAmount"), // For tiered rules
  maxAmount: int("maxAmount"),
  applicableTo: mysqlEnum("applicableTo", ["all", "puja_type", "priest_tier"]),
  referenceId: int("referenceId"), // pujaTypeId or priest tier
  isActive: boolean("isActive").default(true).notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  channel: mysqlEnum("channel", ["email", "sms", "push", "in_app"]).notNull(),
  variables: json("variables").$type<string[]>(), // ["customerName", "bookingDate"]
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const languageStrings = mysqlTable("language_strings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 200 }).notNull(),
  language: varchar("language", { length: 10 }).notNull(), // "en", "hi", "ta"
  value: text("value").notNull(),
  category: varchar("category", { length: 100 }), // "ui", "email", "errors"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  keyLangIdx: uniqueIndex("key_lang_idx").on(table.key, table.language),
}));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["booking", "payment", "review", "system", "promotion"]).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  actionUrl: text("actionUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  isReadIdx: index("is_read_idx").on(table.isRead),
}));

/**
 * ============================================================================
 * ANALYTICS & REPORTING
 * ============================================================================
 */

export const bookingAnalytics = mysqlTable("booking_analytics", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  totalBookings: int("totalBookings").default(0),
  completedBookings: int("completedBookings").default(0),
  cancelledBookings: int("cancelledBookings").default(0),
  totalGMV: int("totalGMV").default(0), // Gross Merchandise Value in paise
  totalCommission: int("totalCommission").default(0), // in paise
  averageBookingValue: int("averageBookingValue").default(0),
  newCustomers: int("newCustomers").default(0),
  repeatCustomers: int("repeatCustomers").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  dateIdx: uniqueIndex("date_idx").on(table.date),
}));

export const priestPerformance = mysqlTable("priest_performance", {
  id: int("id").autoincrement().primaryKey(),
  priestId: int("priestId").notNull().references(() => users.id),
  month: varchar("month", { length: 7 }).notNull(), // "2024-01"
  totalBookings: int("totalBookings").default(0),
  completedBookings: int("completedBookings").default(0),
  cancelledBookings: int("cancelledBookings").default(0),
  totalEarnings: int("totalEarnings").default(0), // in paise
  averageRating: decimal("averageRating", { precision: 3, scale: 2 }),
  totalReviews: int("totalReviews").default(0),
  responseTime: int("responseTime").default(0), // Average in minutes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  priestMonthIdx: uniqueIndex("priest_month_idx").on(table.priestId, table.month),
}));

export const customerMetrics = mysqlTable("customer_metrics", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => users.id),
  firstBookingDate: timestamp("firstBookingDate"),
  lastBookingDate: timestamp("lastBookingDate"),
  totalBookings: int("totalBookings").default(0),
  lifetimeValue: int("lifetimeValue").default(0), // in paise
  averageBookingValue: int("averageBookingValue").default(0),
  acquisitionSource: varchar("acquisitionSource", { length: 100 }),
  acquisitionCost: int("acquisitionCost").default(0), // CAC in paise
  retentionStatus: mysqlEnum("retentionStatus", ["active", "at_risk", "churned"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  customerIdx: uniqueIndex("customer_idx").on(table.customerId),
}));

export const platformKPIs = mysqlTable("platform_kpis", {
  id: int("id").autoincrement().primaryKey(),
  month: varchar("month", { length: 7 }).notNull().unique(), // "2024-01"
  totalGMV: int("totalGMV").default(0),
  totalCommission: int("totalCommission").default(0),
  takeRate: decimal("takeRate", { precision: 5, scale: 2 }), // Percentage
  grossMargin: decimal("grossMargin", { precision: 5, scale: 2 }),
  ebitda: int("ebitda").default(0),
  totalActiveCustomers: int("totalActiveCustomers").default(0),
  totalActivePriests: int("totalActivePriests").default(0),
  customerRetentionRate: decimal("customerRetentionRate", { precision: 5, scale: 2 }),
  priestRetentionRate: decimal("priestRetentionRate", { precision: 5, scale: 2 }),
  averageLTV: int("averageLTV").default(0),
  averageCAC: int("averageCAC").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * ============================================================================
 * CATEGORY MASTER & LOCATION DATA
 * ============================================================================
 */

export const categoryMaster = mysqlTable("category_master", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  parentId: int("parentId"), // For hierarchical categories
  applicableTo: mysqlEnum("applicableTo", ["pujari", "customer", "both"]).default("both").notNull(),
  displayOrder: int("displayOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("category_code_idx").on(table.code),
  applicableIdx: index("applicable_idx").on(table.applicableTo),
}));

export const locationMaster = mysqlTable("location_master", {
  id: int("id").autoincrement().primaryKey(),
  city: varchar("city", { length: 100 }).notNull(),
  area: varchar("area", { length: 100 }),
  state: varchar("state", { length: 100 }).notNull(),
  pincode: varchar("pincode", { length: 10 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  isServiceable: boolean("isServiceable").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  cityIdx: index("location_city_idx").on(table.city),
  pincodeIdx: index("location_pincode_idx").on(table.pincode),
}));

/**
 * ============================================================================
 * EMAIL & SMS TEMPLATES
 * ============================================================================
 */

export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  variables: json("variables").$type<string[]>(), // Available template variables
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const smsTemplates = mysqlTable("sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  body: text("body").notNull(),
  variables: json("variables").$type<string[]>(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * ============================================================================
 * OTP VERIFICATION
 * ============================================================================
 */

export const otpVerifications = mysqlTable("otp_verifications", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").references(() => bookings.id),
  phone: varchar("phone", { length: 20 }).notNull(),
  otp: varchar("otp", { length: 6 }).notNull(),
  purpose: mysqlEnum("purpose", ["booking_confirmation", "login", "password_reset"]).notNull(),
  isVerified: boolean("isVerified").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  attempts: int("attempts").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  phoneIdx: index("otp_phone_idx").on(table.phone),
  bookingIdx: index("otp_booking_idx").on(table.bookingId),
}));

/**
 * ============================================================================
 * TITHI (VEDIC CALENDAR) DATA
 * ============================================================================
 */

export const tithiCalendar = mysqlTable("tithi_calendar", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  tithi: varchar("tithi", { length: 50 }).notNull(),
  tithiNumber: int("tithiNumber"), // 1-30
  paksha: mysqlEnum("paksha", ["shukla", "krishna"]), // Bright/Dark fortnight
  nakshatra: varchar("nakshatra", { length: 50 }),
  yoga: varchar("yoga", { length: 50 }),
  karana: varchar("karana", { length: 50 }),
  sunrise: varchar("sunrise", { length: 10 }),
  sunset: varchar("sunset", { length: 10 }),
  moonrise: varchar("moonrise", { length: 10 }),
  isAuspicious: boolean("isAuspicious").default(false),
  festivals: json("festivals").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  dateIdx: uniqueIndex("tithi_date_idx").on(table.date),
}));

/**
 * ============================================================================
 * TYPE EXPORTS
 * ============================================================================
 */

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
