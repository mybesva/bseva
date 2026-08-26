import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, or, desc, asc, gte, lte, sql, like, inArray, ne } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import {
  users,
  priestProfiles,
  customerProfiles,
  serviceCategories,
  pujaTypes,
  samagriItems,
  pujaSamagri,
  temples,
  bookings,
  payments,
  reviews,
  auspiciousDates,
  notifications,
  categoryMaster,
  tithiCalendar,
  otpVerifications,
  type InsertUser,
  type User,
  type Booking,
} from "../drizzle/schema";
import { ACCOUNT_BLOCKED_MSG } from "@shared/const";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "bseva.sqlite");

let client: Client | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let initPromise: Promise<void> | null = null;

export function hashPassword(password: string): string {
  return createHash("sha256").update(`bseva-demo:${password}`).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function getClient() {
  if (!client) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    client = createClient({ url: `file:${DB_PATH}` });
  }
  return client;
}

export { getClient };

export async function getDb() {
  if (!_db) {
    const raw = getClient();
    _db = drizzle(raw, { schema });
    if (!initPromise) initPromise = ensureSchemaAndSeed(raw);
    await initPromise;
    const { ensureExtendedSchema } = await import("./demoExtensions");
    await ensureExtendedSchema();
  }
  return _db;
}

async function ensureSchemaAndSeed(raw: Client) {
  const tableCheck = await raw.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  );
  if (!tableCheck.rows.length) {
    await createAllTables(raw);
  }
  const countRes = await raw.execute("SELECT COUNT(*) as c FROM users");
  const count = Number(countRes.rows[0]?.c ?? 0);
  if (count === 0) {
    await seedDatabase(raw);
  }
}

async function createAllTables(raw: Client) {
  await raw.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      phone TEXT,
      password TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      profileImage TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastSignedIn INTEGER NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      blocked INTEGER NOT NULL DEFAULT 0,
      blockedReason TEXT,
      blockedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS priest_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE REFERENCES users(id),
      experience INTEGER NOT NULL,
      languages TEXT NOT NULL,
      specializations TEXT NOT NULL,
      rating REAL DEFAULT 0,
      totalReviews INTEGER DEFAULT 0,
      totalBookings INTEGER DEFAULT 0,
      isVerified INTEGER NOT NULL DEFAULT 0,
      verificationDate INTEGER,
      bio TEXT,
      certifications TEXT,
      availabilityStatus TEXT DEFAULT 'available',
      basePrice INTEGER DEFAULT 0,
      locationCity TEXT,
      locationArea TEXT,
      fullAddress TEXT,
      landmark TEXT,
      pincode TEXT,
      categoryId INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE REFERENCES users(id),
      dateOfBirth INTEGER,
      gotra TEXT,
      nakshatra TEXT,
      rashi TEXT,
      preferredLanguage TEXT,
      totalBookings INTEGER DEFAULT 0,
      lifetimeValue INTEGER DEFAULT 0,
      locationCity TEXT,
      locationArea TEXT,
      fullAddress TEXT,
      landmark TEXT,
      pincode TEXT,
      categoryId INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      displayOrder INTEGER DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS puja_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryId INTEGER NOT NULL REFERENCES service_categories(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      shortDescription TEXT,
      fullDescription TEXT,
      rituals TEXT,
      estimatedDuration INTEGER NOT NULL,
      priestRequirements TEXT,
      basePriceEssential INTEGER NOT NULL,
      basePriceStandard INTEGER NOT NULL,
      basePricePremium INTEGER NOT NULL,
      imageUrl TEXT,
      videoUrl TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      popularityScore INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS samagri_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      unit TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS puja_samagri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pujaTypeId INTEGER NOT NULL REFERENCES puja_types(id),
      samagriItemId INTEGER NOT NULL REFERENCES samagri_items(id),
      quantity REAL NOT NULL,
      tier TEXT NOT NULL,
      isOptional INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS temples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      deity TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT,
      latitude REAL,
      longitude REAL,
      contactPhone TEXT,
      contactEmail TEXT,
      website TEXT,
      description TEXT,
      imageUrl TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookingNumber TEXT NOT NULL UNIQUE,
      customerId INTEGER NOT NULL REFERENCES users(id),
      priestId INTEGER REFERENCES users(id),
      pujaTypeId INTEGER NOT NULL REFERENCES puja_types(id),
      tier TEXT NOT NULL,
      bookingDate INTEGER NOT NULL,
      bookingTime TEXT,
      location TEXT NOT NULL,
      city TEXT,
      specialInstructions TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      totalAmount INTEGER NOT NULL,
      platformFee INTEGER NOT NULL,
      priestAmount INTEGER NOT NULL,
      samagriIncluded INTEGER DEFAULT 1,
      numberOfPeople INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      completedAt INTEGER,
      cancelledAt INTEGER,
      cancellationReason TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookingId INTEGER NOT NULL REFERENCES bookings(id),
      transactionId TEXT UNIQUE,
      paymentMethod TEXT,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paymentGateway TEXT,
      gatewayResponse TEXT,
      paidAt INTEGER,
      refundedAt INTEGER,
      refundAmount INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookingId INTEGER NOT NULL REFERENCES bookings(id),
      customerId INTEGER NOT NULL REFERENCES users(id),
      priestId INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL,
      comment TEXT,
      isPublished INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auspicious_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date INTEGER NOT NULL,
      tithi TEXT,
      nakshatra TEXT,
      yoga TEXT,
      isAuspicious INTEGER DEFAULT 1,
      recommendedFor TEXT,
      notes TEXT,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT,
      relatedBookingId INTEGER,
      isRead INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS category_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      applicableTo TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      displayOrder INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS location_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT,
      area TEXT,
      isActive INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sms_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookingId INTEGER NOT NULL,
      phone TEXT NOT NULL,
      otp TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      isVerified INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tithi_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date INTEGER NOT NULL,
      tithiName TEXT,
      paksha TEXT,
      month TEXT,
      isShubh INTEGER DEFAULT 1,
      notes TEXT
    );
  `);
  console.log("[SQLite] Tables created");
}

function now() {
  return Date.now();
}

function daysFromNow(days: number) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

async function seedDatabase(raw: Client) {
  const t = now();
  const pwd = hashPassword("password123");

  const usersSeed = [
    ["admin-1", "Admin User", "admin@bseva.com", "+919876543210", "admin", "Bangalore", "Karnataka", "B-Seva HQ"],
    ["cust-1", "Priya Sharma", "customer@bseva.com", "+919800000001", "customer", "Bangalore", "Karnataka", "12 MG Road"],
    ["cust-2", "Rahul Verma", "rahul@example.com", "+919800000002", "customer", "Mumbai", "Maharashtra", "45 Andheri West"],
    ["cust-3", "Ananya Iyer", "ananya@example.com", "+919800000003", "customer", "Chennai", "Tamil Nadu", "8 T Nagar"],
    ["cust-4", "Vikram Patel", "vikram@example.com", "+919800000004", "customer", "Ahmedabad", "Gujarat", "22 CG Road"],
    ["priest-1", "Pandit Sharma Ji", "pujari@bseva.com", "+919900000001", "priest", "Bangalore", "Karnataka", "Jayanagar"],
    ["priest-2", "Acharya Venkatesh", "venkatesh@bseva.com", "+919900000002", "priest", "Bangalore", "Karnataka", "Yelahanka"],
    ["priest-3", "Shastri Iyer", "iyer@bseva.com", "+919900000003", "priest", "Chennai", "Tamil Nadu", "Mylapore"],
    ["priest-4", "Pandit Mishra", "mishra@bseva.com", "+919900000004", "priest", "Mumbai", "Maharashtra", "Dadar"],
  ] as const;

  for (const u of usersSeed) {
    await raw.execute({
      sql: `INSERT INTO users (openId, name, email, phone, password, loginMethod, role, city, state, address, createdAt, updatedAt, lastSignedIn, isActive)
            VALUES (?, ?, ?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [u[0], u[1], u[2], u[3], pwd, u[4], u[5], u[6], u[7], t, t, t],
    });
  }

  const allUsers = await raw.execute("SELECT id, openId, role FROM users");
  const byOpen: Record<string, number> = {};
  for (const row of allUsers.rows) byOpen[String(row.openId)] = Number(row.id);

  const priests = [
    [byOpen["priest-1"], 15, ["Hindi", "Sanskrit", "English"], ["Satyanarayan Puja", "Griha Pravesh", "Wedding"], 4.9, 124, 210, "Senior Vedic priest specializing in household ceremonies.", 250000, "Bangalore", "South", "Jayanagar 4th Block, Bangalore", "560041"],
    [byOpen["priest-2"], 22, ["Kannada", "Telugu", "Sanskrit"], ["Vastu Shanti", "Havan", "Upanayana"], 5.0, 89, 180, "Expert in Vastu and havan rituals.", 300000, "Bangalore", "North", "Yelahanka New Town, Bangalore", "560064"],
    [byOpen["priest-3"], 18, ["Tamil", "English", "Sanskrit"], ["Wedding", "Ganapati Havan", "Ancestral Rituals"], 4.8, 210, 320, "Chennai-based priest for South Indian traditions.", 280000, "Chennai", "Central", "Mylapore, Chennai", "600004"],
    [byOpen["priest-4"], 12, ["Hindi", "Marathi", "Gujarati"], ["Satyanarayan Puja", "Laxmi Puja", "Office Opening"], 4.7, 56, 95, "Mumbai priest for home and office pujas.", 220000, "Mumbai", "Central", "Dadar East, Mumbai", "400014"],
  ] as const;

  for (const p of priests) {
    await raw.execute({
      sql: `INSERT INTO priest_profiles (userId, experience, languages, specializations, rating, totalReviews, totalBookings, isVerified, verificationDate, bio, availabilityStatus, basePrice, locationCity, locationArea, fullAddress, pincode, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?)`,
      args: [p[0], p[1], JSON.stringify(p[2]), JSON.stringify(p[3]), p[4], p[5], p[6], t, p[7], p[8], p[9], p[10], p[11], p[12], t, t],
    });
  }

  const customers = [
    [byOpen["cust-1"], 3, 1500000, "Bangalore", "Central", "12 MG Road", "560001"],
    [byOpen["cust-2"], 1, 450000, "Mumbai", "West", "45 Andheri West", "400053"],
    [byOpen["cust-3"], 2, 900000, "Chennai", "Central", "8 T Nagar", "600017"],
    [byOpen["cust-4"], 0, 0, "Ahmedabad", "West", "22 CG Road", "380009"],
  ] as const;
  for (const c of customers) {
    await raw.execute({
      sql: `INSERT INTO customer_profiles (userId, preferredLanguage, totalBookings, lifetimeValue, locationCity, locationArea, fullAddress, pincode, createdAt, updatedAt)
            VALUES (?, 'English', ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [c[0], c[1], c[2], c[3], c[4], c[5], c[6], t, t],
    });
  }

  const cats = [
    ["Pujas", "puja", "Traditional Vedic pujas", "Flower", 1],
    ["Havans", "havan", "Fire rituals", "Flame", 2],
    ["Ceremonies", "ceremony", "Life ceremonies", "Heart", 3],
    ["Dosha Parihara", "dosha", "Remedial rituals", "Sparkles", 4],
  ] as const;
  for (const c of cats) {
    await raw.execute({
      sql: `INSERT INTO service_categories (name, slug, description, icon, displayOrder, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [c[0], c[1], c[2], c[3], c[4], t, t],
    });
  }
  const catRows = await raw.execute("SELECT id, slug FROM service_categories");
  const catBySlug: Record<string, number> = {};
  for (const row of catRows.rows) catBySlug[String(row.slug)] = Number(row.id);

  const pujas = [
    [catBySlug.puja, "Satyanarayan Puja", "satyanarayan-puja", "Blessings of Lord Vishnu for peace and prosperity.", "Complete Satyanarayan Katha with havan and prasad.", 180, 350000, 550000, 850000, "/images/puja-thali.png", 100],
    [catBySlug.puja, "Griha Pravesh", "griha-pravesh", "House warming ceremony with Vastu Shanti.", "Traditional Griha Pravesh with Navagraha havan.", 240, 500000, 800000, 1200000, "/images/hero-bg.png", 95],
    [catBySlug.havan, "Ganapati Havan", "ganapati-havan", "Fire ritual to remove obstacles.", "Dedicated havan for Lord Ganesha.", 120, 300000, 450000, 700000, "/images/temple-ritual.png", 90],
    [catBySlug.ceremony, "Marriage Ceremony", "marriage-ceremony", "Complete Vedic wedding rituals.", "Kanyadaan, Panigrahana and Saptapadi.", 360, 1500000, 2500000, 4000000, "/images/hero-bg.png", 85],
    [catBySlug.dosha, "Navagraha Shanti", "navagraha-shanti", "Appease the nine planetary deities.", "Remedial puja for planetary doshas.", 150, 400000, 650000, 950000, "/images/meditation.png", 80],
    [catBySlug.ceremony, "Namkaran", "namkaran", "Sacred naming ceremony for newborns.", "Traditional Namkaran sanskar.", 90, 250000, 400000, 600000, "/images/puja-thali.png", 75],
  ] as const;
  for (const p of pujas) {
    await raw.execute({
      sql: `INSERT INTO puja_types (categoryId, name, slug, shortDescription, fullDescription, estimatedDuration, basePriceEssential, basePriceStandard, basePricePremium, imageUrl, isActive, popularityScore, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      args: [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], t, t],
    });
  }

  const pujaRows = await raw.execute("SELECT id, slug FROM puja_types");
  const pujaBySlug: Record<string, number> = {};
  for (const row of pujaRows.rows) pujaBySlug[String(row.slug)] = Number(row.id);

  await raw.execute({
    sql: `INSERT INTO temples (name, deity, address, city, state, pincode, contactPhone, description, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [
      "ISKCON Bangalore", "Krishna", "Rajajinagar", "Bangalore", "Karnataka", "560010", "+918022000000", "Famous Krishna temple", t, t,
      "Kapaleeshwarar Temple", "Shiva", "Mylapore", "Chennai", "Tamil Nadu", "600004", "+914424900000", "Historic Shiva temple", t, t,
    ],
  });

  await raw.execute({
    sql: `INSERT INTO category_master (name, slug, description, applicableTo, isActive, displayOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 1, 1, ?, ?), (?, ?, ?, ?, 1, 1, ?, ?)`,
    args: ["Vedic", "vedic", "Vedic specialists", "pujari", t, t, "Household", "household", "Household customers", "customer", t, t],
  });

  const seedBookings = [
    ["BSV-DEMO0001", byOpen["cust-1"], byOpen["priest-1"], pujaBySlug["satyanarayan-puja"], "standard", daysFromNow(2), "10:00 AM", "12 MG Road, Bangalore", "Bangalore", "Please bring flowers", "confirmed", 550000, 82500, 467500, 8],
    ["BSV-DEMO0002", byOpen["cust-2"], byOpen["priest-4"], pujaBySlug["ganapati-havan"], "essential", daysFromNow(5), "09:00 AM", "45 Andheri West, Mumbai", "Mumbai", null, "pending", 300000, 45000, 255000, 4],
    ["BSV-DEMO0003", byOpen["cust-3"], byOpen["priest-3"], pujaBySlug["griha-pravesh"], "premium", daysFromNow(7), "07:30 AM", "8 T Nagar, Chennai", "Chennai", "New apartment Vastu", "confirmed", 1200000, 180000, 1020000, 12],
    ["BSV-DEMO0004", byOpen["cust-1"], byOpen["priest-1"], pujaBySlug["navagraha-shanti"], "standard", daysFromNow(-3), "11:00 AM", "12 MG Road, Bangalore", "Bangalore", null, "completed", 650000, 97500, 552500, 5],
    ["BSV-DEMO0005", byOpen["cust-2"], byOpen["priest-2"], pujaBySlug["namkaran"], "essential", daysFromNow(1), "04:00 PM", "Yelahanka, Bangalore", "Bangalore", "Baby naming", "in_progress", 250000, 37500, 212500, 15],
    ["BSV-DEMO0006", byOpen["cust-3"], byOpen["priest-1"], pujaBySlug["satyanarayan-puja"], "premium", daysFromNow(10), "06:00 PM", "Whitefield, Bangalore", "Bangalore", "Evening slot preferred", "confirmed", 850000, 127500, 722500, 20],
  ] as const;

  for (const b of seedBookings) {
    await raw.execute({
      sql: `INSERT INTO bookings (bookingNumber, customerId, priestId, pujaTypeId, tier, bookingDate, bookingTime, location, city, specialInstructions, status, totalAmount, platformFee, priestAmount, samagriIncluded, numberOfPeople, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      args: [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], t, t],
    });
  }

  const bookingRows = await raw.execute("SELECT id, bookingNumber, totalAmount, status FROM bookings");
  for (const b of bookingRows.rows) {
    const paid = ["confirmed", "completed", "in_progress"].includes(String(b.status));
    await raw.execute({
      sql: `INSERT INTO payments (bookingId, transactionId, paymentMethod, amount, status, paymentGateway, paidAt, createdAt, updatedAt)
            VALUES (?, ?, 'upi', ?, ?, 'demo', ?, ?, ?)`,
      args: [Number(b.id), `TXN-${b.bookingNumber}`, Number(b.totalAmount), paid ? "completed" : "pending", paid ? t : null, t, t],
    });
  }

  await raw.execute({
    sql: `INSERT INTO reviews (bookingId, customerId, priestId, rating, comment, isPublished, createdAt, updatedAt)
          SELECT id, customerId, priestId, 5, 'Excellent service and very authentic rituals.', 1, ?, ?
          FROM bookings WHERE status = 'completed' LIMIT 1`,
    args: [t, t],
  });

  console.log("[SQLite] Seeded demo data");
  console.log("[SQLite] Demo logins: admin@bseva.com | customer@bseva.com | pujari@bseva.com / password123");
}

export function sanitizeUser<T extends { password?: string | null }>(user: T): Omit<T, "password"> {
  const { password: _p, ...rest } = user;
  return rest;
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function upsertUser(user: InsertUser & { password?: string }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
  const ts = new Date();
  if (existing.length > 0) {
    await db
      .update(users)
      .set({ ...user, updatedAt: ts, lastSignedIn: user.lastSignedIn ?? ts })
      .where(eq(users.openId, user.openId));
  } else {
    await db.insert(users).values({
      ...user,
      createdAt: ts,
      updatedAt: ts,
      lastSignedIn: user.lastSignedIn ?? ts,
    } as any);
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function authenticateWithPassword(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.password) return null;
  if (!verifyPassword(password, user.password)) return null;
  if (user.blocked) {
    const err = new Error("ACCOUNT_BLOCKED");
    (err as any).code = "ACCOUNT_BLOCKED";
    throw err;
  }
  if (!user.isActive) return null;
  await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  return user;
}

export async function setUserBlocked(opts: {
  userId: number;
  blocked: boolean;
  reason?: string | null;
  actorId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (opts.actorId && opts.actorId === opts.userId) {
    throw new Error("You cannot block your own account");
  }
  const target = await getUserById(opts.userId);
  if (!target) throw new Error("User not found");
  await db
    .update(users)
    .set({
      blocked: opts.blocked,
      blockedReason: opts.blocked ? opts.reason || "Blocked by admin (demo)" : null,
      blockedAt: opts.blocked ? new Date() : null,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, opts.userId));
  return getUserById(opts.userId);
}

export async function assertUserNotBlocked(userId: number) {
  const user = await getUserById(userId);
  if (user?.blocked) {
    throw new Error(ACCOUNT_BLOCKED_MSG);
  }
  return user;
}

export async function registerDemoUser(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
  city?: string;
  role: "customer" | "priest";
}): Promise<User> {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw new Error("An account with this email already exists");
  }
  const phoneNorm = input.phone.replace(/\D/g, "").slice(-10);
  const byPhone = await getDb().then(async (db) => {
    if (!db) return undefined;
    const rows = await db.select().from(users).where(eq(users.phone, `+91${phoneNorm}`)).limit(1);
    return rows[0];
  });
  if (byPhone) throw new Error("An account with this phone number already exists");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  const openId = phoneNorm; // phone as primary unique ID for demo
  const result = await db
    .insert(users)
    .values({
      openId,
      name: input.name,
      email: input.email,
      phone: `+91${phoneNorm}`,
      password: hashPassword(input.password),
      role: input.role,
      city: input.city || null,
      loginMethod: "phone",
      createdAt: ts,
      updatedAt: ts,
      lastSignedIn: ts,
      isActive: true,
    } as any)
    .returning();

  const user = result[0];
  if (input.role === "customer") {
    await db.insert(customerProfiles).values({
      userId: user.id,
      preferredLanguage: "English",
      locationCity: input.city || null,
      totalBookings: 0,
      lifetimeValue: 0,
      createdAt: ts,
      updatedAt: ts,
    } as any);
  } else {
    await db.insert(priestProfiles).values({
      userId: user.id,
      experience: 1,
      languages: ["Hindi", "English"],
      specializations: ["General Puja"],
      isVerified: false,
      availabilityStatus: "available",
      locationCity: input.city || null,
      basePrice: 200000,
      rating: 0,
      totalReviews: 0,
      totalBookings: 0,
      createdAt: ts,
      updatedAt: ts,
    } as any);
    // set profileStatus via raw
    try {
      getClient().execute({
        sql: "UPDATE priest_profiles SET profileStatus = 'account_created' WHERE userId = ?",
        args: [user.id],
      });
    } catch { /* ignore */ }
  }
  // Init wallet
  try {
    const { creditWallet } = await import("./demoExtensions");
    await creditWallet(user.id, input.role === "customer" ? 100000 : 0, "Welcome bonus (demo)");
  } catch { /* ignore */ }
  return user;
}

// ============================================================================
// SERVICES
// ============================================================================

export async function getAllServiceCategories() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.isActive, true))
    .orderBy(asc(serviceCategories.displayOrder));
}

export async function getPujaTypesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pujaTypes)
    .where(and(eq(pujaTypes.categoryId, categoryId), eq(pujaTypes.isActive, true)))
    .orderBy(desc(pujaTypes.popularityScore));
}

export async function getPujaTypeBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(pujaTypes).where(eq(pujaTypes.slug, slug)).limit(1);
  return rows[0];
}

export async function getPujaTypeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(pujaTypes).where(eq(pujaTypes.id, id)).limit(1);
  return rows[0];
}

export async function searchPujas(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pujaTypes)
    .where(and(eq(pujaTypes.isActive, true), like(pujaTypes.name, `%${searchTerm}%`)));
}

export async function getSamagriForPuja(pujaTypeId: number, tier: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: pujaSamagri.id,
      quantity: pujaSamagri.quantity,
      tier: pujaSamagri.tier,
      isOptional: pujaSamagri.isOptional,
      item: samagriItems,
    })
    .from(pujaSamagri)
    .innerJoin(samagriItems, eq(pujaSamagri.samagriItemId, samagriItems.id))
    .where(and(eq(pujaSamagri.pujaTypeId, pujaTypeId), eq(pujaSamagri.tier, tier as any)));
}

// ============================================================================
// PRIESTS
// ============================================================================

export async function getAllPriests(filters?: { city?: string; verifiedOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      user: users,
      profile: priestProfiles,
    })
    .from(users)
    .innerJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(and(eq(users.role, "priest"), eq(users.isActive, true)));

  return rows.filter((r) => {
    if (r.user.blocked) return false;
    if (filters?.verifiedOnly && !r.profile.isVerified) return false;
    if (filters?.city && r.profile.locationCity?.toLowerCase() !== filters.city.toLowerCase()) return false;
    return true;
  });
}

export async function getPriestProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(priestProfiles).where(eq(priestProfiles.userId, userId)).limit(1);
  return rows[0];
}

export async function getCustomerProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
  return rows[0];
}

export async function updateCustomerProfile(userId: number, data: Partial<typeof customerProfiles.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db
    .update(customerProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customerProfiles.userId, userId));
  return getCustomerProfile(userId);
}

export async function updatePriestProfile(userId: number, data: Partial<typeof priestProfiles.$inferInsert>) {
  await assertUserNotBlocked(userId);
  const db = await getDb();
  if (!db) return null;
  await db
    .update(priestProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(priestProfiles.userId, userId));
  return getPriestProfile(userId);
}

export async function getReviewsByPriest(priestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reviews)
    .where(and(eq(reviews.priestId, priestId), eq(reviews.isPublished, true)))
    .orderBy(desc(reviews.createdAt));
}

export async function findBestMatchingPujari(city?: string, _state?: string, _pujaTypeId?: number) {
  const db = await getDb();
  if (!db) return null;
  let rows = await db
    .select({ user: users, profile: priestProfiles })
    .from(users)
    .innerJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(
      and(
        eq(users.role, "priest"),
        eq(users.isActive, true),
        eq(priestProfiles.isVerified, true),
        eq(priestProfiles.availabilityStatus, "available")
      )
    )
    .orderBy(desc(priestProfiles.rating));

  rows = rows.filter((r) => !r.user.blocked);

  if (city) {
    const cityMatch = rows.filter(
      (r) => r.profile.locationCity?.toLowerCase() === city.toLowerCase()
    );
    if (cityMatch.length) rows = cityMatch;
  }
  return rows[0] ?? null;
}

export async function getPujariSuggestions(city?: string, state?: string, limit = 3) {
  const db = await getDb();
  if (!db) return [];
  const match = await findBestMatchingPujari(city, state);
  const all = await getAllPriests({ city, verifiedOnly: true });
  const list = all.slice(0, limit);
  if (match && !list.find((x) => x.user.id === match.user.id)) {
    list.unshift(match);
  }
  return list.slice(0, limit);
}

// ============================================================================
// BOOKINGS
// ============================================================================

export async function createBooking(bookingData: typeof bookings.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  const result = await db
    .insert(bookings)
    .values({
      ...bookingData,
      createdAt: ts,
      updatedAt: ts,
    } as any)
    .returning({ id: bookings.id });

  const bookingId = result[0]?.id;
  if (bookingId) {
    await db.insert(payments).values({
      bookingId,
      transactionId: `TXN-${bookingData.bookingNumber}`,
      paymentMethod: "upi",
      amount: bookingData.totalAmount,
      status: "completed",
      paymentGateway: "demo",
      paidAt: ts,
      createdAt: ts,
      updatedAt: ts,
    } as any);

    if (bookingData.priestId) {
      await db.insert(notifications).values({
        userId: bookingData.priestId,
        title: "New Booking Assigned",
        message: `Booking ${bookingData.bookingNumber} has been assigned to you.`,
        type: "booking",
        relatedBookingId: bookingId,
        isRead: false,
        createdAt: ts,
      } as any);
    }
  }
  return { id: bookingId, bookingNumber: bookingData.bookingNumber };
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      booking: bookings,
      pujaType: pujaTypes,
      customer: users,
    })
    .from(bookings)
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(eq(bookings.id, id))
    .limit(1);

  if (!rows[0]) return undefined;
  let priest = null;
  if (rows[0].booking.priestId) {
    priest = await getUserById(rows[0].booking.priestId);
  }
  const payment = await getPaymentByBookingId(id);
  return { ...rows[0], priest, payment };
}

export async function getBookingsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ booking: bookings, pujaType: pujaTypes })
    .from(bookings)
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .where(eq(bookings.customerId, customerId))
    .orderBy(desc(bookings.bookingDate));
}

export async function getBookingsByPriest(priestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      booking: bookings,
      pujaType: pujaTypes,
      customer: users,
    })
    .from(bookings)
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(eq(bookings.priestId, priestId))
    .orderBy(asc(bookings.bookingDate));
}

export async function updateBookingStatus(bookingId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patch: any = { status, updatedAt: new Date() };
  if (status === "completed") patch.completedAt = new Date();
  if (status === "cancelled") patch.cancelledAt = new Date();
  await db.update(bookings).set(patch).where(eq(bookings.id, bookingId));
  return true;
}

// ============================================================================
// PAYMENTS
// ============================================================================

export async function createPayment(data: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  await db.insert(payments).values({ ...data, createdAt: ts, updatedAt: ts } as any);
  return true;
}

export async function getPaymentByBookingId(bookingId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1);
  return rows[0];
}

export async function updatePaymentStatus(paymentId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(payments)
    .set({
      status: status as any,
      updatedAt: new Date(),
      paidAt: status === "completed" ? new Date() : undefined,
    })
    .where(eq(payments.id, paymentId));
  return true;
}

export async function createReview(data: typeof reviews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reviews).values({ ...data, createdAt: new Date(), updatedAt: new Date() } as any);
  return true;
}

// ============================================================================
// TEMPLES / DATES / NOTIFICATIONS
// ============================================================================

export async function getAllTemples(city?: string) {
  const db = await getDb();
  if (!db) return [];
  if (city) {
    return db
      .select()
      .from(temples)
      .where(and(eq(temples.isActive, true), eq(temples.city, city)));
  }
  return db.select().from(temples).where(eq(temples.isActive, true));
}

export async function getTempleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(temples).where(eq(temples.id, id)).limit(1);
  return rows[0];
}

export async function getAuspiciousDates(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auspiciousDates)
    .where(
      and(
        gte(auspiciousDates.date, startDate),
        lte(auspiciousDates.date, endDate)
      )
    );
}

export async function getUserNotifications(userId: number, unreadOnly?: boolean) {
  const db = await getDb();
  if (!db) return [];
  if (unreadOnly) {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notificationId));
}

// ============================================================================
// ADMIN STATS
// ============================================================================

export async function getTotalCustomers() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "customer"));
  return Number(rows[0]?.c ?? 0);
}

export async function getActivePriests() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "priest"), eq(users.isActive, true)));
  return Number(rows[0]?.c ?? 0);
}

export async function getTotalBookings() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ c: sql<number>`count(*)` }).from(bookings);
  return Number(rows[0]?.c ?? 0);
}

export async function getMonthlyRevenue() {
  const db = await getDb();
  if (!db) return 0;
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "completed"), gte(payments.paidAt, start)));
  return Number(rows[0]?.total ?? 0);
}

export async function getRecentBookings(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      booking: bookings,
      pujaType: pujaTypes,
      customer: users,
    })
    .from(bookings)
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);

  return Promise.all(
    rows.map(async (r) => {
      const priest = r.booking.priestId ? await getUserById(r.booking.priestId) : null;
      return {
        id: r.booking.id,
        bookingNumber: r.booking.bookingNumber,
        customerName: r.customer.name,
        priestName: priest?.name ?? "Unassigned",
        service: r.pujaType.name,
        pujaName: r.pujaType.name,
        date: r.booking.bookingDate,
        pujaDate: r.booking.bookingDate,
        status: r.booking.status,
        amount: r.booking.totalAmount,
        totalAmount: r.booking.totalAmount,
      };
    })
  );
}

export async function getTopPriests(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ user: users, profile: priestProfiles })
    .from(users)
    .innerJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(eq(users.role, "priest"))
    .orderBy(desc(priestProfiles.rating))
    .limit(limit);

  return rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    rating: r.profile.rating,
    bookings: r.profile.totalBookings,
    totalBookings: r.profile.totalBookings,
    totalReviews: r.profile.totalReviews,
    city: r.profile.locationCity,
  }));
}

// Admin CRUD (simplified for demo)
export async function adminGetAllCustomers(search?: string, status?: string) {
  const db = await getDb();
  if (!db) return [];
  let rows = await db
    .select({ user: users, profile: customerProfiles })
    .from(users)
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .where(eq(users.role, "customer"));
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.user.name?.toLowerCase().includes(s) ||
        r.user.email?.toLowerCase().includes(s) ||
        r.user.phone?.includes(s)
    );
  }
  if (status === "active") rows = rows.filter((r) => !r.user.blocked);
  if (status === "blocked") rows = rows.filter((r) => r.user.blocked);
  if (status === "inactive") rows = rows.filter((r) => !r.user.isActive);
  return rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    phone: r.user.phone,
    city: r.user.city || r.profile?.locationCity,
    state: r.user.state,
    address: r.user.address || r.profile?.fullAddress,
    isActive: r.user.isActive,
    blocked: !!r.user.blocked,
    blockedReason: r.user.blockedReason || null,
    blockedAt: r.user.blockedAt || null,
    role: r.user.role,
    totalBookings: r.profile?.totalBookings || 0,
    lifetimeValue: r.profile?.lifetimeValue || 0,
    preferredLanguage: r.profile?.preferredLanguage,
  }));
}

export async function adminCreateCustomer(input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  const openId = `cust-${Date.now()}`;
  const result = await db
    .insert(users)
    .values({
      openId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: hashPassword(input.password || "password123"),
      role: "customer",
      city: input.city,
      state: input.state,
      address: input.address,
      loginMethod: "email",
      createdAt: ts,
      updatedAt: ts,
      lastSignedIn: ts,
      isActive: true,
    } as any)
    .returning({ id: users.id });
  const userId = result[0].id;
  await db.insert(customerProfiles).values({
    userId,
    locationCity: input.city,
    fullAddress: input.address,
    preferredLanguage: input.preferredLanguage || "English",
    createdAt: ts,
    updatedAt: ts,
  } as any);
  return { id: userId };
}

export async function adminUpdateCustomer(id: number, input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({
      name: input.name,
      email: input.email,
      phone: input.phone,
      city: input.city,
      state: input.state,
      address: input.address,
      isActive: input.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  return true;
}

export async function adminDeleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
  return true;
}

export async function adminGetAllPriests(search?: string, verified?: boolean, blocked?: boolean) {
  const db = await getDb();
  if (!db) return [];
  let rows = await db
    .select({ user: users, profile: priestProfiles })
    .from(users)
    .innerJoin(priestProfiles, eq(users.id, priestProfiles.userId))
    .where(eq(users.role, "priest"));
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.user.name?.toLowerCase().includes(s) ||
        r.user.email?.toLowerCase().includes(s) ||
        r.profile.locationCity?.toLowerCase().includes(s)
    );
  }
  if (verified === true) rows = rows.filter((r) => r.profile.isVerified);
  if (verified === false) rows = rows.filter((r) => !r.profile.isVerified);
  if (blocked === true) rows = rows.filter((r) => r.user.blocked);
  if (blocked === false) rows = rows.filter((r) => !r.user.blocked);
  return rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    phone: r.user.phone,
    isActive: r.user.isActive,
    blocked: !!r.user.blocked,
    blockedReason: r.user.blockedReason || null,
    blockedAt: r.user.blockedAt || null,
    experience: r.profile.experience,
    languages: r.profile.languages,
    specializations: r.profile.specializations,
    rating: r.profile.rating,
    totalReviews: r.profile.totalReviews,
    totalBookings: r.profile.totalBookings,
    isVerified: r.profile.isVerified,
    bio: r.profile.bio,
    availabilityStatus: r.profile.availabilityStatus,
    basePrice: r.profile.basePrice,
    locationCity: r.profile.locationCity,
    locationArea: r.profile.locationArea,
    fullAddress: r.profile.fullAddress,
    pincode: r.profile.pincode,
  }));
}

export async function adminCreatePriest(input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  const openId = `priest-${Date.now()}`;
  const result = await db
    .insert(users)
    .values({
      openId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: hashPassword(input.password || "password123"),
      role: "priest",
      city: input.locationCity || input.city,
      loginMethod: "email",
      createdAt: ts,
      updatedAt: ts,
      lastSignedIn: ts,
      isActive: true,
    } as any)
    .returning({ id: users.id });
  const userId = result[0].id;
  await db.insert(priestProfiles).values({
    userId,
    experience: input.experience || 5,
    languages: input.languages || ["Hindi", "English"],
    specializations: input.specializations || ["General Puja"],
    isVerified: input.isVerified ?? false,
    bio: input.bio,
    locationCity: input.locationCity,
    locationArea: input.locationArea,
    fullAddress: input.fullAddress,
    pincode: input.pincode,
    basePrice: input.basePrice || 200000,
    createdAt: ts,
    updatedAt: ts,
  } as any);
  return { id: userId };
}

export async function adminUpdatePriest(id: number, input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({
      name: input.name,
      email: input.email,
      phone: input.phone,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  const profilePatch: any = { updatedAt: new Date() };
  if (input.experience != null) profilePatch.experience = input.experience;
  if (input.languages) profilePatch.languages = input.languages;
  if (input.specializations) profilePatch.specializations = input.specializations;
  if (input.isVerified != null) profilePatch.isVerified = input.isVerified;
  if (input.bio != null) profilePatch.bio = input.bio;
  if (input.locationCity) profilePatch.locationCity = input.locationCity;
  if (input.locationArea) profilePatch.locationArea = input.locationArea;
  if (input.fullAddress) profilePatch.fullAddress = input.fullAddress;
  if (input.pincode) profilePatch.pincode = input.pincode;
  if (input.availabilityStatus) profilePatch.availabilityStatus = input.availabilityStatus;
  await db.update(priestProfiles).set(profilePatch).where(eq(priestProfiles.userId, id));
  return true;
}

export async function adminDeletePriest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
  return true;
}

export async function adminGetAllTemples(search?: string) {
  const db = await getDb();
  if (!db) return [];
  let rows = await db.select().from(temples);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(s) || r.city.toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function adminCreateTemple(input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  const result = await db
    .insert(temples)
    .values({ ...input, isActive: true, createdAt: ts, updatedAt: ts } as any)
    .returning({ id: temples.id });
  return { id: result[0].id };
}

export async function adminUpdateTemple(id: number, input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(temples).set({ ...input, updatedAt: new Date() }).where(eq(temples.id, id));
  return true;
}

export async function adminDeleteTemple(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(temples).set({ isActive: false, updatedAt: new Date() }).where(eq(temples.id, id));
  return true;
}

export async function adminGetAllServices(search?: string, categoryId?: number) {
  const db = await getDb();
  if (!db) return [];
  let rows = await db.select().from(pujaTypes);
  if (categoryId) rows = rows.filter((r) => r.categoryId === categoryId);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(s));
  }
  return rows;
}

export async function adminCreateService(input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  const result = await db
    .insert(pujaTypes)
    .values({ ...input, isActive: true, createdAt: ts, updatedAt: ts } as any)
    .returning({ id: pujaTypes.id });
  return { id: result[0].id };
}

export async function adminUpdateService(id: number, input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pujaTypes).set({ ...input, updatedAt: new Date() }).where(eq(pujaTypes.id, id));
  return true;
}

export async function adminDeleteService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pujaTypes).set({ isActive: false, updatedAt: new Date() }).where(eq(pujaTypes.id, id));
  return true;
}

export async function adminGetAllBookings(search?: string, status?: string) {
  const db = await getDb();
  if (!db) return [];
  let rows = await db
    .select({
      booking: bookings,
      pujaType: pujaTypes,
      customer: users,
    })
    .from(bookings)
    .innerJoin(pujaTypes, eq(bookings.pujaTypeId, pujaTypes.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .orderBy(desc(bookings.createdAt));

  if (status) rows = rows.filter((r) => r.booking.status === status);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.booking.bookingNumber.toLowerCase().includes(s) ||
        r.customer.name?.toLowerCase().includes(s) ||
        r.pujaType.name.toLowerCase().includes(s)
    );
  }

  return Promise.all(
    rows.map(async (r) => {
      const priest = r.booking.priestId ? await getUserById(r.booking.priestId) : null;
      const payment = await getPaymentByBookingId(r.booking.id);
      return {
        id: r.booking.id,
        bookingNumber: r.booking.bookingNumber,
        customerId: r.booking.customerId,
        customerName: r.customer.name,
        customerPhone: r.customer.phone,
        customerEmail: r.customer.email,
        priestId: r.booking.priestId,
        priestName: priest?.name ?? "Unassigned",
        pujaTypeId: r.booking.pujaTypeId,
        pujaType: r.pujaType.name,
        bookingDate: r.booking.bookingDate,
        bookingTime: r.booking.bookingTime,
        location: r.booking.location,
        city: r.booking.city,
        tier: r.booking.tier,
        status: r.booking.status,
        totalAmount: r.booking.totalAmount,
        platformFee: r.booking.platformFee,
        priestAmount: r.booking.priestAmount,
        specialInstructions: r.booking.specialInstructions,
        paymentStatus: payment?.status ?? "pending",
        paymentMethod: payment?.paymentMethod,
      };
    })
  );
}

export async function adminUpdateBookingStatus(bookingId: number, status: string) {
  return updateBookingStatus(bookingId, status);
}

// Analytics stubs (return real aggregates from SQLite)
export async function getPujariAnalytics(_dateRange?: string) {
  const priests = await adminGetAllPriests();
  return {
    total: priests.length,
    verified: priests.filter((p: any) => p.isVerified).length,
    avgRating:
      priests.reduce((s: number, p: any) => s + Number(p.rating || 0), 0) / (priests.length || 1),
    list: priests.map((p: any) => ({
      id: p.id,
      name: p.name,
      rating: p.rating,
      bookings: p.totalBookings,
    })),
  };
}

export async function getCustomerAnalytics(_dateRange?: string) {
  const customers = await adminGetAllCustomers();
  return { total: customers.length, list: customers };
}

export async function getTempleAnalytics(_dateRange?: string) {
  const list = await adminGetAllTemples();
  return { total: list.length, list };
}

export async function getServiceAnalytics(_dateRange?: string) {
  const list = await adminGetAllServices();
  return { total: list.length, list };
}

export async function getSamagriAnalytics() {
  return { total: 0, list: [] };
}

export async function getBookingAnalytics(_dateRange?: string) {
  const total = await getTotalBookings();
  const recent = await getRecentBookings(20);
  const byStatus: Record<string, number> = {};
  for (const b of recent) {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
  }
  return { total, byStatus, recent };
}

export async function getPaymentAnalytics(_dateRange?: string) {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, pending: 0 };
  const rows = await db.select().from(payments);
  return {
    total: rows.length,
    completed: rows.filter((p) => p.status === "completed").length,
    pending: rows.filter((p) => p.status === "pending").length,
    revenue: rows.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0),
  };
}

export async function getAllCategories(applicableTo?: string, activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  let rows = await db.select().from(categoryMaster);
  if (activeOnly) rows = rows.filter((r) => r.isActive);
  if (applicableTo) rows = rows.filter((r) => r.applicableTo === applicableTo);
  return rows;
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(categoryMaster).where(eq(categoryMaster.id, id)).limit(1);
  return rows[0];
}

export async function createCategory(input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ts = new Date();
  const result = await db
    .insert(categoryMaster)
    .values({ ...input, createdAt: ts, updatedAt: ts } as any)
    .returning({ id: categoryMaster.id });
  return { id: result[0].id };
}

export async function updateCategory(id: number, input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(categoryMaster)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(categoryMaster.id, id));
  return true;
}

export async function getTithiByDate(date: Date) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(tithiCalendar).where(eq(tithiCalendar.date, date)).limit(1);
  return rows[0];
}

export async function getTithiInRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tithiCalendar)
    .where(and(gte(tithiCalendar.date, startDate), lte(tithiCalendar.date, endDate)));
}

// OTP helpers used by otpService
export async function createOtpRecord(bookingId: number, phone: string, otp: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(otpVerifications).values({
    bookingId,
    phone,
    otp,
    expiresAt,
    isVerified: false,
    createdAt: new Date(),
  } as any);
}

export async function getLatestOtp(bookingId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(otpVerifications)
    .where(eq(otpVerifications.bookingId, bookingId))
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);
  return rows[0];
}

export async function markOtpVerified(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(otpVerifications).set({ isVerified: true }).where(eq(otpVerifications.id, id));
}
