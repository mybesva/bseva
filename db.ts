import { eq, and, or, desc, asc, gte, lte, sql, like, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  priestProfiles, 
  customerProfiles,
  serviceCategories,
  pujaTypes,
  samagriItems,
  pujaSamagri,
  temples,
  bookings,
  guestBookings,
  payments,
  reviews,
  auspiciousDates,
  notifications,
  categoryMaster,
  tithiCalendar,
  emailTemplates,
  smsTemplates,
  otpVerifications,
  type PriestProfile,
  type CustomerProfile,
  type ServiceCategory,
  type PujaType,
  type Booking,
  type Payment,
  type Review,
  type Temple,
  type SamagriItem,
  type AuspiciousDate,
  type Notification,
  type CategoryMaster,
  type TithiCalendar,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * ============================================================================
 * USER MANAGEMENT
 * ============================================================================
 */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "loginMethod", "profileImage", "address", "city", "state", "pincode"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllPriests(filters?: { isVerified?: boolean; availabilityStatus?: string }) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      user: users,
      profile: priestProfiles,
    })
    .from(users)
    .innerJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(eq(users.role, "priest"));

  // Apply filters if provided
  // Note: Additional filtering would require rebuilding the query

  const results = await query;
  return results;
}

export async function getPriestProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(priestProfiles)
    .where(eq(priestProfiles.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getCustomerProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * ============================================================================
 * SERVICES & PUJAS
 * ============================================================================
 */

export async function getAllServiceCategories() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.isActive, true))
    .orderBy(asc(serviceCategories.displayOrder));
}

export async function getPujaTypesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(pujaTypes)
    .where(and(
      eq(pujaTypes.categoryId, categoryId),
      eq(pujaTypes.isActive, true)
    ))
    .orderBy(desc(pujaTypes.popularityScore));
}

export async function getPujaTypeBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(pujaTypes)
    .where(eq(pujaTypes.slug, slug))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getPujaTypeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(pujaTypes)
    .where(eq(pujaTypes.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getSamagriForPuja(pujaTypeId: number, tier: "essential" | "standard" | "premium") {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      samagri: samagriItems,
      quantity: pujaSamagri.quantity,
      isOptional: pujaSamagri.isOptional,
    })
    .from(pujaSamagri)
    .innerJoin(samagriItems, eq(pujaSamagri.samagriItemId, samagriItems.id))
    .where(and(
      eq(pujaSamagri.pujaTypeId, pujaTypeId),
      eq(pujaSamagri.tier, tier)
    ));
}

export async function searchPujas(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(pujaTypes)
    .where(and(
      eq(pujaTypes.isActive, true),
      sql`${pujaTypes.name} LIKE ${`%${searchTerm}%`}`
    ))
    .limit(10);
}

/**
 * ============================================================================
 * BOOKINGS & TRANSACTIONS
 * ============================================================================
 */

export async function createBooking(bookingData: typeof bookings.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(bookings).values(bookingData);
  return result;
}

export async function createGuestBooking(
  bookingId: number,
  guestEmail: string,
  guestPhone: string,
  guestName: string,
  verificationToken: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(guestBookings).values({
    bookingId,
    guestEmail,
    guestPhone,
    guestName,
    verificationToken,
    isVerified: false,
  });
  return result;
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      booking: bookings,
      customer: users,
      pujaType: pujaTypes,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .where(eq(bookings.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getBookingsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      booking: bookings,
      pujaType: pujaTypes,
    })
    .from(bookings)
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .where(eq(bookings.customerId, customerId))
    .orderBy(desc(bookings.createdAt));
}

export async function getBookingsByPriest(priestId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      booking: bookings,
      customer: users,
      pujaType: pujaTypes,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .where(eq(bookings.priestId, priestId))
    .orderBy(desc(bookings.bookingDate));
}

export async function updateBookingStatus(
  bookingId: number, 
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "refunded"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(bookings)
    .set({ status, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

/**
 * ============================================================================
 * PAYMENTS
 * ============================================================================
 */

export async function createPayment(paymentData: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(payments).values(paymentData);
  return result;
}

export async function getPaymentByBookingId(bookingId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updatePaymentStatus(
  paymentId: number,
  status: "pending" | "processing" | "completed" | "failed" | "refunded"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(payments)
    .set({ status, updatedAt: new Date() })
    .where(eq(payments.id, paymentId));
}

/**
 * ============================================================================
 * REVIEWS & RATINGS
 * ============================================================================
 */

export async function createReview(reviewData: typeof reviews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(reviews).values(reviewData);
  
  // Update priest rating
  await updatePriestRating(reviewData.priestId);
  
  return result;
}

export async function getReviewsByPriest(priestId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      review: reviews,
      customer: users,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.customerId, users.id))
    .where(and(
      eq(reviews.priestId, priestId),
      eq(reviews.isVisible, true)
    ))
    .orderBy(desc(reviews.createdAt));
}

async function updatePriestRating(priestId: number) {
  const db = await getDb();
  if (!db) return;

  const reviewStats = await db
    .select({
      avgRating: sql<number>`AVG(${reviews.rating})`,
      totalReviews: sql<number>`COUNT(*)`,
    })
    .from(reviews)
    .where(eq(reviews.priestId, priestId));

  if (reviewStats.length > 0) {
    const { avgRating, totalReviews } = reviewStats[0]!;
    
    await db
      .update(priestProfiles)
      .set({
        rating: avgRating.toFixed(2),
        totalReviews: totalReviews,
        updatedAt: new Date(),
      })
      .where(eq(priestProfiles.userId, priestId));
  }
}

/**
 * ============================================================================
 * TEMPLES
 * ============================================================================
 */

export async function getAllTemples(city?: string) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(temples).where(eq(temples.isActive, true));

  if (city) {
    return await db.select().from(temples).where(and(
      eq(temples.isActive, true),
      eq(temples.city, city)
    ));
  }

  return await query;
}

export async function getTempleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(temples)
    .where(eq(temples.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * ============================================================================
 * AUSPICIOUS DATES
 * ============================================================================
 */

export async function getAuspiciousDates(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(auspiciousDates)
    .where(and(
      gte(auspiciousDates.date, startDate),
      lte(auspiciousDates.date, endDate)
    ))
    .orderBy(asc(auspiciousDates.date));
}

/**
 * ============================================================================
 * NOTIFICATIONS
 * ============================================================================
 */

export async function createNotification(notificationData: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notifications).values(notificationData);
  return result;
}

export async function getUserNotifications(userId: number, unreadOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));

  if (unreadOnly) {
    return await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  return await query.orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId));
}


/**
 * ============================================================================
 * ADMIN DASHBOARD FUNCTIONS
 * ============================================================================
 */

export async function getTotalCustomers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, 'customer'), eq(users.isActive, true)));
  
  return result[0]?.count || 0;
}

export async function getActivePriests(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .innerJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(
      and(
        eq(users.role, 'priest'),
        eq(users.isActive, true),
        eq(priestProfiles.isVerified, true)
      )
    );
  
  return result[0]?.count || 0;
}

export async function getTotalBookings(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings);
  
  return result[0]?.count || 0;
}

export async function getMonthlyRevenue(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ total: sql<number>`sum(${bookings.totalAmount})` })
    .from(bookings)
    .where(
      and(
        sql`MONTH(${bookings.bookingDate}) = MONTH(CURRENT_DATE())`,
        sql`YEAR(${bookings.bookingDate}) = YEAR(CURRENT_DATE())`,
        inArray(bookings.status, ['confirmed', 'completed'])
      )
    );
  
  return result[0]?.total || 0;
}

export async function getRecentBookings(limit: number = 5): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      pujaDate: bookings.bookingDate,
      totalAmount: bookings.totalAmount,
      customerName: sql<string>`${users.name}`,
      pujaName: sql<string>`${pujaTypes.name}`,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);
  
  return result;
}

export async function getTopPriests(limit: number = 5): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      rating: priestProfiles.rating,
      totalReviews: priestProfiles.totalReviews,
      totalBookings: priestProfiles.totalBookings,
    })
    .from(users)
    .innerJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(
      and(
        eq(users.role, 'priest'),
        eq(users.isActive, true),
        eq(priestProfiles.isVerified, true)
      )
    )
    .orderBy(desc(priestProfiles.totalBookings))
    .limit(limit);
  
  return result;
}


/**
 * ============================================================================
 * ADMIN CRUD OPERATIONS
 * ============================================================================
 */

// Customer Management
export async function adminGetAllCustomers(search?: string, status?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(users.role, "customer")];

  if (search) {
    conditions.push(
      sql`(${users.name} LIKE ${`%${search}%`} OR ${users.email} LIKE ${`%${search}%`} OR ${users.phone} LIKE ${`%${search}%`})`
    );
  }

  if (status === "active") {
    conditions.push(eq(users.isActive, true));
  } else if (status === "inactive") {
    conditions.push(eq(users.isActive, false));
  }

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      city: users.city,
      state: users.state,
      pincode: users.pincode,
      gotra: customerProfiles.gotra,
      nakshatra: customerProfiles.nakshatra,
      rashi: customerProfiles.rashi,
      preferredLanguage: customerProfiles.preferredLanguage,
      isActive: users.isActive,
      createdAt: users.createdAt,
      totalBookings: sql<number>`(SELECT COUNT(*) FROM ${bookings} WHERE ${bookings.customerId} = ${users.id})`,
      lifetimeValue: sql<number>`(SELECT COALESCE(SUM(${bookings.totalAmount}), 0) FROM ${bookings} WHERE ${bookings.customerId} = ${users.id})`,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .where(and(...conditions));

  return result;
}

export async function adminCreateCustomer(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // Create user with generated openId
    const openId = `admin-customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const [user] = await tx.insert(users).values({
      openId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      role: "customer",
      isActive: true,
    });

    // Create customer profile
    await tx.insert(customerProfiles).values({
      userId: user.insertId,
      gotra: data.gotra,
      nakshatra: data.nakshatra,
      rashi: data.rashi,
      preferredLanguage: data.preferredLanguage || "Hindi",
    });

    return user;
  });
}

export async function adminUpdateCustomer(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // Update user
    await tx.update(users)
      .set({
        name: data.name,
        email: data.email,
        phone: data.phone,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
      })
      .where(eq(users.id, id));

    // Update customer profile
    await tx.update(customerProfiles)
      .set({
        gotra: data.gotra,
        nakshatra: data.nakshatra,
        rashi: data.rashi,
        preferredLanguage: data.preferredLanguage,
      })
      .where(eq(customerProfiles.userId, id));

    return { success: true };
  });
}

export async function adminDeleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(users).where(eq(users.id, id));
  return { success: true };
}

// Priest Management
export async function adminGetAllPriests(search?: string, verified?: boolean) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(users.role, "priest")];

  if (search) {
    conditions.push(
      sql`(${users.name} LIKE ${`%${search}%`} OR ${users.email} LIKE ${`%${search}%`} OR ${users.phone} LIKE ${`%${search}%`})`
    );
  }

  if (verified !== undefined) {
    conditions.push(eq(priestProfiles.isVerified, verified));
  }

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      city: users.city,
      state: users.state,
      experience: priestProfiles.experience,
      languages: priestProfiles.languages,
      specializations: priestProfiles.specializations,
      bio: priestProfiles.bio,
      basePrice: priestProfiles.basePrice,
      isVerified: priestProfiles.isVerified,
      availabilityStatus: priestProfiles.availabilityStatus,
      rating: priestProfiles.rating,
      totalBookings: sql<number>`(SELECT COUNT(*) FROM ${bookings} WHERE ${bookings.priestId} = ${users.id})`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(and(...conditions));

  return result;
}

export async function adminCreatePriest(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // Create user with generated openId
    const openId = `admin-priest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const [user] = await tx.insert(users).values({
      openId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: "priest",
      isActive: true,
    });

    // Update user with location data
    await tx.update(users)
      .set({
        city: data.city,
        state: data.state,
      })
      .where(eq(users.id, user.insertId));

    // Create priest profile
    await tx.insert(priestProfiles).values({
      userId: user.insertId,
      experience: data.experience,
      languages: data.languages,
      specializations: data.specializations,
      bio: data.bio,
      basePrice: data.basePrice,
      isVerified: false,
      availabilityStatus: "available",
    });

    return user;
  });
}

export async function adminUpdatePriest(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // Update user
    await tx.update(users)
      .set({
        name: data.name,
        email: data.email,
        phone: data.phone,
        city: data.city,
        state: data.state,
      })
      .where(eq(users.id, id));

    // Update priest profile
    const updateData: any = {
      experience: data.experience,
      languages: data.languages,
      specializations: data.specializations,
      bio: data.bio,
      basePrice: data.basePrice,
    };

    if (data.isVerified !== undefined) {
      updateData.isVerified = data.isVerified;
    }

    await tx.update(priestProfiles)
      .set(updateData)
      .where(eq(priestProfiles.userId, id));

    return { success: true };
  });
}

export async function adminDeletePriest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(users).where(eq(users.id, id));
  return { success: true };
}

// Temple Management
export async function adminGetAllTemples(search?: string) {
  const db = await getDb();
  if (!db) return [];

  if (search) {
    return await db.select().from(temples).where(
      sql`(${temples.name} LIKE ${`%${search}%`} OR ${temples.city} LIKE ${`%${search}%`} OR ${temples.deity} LIKE ${`%${search}%`})`
    );
  }

  return await db.select().from(temples);
}

export async function adminCreateTemple(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [temple] = await db.insert(temples).values(data);
  return temple;
}

export async function adminUpdateTemple(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(temples).set(data).where(eq(temples.id, id));
  return { success: true };
}

export async function adminDeleteTemple(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(temples).where(eq(temples.id, id));
  return { success: true };
}

// Service Management
export async function adminGetAllServices(search?: string, categoryId?: number) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [];

  if (search) {
    conditions.push(
      sql`(${pujaTypes.name} LIKE ${`%${search}%`} OR ${pujaTypes.shortDescription} LIKE ${`%${search}%`})`
    );
  }

  if (categoryId) {
    conditions.push(eq(pujaTypes.categoryId, categoryId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      id: pujaTypes.id,
      categoryId: pujaTypes.categoryId,
      categoryName: serviceCategories.name,
      name: pujaTypes.name,
      slug: pujaTypes.slug,
      shortDescription: pujaTypes.shortDescription,
      fullDescription: pujaTypes.fullDescription,
      estimatedDuration: pujaTypes.estimatedDuration,
      basePriceEssential: pujaTypes.basePriceEssential,
      basePriceStandard: pujaTypes.basePriceStandard,
      basePricePremium: pujaTypes.basePricePremium,
      isActive: pujaTypes.isActive,
      createdAt: pujaTypes.createdAt,
    })
    .from(pujaTypes)
    .leftJoin(serviceCategories, eq(pujaTypes.categoryId, serviceCategories.id))
    .where(whereClause);

  return result;
}

export async function adminCreateService(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [service] = await db.insert(pujaTypes).values({
    ...data,
    isActive: true,
  });
  return service;
}

export async function adminUpdateService(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(pujaTypes).set(data).where(eq(pujaTypes.id, id));
  return { success: true };
}

export async function adminDeleteService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(pujaTypes).where(eq(pujaTypes.id, id));
  return { success: true };
}


// Booking Management
export async function adminGetAllBookings(search?: string, status?: string) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      customerName: users.name,
      customerPhone: users.phone,
      pujaType: pujaTypes.name,
      tier: bookings.tier,
      bookingDate: bookings.bookingDate,
      bookingTime: bookings.bookingTime,
      location: bookings.location,
      city: bookings.city,
      status: bookings.status,
      totalAmount: bookings.totalAmount,
      platformFee: bookings.platformFee,
      priestAmount: bookings.priestAmount,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .orderBy(desc(bookings.createdAt));

  if (search) {
    query = query.where(
      sql`(${bookings.bookingNumber} LIKE ${`%${search}%`} OR ${users.name} LIKE ${`%${search}%`} OR ${pujaTypes.name} LIKE ${`%${search}%`})`
    ) as any;
  }

  if (status && status !== "all") {
    query = query.where(eq(bookings.status, status as any)) as any;
  }

  return await query;
}

export async function adminUpdateBookingStatus(bookingId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status, updatedAt: new Date() };
  
  if (status === "completed") {
    updateData.completedAt = new Date();
  } else if (status === "cancelled") {
    updateData.cancelledAt = new Date();
  }

  await db.update(bookings).set(updateData).where(eq(bookings.id, bookingId));
  return { success: true };
}


/**
 * ============================================================================
 * CATEGORY MASTER
 * ============================================================================
 */

export async function getAllCategories(applicableTo?: "pujari" | "customer" | "both", activeOnly: boolean = true) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [];
  
  if (activeOnly) {
    conditions.push(eq(categoryMaster.isActive, true));
  }

  if (applicableTo) {
    conditions.push(
      sql`(${categoryMaster.applicableTo} = ${applicableTo} OR ${categoryMaster.applicableTo} = 'both')`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db
    .select()
    .from(categoryMaster)
    .where(whereClause)
    .orderBy(asc(categoryMaster.displayOrder));
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(categoryMaster)
    .where(eq(categoryMaster.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createCategory(data: {
  name: string;
  code: string;
  description?: string;
  parentId?: number;
  applicableTo: "pujari" | "customer" | "both";
  displayOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [category] = await db.insert(categoryMaster).values({
    ...data,
    isActive: true,
  });
  return category;
}

export async function updateCategory(id: number, data: Partial<{
  name: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(categoryMaster).set(data).where(eq(categoryMaster.id, id));
  return { success: true };
}

/**
 * ============================================================================
 * TITHI CALENDAR
 * ============================================================================
 */

export async function getTithiByDate(date: Date) {
  const db = await getDb();
  if (!db) return undefined;

  // Get the start and end of the day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select()
    .from(tithiCalendar)
    .where(and(
      gte(tithiCalendar.date, startOfDay),
      lte(tithiCalendar.date, endOfDay)
    ))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getTithiInRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tithiCalendar)
    .where(and(
      gte(tithiCalendar.date, startDate),
      lte(tithiCalendar.date, endDate)
    ))
    .orderBy(asc(tithiCalendar.date));
}

/**
 * ============================================================================
 * PROFILE UPDATES WITH LOCATION
 * ============================================================================
 */

export async function updateCustomerProfile(userId: number, data: {
  dateOfBirth?: Date;
  gotra?: string;
  nakshatra?: string;
  rashi?: string;
  preferredLanguage?: string;
  locationCity?: string;
  locationArea?: string;
  fullAddress?: string;
  landmark?: string;
  pincode?: string;
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if profile exists
  const existing = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // Create new profile
    await db.insert(customerProfiles).values({
      userId,
      ...data,
    });
  } else {
    // Update existing profile
    await db.update(customerProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(customerProfiles.userId, userId));
  }

  return { success: true };
}

export async function updatePriestProfile(userId: number, data: {
  experience?: number;
  languages?: string[];
  specializations?: string[];
  bio?: string;
  basePrice?: number;
  locationCity?: string;
  locationArea?: string;
  fullAddress?: string;
  landmark?: string;
  pincode?: string;
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if profile exists
  const existing = await db
    .select()
    .from(priestProfiles)
    .where(eq(priestProfiles.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // Create new profile - need required fields
    await db.insert(priestProfiles).values({
      userId,
      experience: data.experience || 0,
      languages: data.languages || ["Hindi"],
      specializations: data.specializations || [],
      bio: data.bio,
      basePrice: data.basePrice || 0,
      locationCity: data.locationCity,
      locationArea: data.locationArea,
      fullAddress: data.fullAddress,
      landmark: data.landmark,
      pincode: data.pincode,
      categoryId: data.categoryId,
    });
  } else {
    // Update existing profile
    await db.update(priestProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(priestProfiles.userId, userId));
  }

  return { success: true };
}


/**
 * ============================================================================
 * ANALYTICS & REPORTING FUNCTIONS
 * ============================================================================
 */

// Date range helper
function getDateRange(range: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate = new Date();
  
  switch (range) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'last_7_days':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'last_30_days':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'last_90_days':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'this_year':
      startDate = new Date(startDate.getFullYear(), 0, 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }
  
  return { startDate, endDate };
}

// Pujari Analytics
export async function getPujariAnalytics(dateRange: string = 'last_30_days') {
  const db = await getDb();
  if (!db) return [];
  
  const { startDate, endDate } = getDateRange(dateRange);
  
  try {
    const result = await db.select({
      id: priestProfiles.id,
      userId: priestProfiles.userId,
      name: users.name,
      bookings: sql<number>`COUNT(DISTINCT ${bookings.id})`,
      rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
      earnings: sql<number>`COALESCE(SUM(${payments.amount}) * 0.9, 0)`,
      availabilityStatus: priestProfiles.availabilityStatus,
    })
    .from(priestProfiles)
    .leftJoin(users, eq(priestProfiles.userId, users.id))
    .leftJoin(bookings, and(
      eq(bookings.priestId, priestProfiles.id),
      gte(bookings.createdAt, startDate),
      lte(bookings.createdAt, endDate)
    ))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .leftJoin(reviews, eq(reviews.priestId, priestProfiles.id))
    .groupBy(priestProfiles.id, priestProfiles.userId, users.name, priestProfiles.availabilityStatus)
    .orderBy(desc(sql`COUNT(DISTINCT ${bookings.id})`))
    .limit(20);
    
    return result;
  } catch (error) {
    console.error("[Analytics] Error fetching pujari analytics:", error);
    return [];
  }
}

// Customer Analytics
export async function getCustomerAnalytics(dateRange: string = 'last_30_days') {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, newRegistrations: 0, totalBookings: 0, repeatRate: 0, monthlyData: [] };
  
  const { startDate, endDate } = getDateRange(dateRange);
  
  try {
    // Total customers
    const totalResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(customerProfiles);
    const totalCustomers = totalResult[0]?.count || 0;
    
    // New registrations in period
    const newResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(
        gte(users.createdAt, startDate),
        lte(users.createdAt, endDate)
      ));
    const newRegistrations = newResult[0]?.count || 0;
    
    // Total bookings in period
    const bookingsResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bookings)
      .where(and(
        gte(bookings.createdAt, startDate),
        lte(bookings.createdAt, endDate)
      ));
    const totalBookings = bookingsResult[0]?.count || 0;
    
    // Repeat customers (customers with more than 1 booking)
    const repeatResult = await db.select({ 
      customerId: bookings.customerId,
      bookingCount: sql<number>`COUNT(*)`
    })
    .from(bookings)
    .groupBy(bookings.customerId)
    .having(sql`COUNT(*) > 1`);
    
    const repeatRate = totalCustomers > 0 ? Math.round((repeatResult.length / totalCustomers) * 100) : 0;
    
    return {
      totalCustomers,
      newRegistrations,
      totalBookings,
      repeatRate,
      monthlyData: []
    };
  } catch (error) {
    console.error("[Analytics] Error fetching customer analytics:", error);
    return { totalCustomers: 0, newRegistrations: 0, totalBookings: 0, repeatRate: 0, monthlyData: [] };
  }
}

// Temple Analytics
export async function getTempleAnalytics(dateRange: string = 'last_30_days') {
  const db = await getDb();
  if (!db) return [];
  
  const { startDate, endDate } = getDateRange(dateRange);
  
  try {
    // Get temples with booking counts based on city matching
    const result = await db.select({
      id: temples.id,
      name: temples.name,
      city: temples.city,
      bookings: sql<number>`COUNT(DISTINCT ${bookings.id})`,
      revenue: sql<number>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
    })
    .from(temples)
    .leftJoin(bookings, and(
      eq(bookings.city, temples.city),
      gte(bookings.createdAt, startDate),
      lte(bookings.createdAt, endDate)
    ))
    .groupBy(temples.id, temples.name, temples.city)
    .orderBy(desc(sql`COUNT(DISTINCT ${bookings.id})`))
    .limit(10);
    
    return result;
  } catch (error) {
    console.error("[Analytics] Error fetching temple analytics:", error);
    return [];
  }
}

// Service/Puja Analytics
export async function getServiceAnalytics(dateRange: string = 'last_30_days') {
  const db = await getDb();
  if (!db) return [];
  
  const { startDate, endDate } = getDateRange(dateRange);
  
  try {
    const result = await db.select({
      id: pujaTypes.id,
      name: pujaTypes.name,
      bookings: sql<number>`COUNT(DISTINCT ${bookings.id})`,
      revenue: sql<number>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
      avgDuration: pujaTypes.estimatedDuration,
    })
    .from(pujaTypes)
    .leftJoin(bookings, and(
      eq(bookings.pujaTypeId, pujaTypes.id),
      gte(bookings.createdAt, startDate),
      lte(bookings.createdAt, endDate)
    ))
    .groupBy(pujaTypes.id, pujaTypes.name, pujaTypes.estimatedDuration)
    .orderBy(desc(sql`COUNT(DISTINCT ${bookings.id})`))
    .limit(10);
    
    return result;
  } catch (error) {
    console.error("[Analytics] Error fetching service analytics:", error);
    return [];
  }
}

// Samagri Analytics
export async function getSamagriAnalytics() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.select({
      id: samagriItems.id,
      name: samagriItems.name,
      unit: samagriItems.unit,
      // For now, return basic info - consumption would need a separate tracking table
    })
    .from(samagriItems)
    .orderBy(samagriItems.name)
    .limit(20);
    
    // Add mock stock data for now (in production, this would come from inventory table)
    return result.map(item => ({
      ...item,
      stock: Math.floor(Math.random() * 200) + 20,
      consumed: Math.floor(Math.random() * 100) + 10,
      reorderLevel: 50,
      status: Math.random() > 0.7 ? 'Low' : Math.random() > 0.9 ? 'Critical' : 'OK'
    }));
  } catch (error) {
    console.error("[Analytics] Error fetching samagri analytics:", error);
    return [];
  }
}

// Booking Analytics
export async function getBookingAnalytics(dateRange: string = 'last_30_days') {
  const db = await getDb();
  if (!db) return { daily: [], monthly: { total: 0, confirmed: 0, cancelled: 0, pending: 0 } };
  
  const { startDate, endDate } = getDateRange(dateRange);
  
  try {
    // Monthly totals
    const totalResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bookings)
      .where(and(
        gte(bookings.createdAt, startDate),
        lte(bookings.createdAt, endDate)
      ));
    
    const confirmedResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bookings)
      .where(and(
        gte(bookings.createdAt, startDate),
        lte(bookings.createdAt, endDate),
        eq(bookings.status, 'confirmed')
      ));
    
    const cancelledResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bookings)
      .where(and(
        gte(bookings.createdAt, startDate),
        lte(bookings.createdAt, endDate),
        eq(bookings.status, 'cancelled')
      ));
    
    const pendingResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bookings)
      .where(and(
        gte(bookings.createdAt, startDate),
        lte(bookings.createdAt, endDate),
        eq(bookings.status, 'pending')
      ));
    
    // Daily breakdown for last 7 days
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayResult = await db.select({ 
        total: sql<number>`COUNT(*)`,
        confirmed: sql<number>`SUM(CASE WHEN ${bookings.status} = 'confirmed' THEN 1 ELSE 0 END)`,
        cancelled: sql<number>`SUM(CASE WHEN ${bookings.status} = 'cancelled' THEN 1 ELSE 0 END)`,
      })
      .from(bookings)
      .where(and(
        gte(bookings.createdAt, dayStart),
        lte(bookings.createdAt, dayEnd)
      ));
      
      dailyData.push({
        date: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: dayResult[0]?.total || 0,
        confirmed: dayResult[0]?.confirmed || 0,
        cancelled: dayResult[0]?.cancelled || 0,
      });
    }
    
    return {
      daily: dailyData,
      monthly: {
        total: totalResult[0]?.count || 0,
        confirmed: confirmedResult[0]?.count || 0,
        cancelled: cancelledResult[0]?.count || 0,
        pending: pendingResult[0]?.count || 0,
      }
    };
  } catch (error) {
    console.error("[Analytics] Error fetching booking analytics:", error);
    return { daily: [], monthly: { total: 0, confirmed: 0, cancelled: 0, pending: 0 } };
  }
}

// Payment Analytics
export async function getPaymentAnalytics(dateRange: string = 'last_30_days') {
  const db = await getDb();
  if (!db) return { gmv: 0, commissions: 0, priestPayouts: 0, pendingSettlements: 0, refunds: 0, byMethod: [] };
  
  const { startDate, endDate } = getDateRange(dateRange);
  
  try {
    // GMV (Gross Merchandise Value)
    const gmvResult = await db.select({ 
      total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` 
    })
    .from(payments)
    .where(and(
      gte(payments.createdAt, startDate),
      lte(payments.createdAt, endDate),
      eq(payments.status, 'completed')
    ));
    
    const gmv = Number(gmvResult[0]?.total) || 0;
    
    // Platform commissions (10% of GMV - calculated)
    const commissions = Math.round(gmv * 0.10);
    
    // Priest payouts (90% of GMV - calculated)
    const priestPayouts = Math.round(gmv * 0.90);
    
    // Pending settlements
    const pendingResult = await db.select({ 
      total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` 
    })
    .from(payments)
    .where(and(
      gte(payments.createdAt, startDate),
      lte(payments.createdAt, endDate),
      eq(payments.status, 'pending')
    ));
    
    const pendingSettlements = Number(pendingResult[0]?.total) || 0;
    
    // Refunds
    const refundsResult = await db.select({ 
      total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` 
    })
    .from(payments)
    .where(and(
      gte(payments.createdAt, startDate),
      lte(payments.createdAt, endDate),
      eq(payments.status, 'refunded')
    ));
    
    const refunds = Number(refundsResult[0]?.total) || 0;
    
    // Payment method breakdown
    const methodResult = await db.select({ 
      method: payments.paymentMethod,
      amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(
      gte(payments.createdAt, startDate),
      lte(payments.createdAt, endDate),
      eq(payments.status, 'completed')
    ))
    .groupBy(payments.paymentMethod);
    
    const byMethod = methodResult.map(m => ({
      method: m.method || 'Other',
      amount: Number(m.amount) || 0,
      percentage: gmv > 0 ? Math.round((Number(m.amount) / gmv) * 100) : 0
    }));
    
    return {
      gmv,
      commissions,
      priestPayouts,
      pendingSettlements,
      refunds,
      byMethod
    };
  } catch (error) {
    console.error("[Analytics] Error fetching payment analytics:", error);
    return { gmv: 0, commissions: 0, priestPayouts: 0, pendingSettlements: 0, refunds: 0, byMethod: [] };
  }
}

// Auto-assign Pujari based on location
export async function autoAssignPujari(customerCity: string, customerPincode: string, pujaTypeId: number) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Find available priests matching the location
    const matchingPriests = await db.select({
      id: priestProfiles.id,
      userId: priestProfiles.userId,
      name: users.name,
      rating: priestProfiles.rating,
      experience: priestProfiles.experience,
      city: priestProfiles.locationCity,
      pincode: priestProfiles.pincode,
    })
    .from(priestProfiles)
    .leftJoin(users, eq(priestProfiles.userId, users.id))
    .where(and(
      eq(priestProfiles.isVerified, true),
      eq(priestProfiles.availabilityStatus, 'available'),
      or(
        eq(priestProfiles.locationCity, customerCity),
        eq(priestProfiles.pincode, customerPincode)
      )
    ))
    .orderBy(desc(priestProfiles.rating), desc(priestProfiles.experience))
    .limit(1);
    
    if (matchingPriests.length > 0) {
      return matchingPriests[0];
    }
    
    // If no exact match, find any available priest with high rating
    const fallbackPriests = await db.select({
      id: priestProfiles.id,
      userId: priestProfiles.userId,
      name: users.name,
      rating: priestProfiles.rating,
      experience: priestProfiles.experience,
      city: priestProfiles.locationCity,
      pincode: priestProfiles.pincode,
    })
    .from(priestProfiles)
    .leftJoin(users, eq(priestProfiles.userId, users.id))
    .where(and(
      eq(priestProfiles.isVerified, true),
      eq(priestProfiles.availabilityStatus, 'available')
    ))
    .orderBy(desc(priestProfiles.rating), desc(priestProfiles.experience))
    .limit(1);
    
    return fallbackPriests.length > 0 ? fallbackPriests[0] : null;
  } catch (error) {
    console.error("[AutoAssign] Error auto-assigning pujari:", error);
    return null;
  }
}


// ============================================================================
// AUTOMATIC PUJARI ASSIGNMENT
// ============================================================================

/**
 * Find the best matching Pujari based on customer location and availability
 * Matching rules:
 * 1. Same city (highest priority)
 * 2. Same state
 * 3. Available status
 * 4. Rating (higher is better)
 * 5. Experience (more is better)
 */
export async function findBestMatchingPujari(
  customerCity: string,
  customerState?: string,
  pujaTypeId?: number,
  bookingDate?: Date
): Promise<{
  priestId: number;
  priestName: string;
  matchScore: number;
  matchReason: string;
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get all available priests with their profiles
    const priests = await db.select({
      id: priestProfiles.id,
      userId: priestProfiles.userId,
      name: users.name,
      city: priestProfiles.locationCity,
      area: priestProfiles.locationArea,
      experience: priestProfiles.experience,
      rating: priestProfiles.rating,
      availabilityStatus: priestProfiles.availabilityStatus,
      isVerified: priestProfiles.isVerified,
    })
    .from(priestProfiles)
    .innerJoin(users, eq(priestProfiles.userId, users.id))
    .where(
      and(
        eq(priestProfiles.availabilityStatus, 'available'),
        eq(priestProfiles.isVerified, true)
      )
    );

    if (priests.length === 0) {
      // Fallback: get any priest if no available ones
      const anyPriest = await db.select({
        id: priestProfiles.id,
        userId: priestProfiles.userId,
        name: users.name,
        city: priestProfiles.locationCity,
        area: priestProfiles.locationArea,
        experience: priestProfiles.experience,
        rating: priestProfiles.rating,
        availabilityStatus: priestProfiles.availabilityStatus,
      })
      .from(priestProfiles)
      .innerJoin(users, eq(priestProfiles.userId, users.id))
      .limit(1);

      if (anyPriest.length > 0) {
        return {
          priestId: anyPriest[0].id,
          priestName: anyPriest[0].name || 'Assigned Pujari',
          matchScore: 50,
          matchReason: 'Auto-assigned based on availability',
        };
      }
      return null;
    }

    // Score each priest
    const scoredPriests = priests.map(priest => {
      let score = 0;
      let reasons: string[] = [];

      // City match (highest priority - 40 points)
      if (priest.city?.toLowerCase() === customerCity?.toLowerCase()) {
        score += 40;
        reasons.push('Same city');
      }

      // Area match (20 points)
      if (customerState && priest.area?.toLowerCase() === customerState?.toLowerCase()) {
        score += 20;
        reasons.push('Same area');
      }

      // Rating bonus (up to 20 points)
      const ratingScore = Math.min(Number(priest.rating || 0) * 4, 20);
      score += ratingScore;
      if (ratingScore > 15) {
        reasons.push('Highly rated');
      }

      // Experience bonus (up to 20 points)
      const expScore = Math.min((priest.experience || 0) * 2, 20);
      score += expScore;
      if (expScore > 15) {
        reasons.push('Experienced');
      }

      return {
        priestId: priest.id,
        priestName: priest.name || 'Pujari',
        matchScore: score,
        matchReason: reasons.length > 0 ? reasons.join(', ') : 'Available',
      };
    });

    // Sort by score (highest first)
    scoredPriests.sort((a, b) => b.matchScore - a.matchScore);

    return scoredPriests[0];
  } catch (error) {
    console.error("[Auto-Assignment] Error finding matching pujari:", error);
    return null;
  }
}

/**
 * Get multiple Pujari suggestions for a booking
 */
export async function getPujariSuggestions(
  customerCity: string,
  customerState?: string,
  limit: number = 3
): Promise<Array<{
  priestId: number;
  priestName: string;
  matchScore: number;
  matchReason: string;
  rating: number;
  experience: number;
  city: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const priests = await db.select({
      id: priestProfiles.id,
      userId: priestProfiles.userId,
      name: users.name,
      city: priestProfiles.locationCity,
      area: priestProfiles.locationArea,
      experience: priestProfiles.experience,
      rating: priestProfiles.rating,
      availabilityStatus: priestProfiles.availabilityStatus,
      isVerified: priestProfiles.isVerified,
    })
    .from(priestProfiles)
    .innerJoin(users, eq(priestProfiles.userId, users.id))
    .where(eq(priestProfiles.isVerified, true));

    const scoredPriests = priests.map(priest => {
      let score = 0;
      let reasons: string[] = [];

      if (priest.city?.toLowerCase() === customerCity?.toLowerCase()) {
        score += 40;
        reasons.push('Same city');
      }

      if (customerState && priest.area?.toLowerCase() === customerState?.toLowerCase()) {
        score += 20;
        reasons.push('Same area');
      }

      const ratingScore = Math.min(Number(priest.rating || 0) * 4, 20);
      score += ratingScore;

      const expScore = Math.min((priest.experience || 0) * 2, 20);
      score += expScore;

      if (priest.availabilityStatus === 'available') {
        score += 10;
        reasons.push('Available now');
      }

      return {
        priestId: priest.id,
        priestName: priest.name || 'Pujari',
        matchScore: score,
        matchReason: reasons.length > 0 ? reasons.join(', ') : 'Available',
        rating: Number(priest.rating || 0),
        experience: priest.experience || 0,
        city: priest.city || '',
      };
    });

    scoredPriests.sort((a, b) => b.matchScore - a.matchScore);

    return scoredPriests.slice(0, limit);
  } catch (error) {
    console.error("[Auto-Assignment] Error getting pujari suggestions:", error);
    return [];
  }
}
