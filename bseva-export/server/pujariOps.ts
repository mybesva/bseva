import type { Client } from "@libsql/client";
import { getClient, getDb, hashPassword, assertUserNotBlocked } from "./db";
import { cancellationPolicy, inferRequiredLevelFromName } from "@shared/pujariLevels";

async function creditCustomerWallet(userId: number, amount: number, description: string, bookingId?: number) {
  const raw = getClient();
  const t = Date.now();
  const w = await raw.execute({ sql: "SELECT balance FROM wallets WHERE userId = ?", args: [userId] });
  const balance = Number(w.rows[0]?.balance || 0) + amount;
  if (!w.rows.length) {
    await raw.execute({
      sql: "INSERT INTO wallets (userId, balance, updatedAt) VALUES (?, ?, ?)",
      args: [userId, balance, t],
    });
  } else {
    await raw.execute({
      sql: "UPDATE wallets SET balance = ?, updatedAt = ? WHERE userId = ?",
      args: [balance, t, userId],
    });
  }
  await raw.execute({
    sql: `INSERT INTO wallet_transactions (userId, type, amount, balanceAfter, description, bookingId, createdAt)
          VALUES (?, 'credit', ?, ?, ?, ?, ?)`,
    args: [userId, amount, balance, description, bookingId ?? null, t],
  });
}

function hoursUntilBooking(bookingDate: number | string, bookingTime?: string | null) {
  const start = new Date(Number(bookingDate) || bookingDate);
  if (bookingTime) {
    const m = String(bookingTime).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (m) {
      let h = Number(m[1]);
      const min = Number(m[2]);
      const ap = m[3]?.toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
      start.setHours(h, min, 0, 0);
    }
  }
  return (start.getTime() - Date.now()) / (1000 * 60 * 60);
}

export async function quoteCancellation(bookingId: number, userId: number) {
  await getDb();
  const raw = getClient();
  const res = await raw.execute({ sql: "SELECT * FROM bookings WHERE id = ?", args: [bookingId] });
  if (!res.rows.length) throw new Error("Booking not found");
  const b = res.rows[0];
  if (Number(b.customerId) !== userId) throw new Error("Not your booking");
  const status = String(b.status);
  if (["cancelled", "completed", "refunded"].includes(status)) {
    throw new Error("This booking cannot be cancelled");
  }
  const hours = hoursUntilBooking(Number(b.bookingDate), b.bookingTime ? String(b.bookingTime) : null);
  const policy = cancellationPolicy(hours);
  const total = Number(b.totalAmount || 0);
  const fee = policy.allowed ? Math.round((total * policy.feePercent) / 100) : 0;
  const refund = policy.allowed ? total - fee : 0;
  return {
    bookingId,
    bookingNumber: String(b.bookingNumber),
    status,
    hoursRemaining: Math.round(hours * 10) / 10,
    totalAmount: total,
    cancelFee: fee,
    refundAmount: refund,
    ...policy,
  };
}

export async function cancelBookingWithRefund(bookingId: number, userId: number) {
  await assertUserNotBlocked(userId);
  const quote = await quoteCancellation(bookingId, userId);
  if (!quote.allowed) throw new Error(quote.message);
  const raw = getClient();
  const t = Date.now();
  await raw.execute({
    sql: `UPDATE bookings SET status = 'cancelled', cancelledAt = ?, cancellationReason = ?, cancelFee = ?, refundAmount = ?, updatedAt = ? WHERE id = ?`,
    args: [t, `Demo cancel ${quote.window}`, quote.cancelFee, quote.refundAmount, t, bookingId],
  });
  if (quote.refundAmount > 0) {
    await creditCustomerWallet(userId, quote.refundAmount, "Booking Cancellation Refund", bookingId);
  }
  return quote;
}

export async function listPujariVerifications() {
  await getDb();
  const raw = getClient();
  const res = await raw.execute(`
    SELECT u.id, u.name, u.email, u.phone, u.city, u.address,
           p.requestedLevel, p.approvedLevel, p.verificationStatus, p.rejectionReason, p.isVerified,
           p.locationCity, p.locationArea, p.specializations, p.bio, p.experience, p.profileStatus
    FROM users u
    JOIN priest_profiles p ON p.userId = u.id
    WHERE u.role = 'priest'
    ORDER BY u.id
  `);
  const out = [];
  for (const row of res.rows) {
    const docs = await raw.execute({
      sql: "SELECT * FROM priest_documents WHERE userId = ? ORDER BY createdAt DESC",
      args: [Number(row.id)],
    });
    out.push({
      id: Number(row.id),
      name: String(row.name || ""),
      email: row.email ? String(row.email) : "",
      phone: row.phone ? String(row.phone) : "",
      city: String(row.locationCity || row.city || ""),
      area: row.locationArea ? String(row.locationArea) : "",
      address: row.address ? String(row.address) : "",
      bio: row.bio ? String(row.bio) : "",
      experience: Number(row.experience || 0),
      specializations: (() => {
        try {
          return JSON.parse(String(row.specializations || "[]"));
        } catch {
          return [];
        }
      })(),
      requestedLevel: row.requestedLevel ? Number(row.requestedLevel) : null,
      approvedLevel: row.approvedLevel ? Number(row.approvedLevel) : null,
      verificationStatus: String(row.verificationStatus || (row.isVerified ? "approved" : "pending")),
      rejectionReason: row.rejectionReason ? String(row.rejectionReason) : null,
      isVerified: !!row.isVerified,
      documents: docs.rows.map((d) => ({
        id: Number(d.id),
        docType: String(d.docType),
        fileName: String(d.fileName),
        mockUrl: d.mockUrl ? String(d.mockUrl) : "",
        status: String(d.status),
        reviewNote: d.reviewNote ? String(d.reviewNote) : "",
      })),
    });
  }
  return out;
}

export async function reviewPriestDocument(documentId: number, status: "approved" | "rejected", reviewNote?: string) {
  await getDb();
  await getClient().execute({
    sql: "UPDATE priest_documents SET status = ?, reviewNote = ?, reviewedAt = ? WHERE id = ?",
    args: [status, reviewNote || null, Date.now(), documentId],
  });
  return { success: true };
}

export async function setPriestApprovedLevel(
  priestId: number,
  approvedLevel: number | null,
  verificationStatus: string,
  rejectionReason?: string
) {
  await getDb();
  const verified = verificationStatus === "approved" && !!approvedLevel;
  await getClient().execute({
    sql: `UPDATE priest_profiles SET
      approvedLevel = ?, verificationStatus = ?, rejectionReason = ?,
      isVerified = ?, profileStatus = ?, updatedAt = ?
      WHERE userId = ?`,
    args: [
      approvedLevel,
      verificationStatus,
      rejectionReason || null,
      verified ? 1 : 0,
      verified ? "complete" : "pending_verification",
      Date.now(),
      priestId,
    ],
  });
  const list = await listPujariVerifications();
  return list.find((p) => p.id === priestId);
}

export async function setServiceRequiredLevel(pujaTypeId: number, requiredLevel: number) {
  await getDb();
  await getClient().execute({
    sql: "UPDATE puja_types SET requiredLevel = ? WHERE id = ?",
    args: [requiredLevel, pujaTypeId],
  });
  return { success: true };
}

export async function seedPujariLevelsAndDemo(raw: Client) {
  const pujas = await raw.execute("SELECT id, name FROM puja_types");
  for (const row of pujas.rows) {
    const lvl = inferRequiredLevelFromName(String(row.name));
    try {
      await raw.execute({
        sql: "UPDATE puja_types SET requiredLevel = ? WHERE id = ? AND (requiredLevel IS NULL OR requiredLevel = 0)",
        args: [lvl, Number(row.id)],
      });
    } catch {
      /* ignore */
    }
  }

  const priests = await raw.execute(
    "SELECT u.id, u.openId FROM users u JOIN priest_profiles p ON p.userId = u.id WHERE u.role = 'priest' ORDER BY u.id"
  );
  let idx = 0;
  const preset = [4, 3, 2, 1];
  for (const row of priests.rows) {
    const level = preset[idx] || 2;
    idx += 1;
    await raw.execute({
      sql: `UPDATE priest_profiles SET
        requestedLevel = COALESCE(requestedLevel, ?),
        approvedLevel = COALESCE(approvedLevel, ?),
        verificationStatus = COALESCE(NULLIF(verificationStatus, 'incomplete'), 'approved'),
        isVerified = 1
        WHERE userId = ?`,
      args: [level, level, Number(row.id)],
    });
    const docs = await raw.execute({
      sql: "SELECT COUNT(*) as c FROM priest_documents WHERE userId = ?",
      args: [Number(row.id)],
    });
    if (Number(docs.rows[0]?.c || 0) === 0) {
      const t = Date.now();
      await raw.execute({
        sql: `INSERT INTO priest_documents (userId, docType, fileName, mockUrl, status, createdAt)
              VALUES (?, 'certificate', ?, ?, 'approved', ?), (?, 'identity', ?, ?, 'approved', ?)`,
        args: [
          Number(row.id),
          `certificate-${row.id}.pdf`,
          `/demo/uploads/certificate-${row.id}.pdf`,
          t,
          Number(row.id),
          `aadhaar-${row.id}.pdf`,
          `/demo/uploads/aadhaar-${row.id}.pdf`,
          t,
        ],
      });
    }
  }

  const existingPending = await raw.execute("SELECT id FROM users WHERE email = 'pending.pujari@bseva.com'");
  if (!existingPending.rows.length) {
    const t = Date.now();
    const pwd = hashPassword("password123");
    const extras = [
      ["priest-pending", "Pandit Rao (Pending)", "pending.pujari@bseva.com", "+919900000011", 3, 12.9352, 77.6245, "pending"],
      ["priest-rejected", "Acharya Das (Rejected docs)", "rejected.pujari@bseva.com", "+919900000012", 4, 12.9063, 77.5856, "pending"],
      ["priest-l1", "Shastri Kumar (Level 1)", "level1.pujari@bseva.com", "+919900000013", 1, 12.9166, 77.6101, "approved"],
    ] as const;
    for (const e of extras) {
      try {
        await raw.execute({
          sql: `INSERT INTO users (openId, name, email, phone, password, loginMethod, role, city, state, address, isActive, createdAt, updatedAt, lastSignedIn)
                VALUES (?, ?, ?, ?, ?, 'email', 'priest', 'Bangalore', 'Karnataka', 'Demo address', 1, ?, ?, ?)`,
          args: [e[0], e[1], e[2], e[3], pwd, t, t, t],
        });
      } catch {
        continue;
      }
      const u = await raw.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [e[2]] });
      const uid = Number(u.rows[0]?.id);
      if (!uid) continue;
      const approved = e[7] === "approved" ? e[4] : null;
      try {
        await raw.execute({
          sql: `INSERT INTO priest_profiles (userId, experience, languages, specializations, rating, totalReviews, totalBookings, isVerified, bio, availabilityStatus, basePrice, locationCity, locationArea, fullAddress, pincode, latitude, longitude, requestedLevel, approvedLevel, verificationStatus, profileStatus, createdAt, updatedAt)
                VALUES (?, 8, ?, ?, 4.5, 12, 20, ?, 'Demo pujari for level verification.', 'available', 200000, 'Bangalore', 'Jayanagar', 'Jayanagar, Bangalore', '560041', ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            uid,
            JSON.stringify(["Kannada", "English"]),
            JSON.stringify(e[4] === 1 ? ["Vehicle Puja"] : ["Satyanarayan Puja", "Griha Pravesh"]),
            e[7] === "approved" ? 1 : 0,
            e[5],
            e[6],
            e[4],
            approved,
            e[7] === "approved" ? "approved" : "pending",
            e[7] === "approved" ? "complete" : "pending_verification",
            t,
            t,
          ],
        });
      } catch {
        /* profile insert may fail on column mismatch */
      }
      const docStatus = e[2].includes("rejected") ? "rejected" : e[7] === "approved" ? "approved" : "uploaded";
      await raw.execute({
        sql: `INSERT INTO priest_documents (userId, docType, fileName, mockUrl, status, reviewNote, createdAt)
              VALUES (?, 'certificate', ?, ?, ?, ?, ?), (?, 'identity', ?, ?, ?, ?, ?)`,
        args: [
          uid,
          `certificate-${uid}.pdf`,
          `/demo/uploads/certificate-${uid}.pdf`,
          docStatus,
          docStatus === "rejected" ? "Certificate unclear (demo)" : null,
          t,
          uid,
          `id-${uid}.pdf`,
          `/demo/uploads/id-${uid}.pdf`,
          docStatus === "rejected" ? "uploaded" : docStatus,
          null,
          t,
        ],
      });
    }
  }

  const customer = await raw.execute("SELECT id FROM users WHERE role = 'customer' ORDER BY id LIMIT 1");
  const custId = Number(customer.rows[0]?.id || 0);
  const priestId = Number(priests.rows[0]?.id || 0);
  const pujaId = Number(pujas.rows[0]?.id || 0);
  if (custId && priestId && pujaId) {
    const existing = await raw.execute("SELECT id FROM bookings WHERE bookingNumber LIKE 'BSV-CANCEL%'");
    if (!existing.rows.length) {
      const t = Date.now();
      const slots = [
        ["BSV-CANCEL48", 72, "09:00"],
        ["BSV-CANCEL24", 36, "11:00"],
        ["BSV-CANCEL12", 12, "16:00"],
      ] as const;
      for (const s of slots) {
        const when = Date.now() + s[1] * 60 * 60 * 1000;
        await raw.execute({
          sql: `INSERT INTO bookings (bookingNumber, customerId, priestId, pujaTypeId, tier, bookingDate, bookingTime, location, city, status, totalAmount, platformFee, priestAmount, samagriIncluded, numberOfPeople, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, 'standard', ?, ?, 'Jayanagar, Bangalore', 'Bangalore', 'confirmed', 200000, 30000, 170000, 1, 4, ?, ?)`,
          args: [s[0], custId, priestId, pujaId, when, s[2], t, t],
        });
      }
    }
  }
}
