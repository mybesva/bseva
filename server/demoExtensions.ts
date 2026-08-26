/**
 * Demo platform extensions: wallets, settings, auth OTP, priest docs, booking extras.
 * Loaded after base SQLite bootstrap.
 */
import type { Client } from "@libsql/client";
import { getClient, getDb, hashPassword } from "./db";

export async function ensureExtendedSchema() {
  const raw = getClient();
  await raw.executeMultiple(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallets (
      userId INTEGER PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balanceAfter INTEGER NOT NULL,
      description TEXT,
      bookingId INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      otp TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'register',
      expiresAt INTEGER NOT NULL,
      isVerified INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS priest_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      docType TEXT NOT NULL,
      fileName TEXT NOT NULL,
      mockUrl TEXT,
      status TEXT NOT NULL DEFAULT 'uploaded',
      createdAt INTEGER NOT NULL
    );
  `);

  // Best-effort column adds for existing DBs
  const alters = [
    "ALTER TABLE priest_profiles ADD COLUMN backupPhone TEXT",
    "ALTER TABLE priest_profiles ADD COLUMN bankAccount TEXT",
    "ALTER TABLE priest_profiles ADD COLUMN bankIfsc TEXT",
    "ALTER TABLE priest_profiles ADD COLUMN bankName TEXT",
    "ALTER TABLE priest_profiles ADD COLUMN profileStatus TEXT DEFAULT 'incomplete'",
    "ALTER TABLE priest_profiles ADD COLUMN latitude REAL",
    "ALTER TABLE priest_profiles ADD COLUMN longitude REAL",
    "ALTER TABLE users ADD COLUMN latitude REAL",
    "ALTER TABLE users ADD COLUMN longitude REAL",
    "ALTER TABLE users ADD COLUMN calendarPref TEXT DEFAULT 'north'",
    "ALTER TABLE bookings ADD COLUMN serviceMode TEXT DEFAULT 'physical'",
    "ALTER TABLE bookings ADD COLUMN gstAmount INTEGER DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN peakFee INTEGER DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN virtualLink TEXT",
    "ALTER TABLE bookings ADD COLUMN calendarType TEXT DEFAULT 'north'",
    "ALTER TABLE puja_types ADD COLUMN virtualAvailable INTEGER DEFAULT 1",
    "ALTER TABLE puja_types ADD COLUMN virtualPriceStandard INTEGER DEFAULT 0",
    "ALTER TABLE puja_types ADD COLUMN virtualPricePremium INTEGER DEFAULT 0",
  ];
  for (const sql of alters) {
    try {
      await raw.execute(sql);
    } catch {
      /* column may already exist */
    }
  }

  await seedPlatformSettings(raw);
  await seedWalletsIfEmpty(raw);
  await enrichPriestLocations(raw);
  await enrichVirtualPrices(raw);
}

async function enrichVirtualPrices(raw: Client) {
  try {
    await raw.execute(`
      UPDATE puja_types SET
        virtualAvailable = 1,
        virtualPriceStandard = CAST(basePriceStandard * 0.85 AS INTEGER),
        virtualPricePremium = CAST(basePricePremium * 0.85 AS INTEGER)
      WHERE virtualPriceStandard IS NULL OR virtualPriceStandard = 0
    `);
  } catch { /* ignore */ }
}

async function seedPlatformSettings(raw: Client) {
  const t = Date.now();
  const defaults: Record<string, string> = {
    gstPercent: "18",
    peakDayFee: "50000", // paise = ₹500
    peakDays: "Saturday,Sunday,Ekadashi,Purnima",
    platformFeePercent: "15",
    virtualPujaEnabled: "true",
    defaultCalendar: "north",
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await raw.execute({
      sql: "SELECT key FROM platform_settings WHERE key = ?",
      args: [key],
    });
    if (!existing.rows.length) {
      await raw.execute({
        sql: "INSERT INTO platform_settings (key, value, updatedAt) VALUES (?, ?, ?)",
        args: [key, value, t],
      });
    }
  }
}

async function seedWalletsIfEmpty(raw: Client) {
  const count = await raw.execute("SELECT COUNT(*) as c FROM wallets");
  if (Number(count.rows[0]?.c || 0) > 0) return;
  const t = Date.now();
  const users = await raw.execute("SELECT id, role FROM users WHERE role IN ('customer','priest')");
  for (const u of users.rows) {
    const balance = u.role === "customer" ? 500000 : 1250000; // ₹5k / ₹12.5k
    await raw.execute({
      sql: "INSERT INTO wallets (userId, balance, updatedAt) VALUES (?, ?, ?)",
      args: [Number(u.id), balance, t],
    });
    await raw.execute({
      sql: `INSERT INTO wallet_transactions (userId, type, amount, balanceAfter, description, createdAt)
            VALUES (?, 'credit', ?, ?, ?, ?)`,
      args: [
        Number(u.id),
        balance,
        balance,
        u.role === "customer" ? "Demo wallet opening balance" : "Demo earnings opening balance",
        t,
      ],
    });
  }
}

async function enrichPriestLocations(raw: Client) {
  // Mock Bangalore-area coordinates for nearby search demo (~within 10 km of Jayanagar)
  const coords: Record<string, [number, number]> = {
    "priest-1": [12.9308, 77.5838], // Jayanagar ~4 km
    "priest-2": [12.9784, 77.6408], // Indiranagar ~5 km
    "priest-3": [12.9716, 77.5946], // near Majestic ~6 km
    "priest-4": [12.9141, 77.6387], // BTM ~3 km
  };
  const users = await raw.execute("SELECT id, openId FROM users WHERE role = 'priest'");
  for (const u of users.rows) {
    const pair = coords[String(u.openId)];
    if (!pair) continue;
    await raw.execute({
      sql: "UPDATE priest_profiles SET latitude = ?, longitude = ?, profileStatus = 'complete' WHERE userId = ?",
      args: [pair[0], pair[1], Number(u.id)],
    });
  }
  // Demo customer near Jayanagar
  await raw.execute({
    sql: "UPDATE users SET latitude = ?, longitude = ? WHERE openId = 'cust-1'",
    args: [12.9352, 77.6245],
  });
}

export async function getSettings(): Promise<Record<string, string>> {
  await getDb();
  const raw = getClient();
  const res = await raw.execute("SELECT key, value FROM platform_settings");
  const out: Record<string, string> = {};
  for (const row of res.rows) out[String(row.key)] = String(row.value);
  return out;
}

export async function setSettings(patch: Record<string, string>) {
  await getDb();
  const raw = getClient();
  const t = Date.now();
  for (const [key, value] of Object.entries(patch)) {
    await raw.execute({
      sql: `INSERT INTO platform_settings (key, value, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      args: [key, value, t],
    });
  }
  return getSettings();
}

export async function getWallet(userId: number) {
  await getDb();
  const raw = getClient();
  let res = await raw.execute({ sql: "SELECT * FROM wallets WHERE userId = ?", args: [userId] });
  if (!res.rows.length) {
    const t = Date.now();
    await raw.execute({
      sql: "INSERT INTO wallets (userId, balance, updatedAt) VALUES (?, 0, ?)",
      args: [userId, t],
    });
    res = await raw.execute({ sql: "SELECT * FROM wallets WHERE userId = ?", args: [userId] });
  }
  const row = res.rows[0];
  const tx = await raw.execute({
    sql: "SELECT * FROM wallet_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50",
    args: [userId],
  });
  return {
    balance: Number(row.balance),
    updatedAt: Number(row.updatedAt),
    transactions: tx.rows.map((t) => ({
      id: Number(t.id),
      type: String(t.type),
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      description: t.description ? String(t.description) : "",
      bookingId: t.bookingId ? Number(t.bookingId) : null,
      createdAt: new Date(Number(t.createdAt)),
    })),
  };
}

export async function creditWallet(userId: number, amount: number, description: string, bookingId?: number) {
  await getDb();
  const raw = getClient();
  const wallet = await getWallet(userId);
  const newBal = wallet.balance + amount;
  const t = Date.now();
  await raw.execute({
    sql: "UPDATE wallets SET balance = ?, updatedAt = ? WHERE userId = ?",
    args: [newBal, t, userId],
  });
  await raw.execute({
    sql: `INSERT INTO wallet_transactions (userId, type, amount, balanceAfter, description, bookingId, createdAt)
          VALUES (?, 'credit', ?, ?, ?, ?, ?)`,
    args: [userId, amount, newBal, description, bookingId ?? null, t],
  });
  return getWallet(userId);
}

export async function debitWallet(userId: number, amount: number, description: string, bookingId?: number) {
  const wallet = await getWallet(userId);
  if (wallet.balance < amount) throw new Error("Insufficient wallet balance");
  await getDb();
  const raw = getClient();
  const newBal = wallet.balance - amount;
  const t = Date.now();
  await raw.execute({
    sql: "UPDATE wallets SET balance = ?, updatedAt = ? WHERE userId = ?",
    args: [newBal, t, userId],
  });
  await raw.execute({
    sql: `INSERT INTO wallet_transactions (userId, type, amount, balanceAfter, description, bookingId, createdAt)
          VALUES (?, 'debit', ?, ?, ?, ?, ?)`,
    args: [userId, amount, newBal, description, bookingId ?? null, t],
  });
  return getWallet(userId);
}

/** Demo OTP — always stores fixed code 123456 for clarity, but verify accepts any 4–6 digit */
export async function sendDemoOtp(phone: string, purpose = "register") {
  await getDb();
  const raw = getClient();
  const otp = "123456";
  const t = Date.now();
  await raw.execute({ sql: "DELETE FROM auth_otps WHERE phone = ? AND purpose = ?", args: [phone, purpose] });
  await raw.execute({
    sql: `INSERT INTO auth_otps (phone, otp, purpose, expiresAt, isVerified, createdAt)
          VALUES (?, ?, ?, ?, 0, ?)`,
    args: [phone, otp, purpose, t + 10 * 60 * 1000, t],
  });
  return { success: true, demoOtp: otp, message: "Demo OTP sent (use 123456 or any 4-6 digits)" };
}

export async function verifyDemoOtp(phone: string, otp: string, purpose = "register") {
  await getDb();
  const raw = getClient();
  if (!/^\d{4,6}$/.test(otp)) return { success: false, message: "Enter a valid 4–6 digit OTP" };
  const res = await raw.execute({
    sql: "SELECT * FROM auth_otps WHERE phone = ? AND purpose = ? ORDER BY createdAt DESC LIMIT 1",
    args: [phone, purpose],
  });
  if (!res.rows.length) return { success: false, message: "Please send OTP first" };
  const row = res.rows[0];
  if (Number(row.expiresAt) < Date.now()) return { success: false, message: "OTP expired" };
  // Demo: accept any OTP matching length OR exact stored
  await raw.execute({
    sql: "UPDATE auth_otps SET isVerified = 1 WHERE id = ?",
    args: [Number(row.id)],
  });
  return { success: true, message: "OTP verified (demo)" };
}

export function isValidIndianPhone(phone: string) {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10)) || /^\+91[6-9]\d{9}$/.test(phone.replace(/\s/g, ""));
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export async function updatePriestOnboarding(
  userId: number,
  data: {
    bio?: string;
    fullAddress?: string;
    locationCity?: string;
    locationArea?: string;
    pincode?: string;
    backupPhone?: string;
    bankAccount?: string;
    bankIfsc?: string;
    bankName?: string;
    latitude?: number;
    longitude?: number;
    languages?: string[];
    specializations?: string[];
    experience?: number;
    documentFileName?: string;
    profileStatus?: string;
  }
) {
  await getDb();
  const raw = getClient();
  const t = Date.now();
  await raw.execute({
    sql: `UPDATE priest_profiles SET
      bio = COALESCE(?, bio),
      fullAddress = COALESCE(?, fullAddress),
      locationCity = COALESCE(?, locationCity),
      locationArea = COALESCE(?, locationArea),
      pincode = COALESCE(?, pincode),
      backupPhone = COALESCE(?, backupPhone),
      bankAccount = COALESCE(?, bankAccount),
      bankIfsc = COALESCE(?, bankIfsc),
      bankName = COALESCE(?, bankName),
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude),
      experience = COALESCE(?, experience),
      languages = COALESCE(?, languages),
      specializations = COALESCE(?, specializations),
      profileStatus = COALESCE(?, profileStatus),
      updatedAt = ?
      WHERE userId = ?`,
    args: [
      data.bio ?? null,
      data.fullAddress ?? null,
      data.locationCity ?? null,
      data.locationArea ?? null,
      data.pincode ?? null,
      data.backupPhone ?? null,
      data.bankAccount ?? null,
      data.bankIfsc ?? null,
      data.bankName ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.experience ?? null,
      data.languages ? JSON.stringify(data.languages) : null,
      data.specializations ? JSON.stringify(data.specializations) : null,
      data.profileStatus ?? null,
      t,
      userId,
    ],
  });
  if (data.documentFileName) {
    await raw.execute({
      sql: `INSERT INTO priest_documents (userId, docType, fileName, mockUrl, status, createdAt)
            VALUES (?, 'identity', ?, ?, 'uploaded', ?)`,
      args: [userId, data.documentFileName, `/demo/uploads/${data.documentFileName}`, t],
    });
  }
  return getPriestOnboarding(userId);
}

export async function getPriestOnboarding(userId: number) {
  await getDb();
  const raw = getClient();
  const profile = await raw.execute({
    sql: "SELECT * FROM priest_profiles WHERE userId = ?",
    args: [userId],
  });
  const docs = await raw.execute({
    sql: "SELECT * FROM priest_documents WHERE userId = ? ORDER BY createdAt DESC",
    args: [userId],
  });
  const p = profile.rows[0] || null;
  const status = String(p?.profileStatus || "incomplete");
  return {
    profile: p
      ? {
          ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v])),
          languages: p.languages ? JSON.parse(String(p.languages)) : [],
          specializations: p.specializations ? JSON.parse(String(p.specializations)) : [],
        }
      : null,
    documents: docs.rows,
    completionSteps: {
      accountCreated: true,
      profileIncomplete: status === "incomplete" || status === "account_created",
      documentsAdded: docs.rows.length > 0 || status === "documents" || status === "complete",
      profileComplete: status === "complete",
    },
    profileStatus: status,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function findNearbyPujaris(opts: {
  customerLat: number;
  customerLng: number;
  radiusKm?: number;
  serviceName?: string;
  customerId?: number;
}) {
  await getDb();
  const raw = getClient();
  const radius = opts.radiusKm ?? 10;
  const priests = await raw.execute(`
    SELECT u.id, u.name, u.phone, u.email, u.city,
           p.latitude, p.longitude, p.specializations, p.availabilityStatus, p.rating, p.locationCity, p.locationArea, p.isVerified
    FROM users u
    JOIN priest_profiles p ON p.userId = u.id
    WHERE u.role = 'priest' AND u.isActive = 1
  `);

  let previousIds = new Set<number>();
  if (opts.customerId) {
    const prev = await raw.execute({
      sql: "SELECT DISTINCT priestId FROM bookings WHERE customerId = ? AND priestId IS NOT NULL",
      args: [opts.customerId],
    });
    previousIds = new Set(prev.rows.map((r) => Number(r.priestId)));
  }

  const results = [];
  for (const row of priests.rows) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!lat || !lng) continue;
    const distanceKm = haversineKm(opts.customerLat, opts.customerLng, lat, lng);
    if (distanceKm > radius) continue;
    let specs: string[] = [];
    try {
      specs = JSON.parse(String(row.specializations || "[]"));
    } catch {
      specs = [];
    }
    const serviceAvailable = opts.serviceName
      ? specs.some((s) => s.toLowerCase().includes(opts.serviceName!.toLowerCase().split(" ")[0])) ||
        specs.length > 0
      : true;
    const availability = String(row.availabilityStatus || "available");
    results.push({
      priestId: Number(row.id),
      name: String(row.name),
      phone: row.phone ? String(row.phone) : "",
      city: String(row.locationCity || row.city || ""),
      area: row.locationArea ? String(row.locationArea) : "",
      distanceKm: Math.round(distanceKm * 10) / 10,
      rating: Number(row.rating || 0),
      isVerified: !!row.isVerified,
      specializations: specs,
      availability,
      serviceAvailable: serviceAvailable && availability === "available",
      serviceStatus: !serviceAvailable
        ? "Not Available"
        : availability === "available"
          ? "Available"
          : availability === "busy"
            ? "Busy"
            : "Unavailable",
      previouslyBooked: previousIds.has(Number(row.id)),
    });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

export async function getPreviouslyBookedPujaris(customerId: number) {
  await getDb();
  const raw = getClient();
  const res = await raw.execute({
    sql: `
      SELECT u.id, u.name, p.availabilityStatus, p.rating, p.locationCity, COUNT(b.id) as bookingCount
      FROM bookings b
      JOIN users u ON u.id = b.priestId
      JOIN priest_profiles p ON p.userId = u.id
      WHERE b.customerId = ? AND b.priestId IS NOT NULL
      GROUP BY u.id
      ORDER BY bookingCount DESC
    `,
    args: [customerId],
  });
  return res.rows.map((r) => ({
    priestId: Number(r.id),
    name: String(r.name),
    availability: String(r.availabilityStatus || "available"),
    rating: Number(r.rating || 0),
    city: r.locationCity ? String(r.locationCity) : "",
    bookingCount: Number(r.bookingCount),
    available: String(r.availabilityStatus) === "available",
  }));
}

// Demo panchangam generator
export function getDemoPanchangam(date: Date, calendarType: "north" | "south" | "lunar") {
  const tithis = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
  ];
  const nakshatras = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
    "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
    "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
    "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
    "Uttara Bhadrapada", "Revati",
  ];
  const yogas = ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma"];
  const karanas = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"];
  const northMonths = ["Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashwin", "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna"];
  const southMonths = ["Chithirai", "Vaikasi", "Aani", "Aadi", "Aavani", "Purattasi", "Aippasi", "Karthigai", "Margazhi", "Thai", "Maasi", "Panguni"];
  const lunarDay = Math.floor(date.getTime() / 86400000) % 30;
  const tithiIndex = lunarDay % 15;
  const paksha = lunarDay < 15 ? "Shukla Paksha" : "Krishna Paksha";
  const monthIdx = date.getMonth() % 12;
  const isPeak =
    date.getDay() === 0 ||
    date.getDay() === 6 ||
    tithiIndex === 10 ||
    tithiIndex === 14;

  return {
    date: date.toISOString(),
    calendarType,
    gregorian: date.toDateString(),
    tithi: tithis[tithiIndex],
    paksha,
    nakshatra: nakshatras[Math.floor(date.getTime() / 86400000) % 27],
    yoga: yogas[date.getDate() % yogas.length],
    karana: karanas[date.getDate() % karanas.length],
    lunarMonth: calendarType === "south" ? southMonths[monthIdx] : northMonths[monthIdx],
    lunarDay: (lunarDay % 15) + 1,
    sunrise: "06:12 AM",
    sunset: "06:38 PM",
    rahukaalam: calendarType === "south" ? "01:30 PM – 03:00 PM" : "07:30 AM – 09:00 AM",
    abhijitMuhurta: "11:48 AM – 12:36 PM",
    isAuspicious: !isPeak || tithiIndex === 10,
    isPeakDay: isPeak,
    notes:
      calendarType === "lunar"
        ? "Demo lunar calendar — tithi-based observance"
        : calendarType === "south"
          ? "South Indian (Tamil) calendar style — demo"
          : "North Indian (Vikram Samvat style) — demo",
  };
}

/** Create booking with GST/peak/virtual extras + wallet payment (demo) */
export async function createDemoBooking(opts: {
  customerId: number;
  priestId?: number | null;
  pujaTypeId: number;
  tier: "standard" | "premium";
  bookingDate: Date;
  bookingTime?: string;
  location: string;
  city?: string;
  specialInstructions?: string;
  serviceMode: "physical" | "virtual";
  calendarType?: string;
  payWithWallet?: boolean;
}) {
  const settings = await getSettings();
  const gstPercent = Number(settings.gstPercent || 18);
  const peakDayFee = Number(settings.peakDayFee || 50000);
  const platformFeePercent = Number(settings.platformFeePercent || 15);

  const raw = getClient();
  const puja = await raw.execute({
    sql: "SELECT * FROM puja_types WHERE id = ?",
    args: [opts.pujaTypeId],
  });
  if (!puja.rows.length) throw new Error("Service not found");
  const p = puja.rows[0];
  let basePrice =
    opts.tier === "premium"
      ? Number(p.basePricePremium || 0)
      : Number(p.basePriceStandard || 0);
  if (opts.serviceMode === "virtual") {
    const vp =
      opts.tier === "premium"
        ? Number(p.virtualPricePremium || 0)
        : Number(p.virtualPriceStandard || 0);
    if (vp > 0) basePrice = vp;
    else basePrice = Math.floor(basePrice * 0.85);
  }

  const panchang = getDemoPanchangam(opts.bookingDate, (opts.calendarType as any) || "north");
  const peakFee = panchang.isPeakDay ? peakDayFee : 0;
  const subtotal = basePrice + peakFee;
  const gstAmount = Math.floor((subtotal * gstPercent) / 100);
  const totalAmount = subtotal + gstAmount;
  const platformFee = Math.floor((basePrice * platformFeePercent) / 100);
  const priestAmount = totalAmount - platformFee;

  const bookingNumber = `BSV-${Date.now().toString(36).toUpperCase()}`;
  const virtualLink =
    opts.serviceMode === "virtual"
      ? `https://meet.bseva.demo/puja/${bookingNumber}`
      : null;
  const t = Date.now();

  const insert = await raw.execute({
    sql: `INSERT INTO bookings (
      bookingNumber, customerId, priestId, pujaTypeId, tier, bookingDate, bookingTime,
      location, city, specialInstructions, status, totalAmount, platformFee, priestAmount,
      samagriIncluded, numberOfPeople, serviceMode, gstAmount, peakFee, virtualLink, calendarType,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      bookingNumber,
      opts.customerId,
      opts.priestId ?? null,
      opts.pujaTypeId,
      opts.tier,
      opts.bookingDate.getTime(),
      opts.bookingTime || null,
      opts.location,
      opts.city || null,
      opts.specialInstructions || null,
      totalAmount,
      platformFee,
      priestAmount,
      opts.serviceMode,
      gstAmount,
      peakFee,
      virtualLink,
      opts.calendarType || "north",
      t,
      t,
    ],
  });
  const bookingId = Number(insert.lastInsertRowid);

  if (opts.payWithWallet !== false) {
    await debitWallet(opts.customerId, totalAmount, `Booking ${bookingNumber}`, bookingId);
    if (opts.priestId) {
      await creditWallet(opts.priestId, priestAmount, `Earnings from ${bookingNumber}`, bookingId);
    }
  }

  await raw.execute({
    sql: `INSERT INTO payments (bookingId, transactionId, paymentMethod, amount, status, paymentGateway, paidAt, createdAt, updatedAt)
          VALUES (?, ?, 'wallet', ?, 'completed', 'demo', ?, ?, ?)`,
    args: [bookingId, `TXN-${bookingNumber}`, totalAmount, t, t, t],
  });

  return {
    id: bookingId,
    bookingNumber,
    totalAmount,
    basePrice,
    peakFee,
    gstPercent,
    gstAmount,
    subtotal,
    platformFee,
    priestAmount,
    virtualLink,
    isPeakDay: panchang.isPeakDay,
    panchang,
  };
}

export async function quoteBookingPrice(opts: {
  pujaTypeId: number;
  tier: "standard" | "premium";
  bookingDate: Date;
  serviceMode: "physical" | "virtual";
  calendarType?: string;
}) {
  const settings = await getSettings();
  const gstPercent = Number(settings.gstPercent || 18);
  const peakDayFee = Number(settings.peakDayFee || 50000);
  const raw = getClient();
  const puja = await raw.execute({
    sql: "SELECT * FROM puja_types WHERE id = ?",
    args: [opts.pujaTypeId],
  });
  if (!puja.rows.length) throw new Error("Service not found");
  const p = puja.rows[0];
  let basePrice =
    opts.tier === "premium"
      ? Number(p.basePricePremium || 0)
      : Number(p.basePriceStandard || 0);
  if (opts.serviceMode === "virtual") {
    const vp =
      opts.tier === "premium"
        ? Number(p.virtualPricePremium || 0)
        : Number(p.virtualPriceStandard || 0);
    if (vp > 0) basePrice = vp;
    else basePrice = Math.floor(basePrice * 0.85);
  }
  const panchang = getDemoPanchangam(opts.bookingDate, (opts.calendarType as any) || "north");
  const peakFee = panchang.isPeakDay ? peakDayFee : 0;
  const subtotal = basePrice + peakFee;
  const gstAmount = Math.floor((subtotal * gstPercent) / 100);
  return {
    basePrice,
    peakFee,
    subtotal,
    gstPercent,
    gstAmount,
    totalAmount: subtotal + gstAmount,
    isPeakDay: panchang.isPeakDay,
    panchang,
    virtualEnabled: settings.virtualPujaEnabled !== "false",
  };
}

export async function setUserCalendarPref(userId: number, pref: string) {
  await getDb();
  getClient().execute({
    sql: "UPDATE users SET calendarPref = ? WHERE id = ?",
    args: [pref, userId],
  });
}

export { hashPassword };
