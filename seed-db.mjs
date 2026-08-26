import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema.ts";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log("🌱 Starting database seed...\n");

// Service Categories
console.log("📦 Seeding service categories...");
await db.insert(schema.serviceCategories).values([
  {
    name: "Pujas & Prayers",
    slug: "pujas-prayers",
    description: "Traditional Hindu pujas and prayer ceremonies for various occasions",
    icon: "Flame",
    displayOrder: 1,
    isActive: true,
  },
  {
    name: "Havans & Yagnas",
    slug: "havans-yagnas",
    description: "Sacred fire rituals for spiritual purification and blessings",
    icon: "Sparkles",
    displayOrder: 2,
    isActive: true,
  },
  {
    name: "Life Ceremonies",
    slug: "life-ceremonies",
    description: "Samskaras and milestone celebrations",
    icon: "Heart",
    displayOrder: 3,
    isActive: true,
  },
]);

// Puja Types
console.log("🕉️  Seeding puja types...");
await db.insert(schema.pujaTypes).values([
  {
    categoryId: 1,
    name: "Satyanarayan Puja",
    slug: "satyanarayan-puja",
    shortDescription: "A sacred puja dedicated to Lord Vishnu for prosperity and well-being",
    fullDescription: "Satyanarayan Puja is performed to seek blessings of Lord Vishnu for prosperity, happiness, and fulfillment of wishes. This puja is commonly performed on full moon days and special occasions.",
    rituals: [
      { step: 1, name: "Ganesh Puja", description: "Invoking Lord Ganesha to remove obstacles" },
      { step: 2, name: "Kalash Sthapana", description: "Establishing the sacred pot" },
      { step: 3, name: "Satyanarayan Katha", description: "Recitation of the sacred story" },
      { step: 4, name: "Aarti", description: "Final offering with lamps" },
    ],
    estimatedDuration: 120,
    priestRequirements: { minExperience: 2, specialization: ["Vishnu Puja", "Vedic Rituals"] },
    basePriceEssential: 210000, // ₹2,100
    basePriceStandard: 510000, // ₹5,100
    basePricePremium: 1100000, // ₹11,000
    imageUrl: "/images/puja-thali.png",
    isActive: true,
    popularityScore: 100,
  },
  {
    categoryId: 3,
    name: "Griha Pravesh Puja",
    slug: "griha-pravesh-puja",
    shortDescription: "Housewarming ceremony for entering a new home with divine blessings",
    fullDescription: "Griha Pravesh is performed before entering a new home to purify the space and invoke divine blessings for prosperity, peace, and happiness.",
    rituals: [
      { step: 1, name: "Dwar Puja", description: "Purification of the entrance" },
      { step: 2, name: "Vastu Shanti", description: "Appeasing the Vastu Purusha" },
      { step: 3, name: "Navagraha Havan", description: "Planetary peace ritual" },
      { step: 4, name: "Gau Puja", description: "Welcoming with cow worship" },
    ],
    estimatedDuration: 180,
    priestRequirements: { minExperience: 3, specialization: ["Vastu", "Havan"] },
    basePriceEssential: 510000, // ₹5,100
    basePriceStandard: 1100000, // ₹11,000
    basePricePremium: 2100000, // ₹21,000
    imageUrl: "/images/temple-ritual.png",
    isActive: true,
    popularityScore: 90,
  },
  {
    categoryId: 1,
    name: "Lakshmi Puja",
    slug: "lakshmi-puja",
    shortDescription: "Worship of Goddess Lakshmi for wealth and prosperity",
    fullDescription: "Lakshmi Puja is performed to invoke the blessings of Goddess Lakshmi, the deity of wealth, fortune, and prosperity.",
    rituals: [
      { step: 1, name: "Ganesh Puja", description: "Invoking Lord Ganesha" },
      { step: 2, name: "Lakshmi Invocation", description: "Calling upon Goddess Lakshmi" },
      { step: 3, name: "Shodashopachar Puja", description: "16-step worship" },
      { step: 4, name: "Aarti & Prasad", description: "Final offerings" },
    ],
    estimatedDuration: 90,
    priestRequirements: { minExperience: 2, specialization: ["Lakshmi Puja"] },
    basePriceEssential: 160000, // ₹1,600
    basePriceStandard: 410000, // ₹4,100
    basePricePremium: 810000, // ₹8,100
    imageUrl: "/images/meditation.png",
    isActive: true,
    popularityScore: 85,
  },
]);

// Samagri Items
console.log("🌾 Seeding samagri items...");
await db.insert(schema.samagriItems).values([
  { name: "Rice (Akshat)", category: "Grains", unit: "kg" },
  { name: "Turmeric Powder (Haldi)", category: "Spices", unit: "grams" },
  { name: "Kumkum (Vermillion)", category: "Powders", unit: "grams" },
  { name: "Sandalwood Paste", category: "Pastes", unit: "grams" },
  { name: "Incense Sticks (Agarbatti)", category: "Fragrances", unit: "packets" },
  { name: "Camphor (Kapoor)", category: "Fragrances", unit: "pieces" },
  { name: "Ghee (Clarified Butter)", category: "Oils", unit: "ml" },
  { name: "Coconut", category: "Fruits", unit: "pieces" },
  { name: "Betel Leaves (Paan)", category: "Leaves", unit: "pieces" },
  { name: "Betel Nuts (Supari)", category: "Nuts", unit: "pieces" },
  { name: "Flowers (Mixed)", category: "Flowers", unit: "bunches" },
  { name: "Mango Leaves", category: "Leaves", unit: "bunches" },
  { name: "Sacred Thread (Kalava)", category: "Threads", unit: "meters" },
  { name: "Cotton Wicks", category: "Wicks", unit: "pieces" },
  { name: "Diya (Oil Lamp)", category: "Lamps", unit: "pieces" },
]);

// Puja Samagri Mappings
console.log("🔗 Linking samagri to pujas...");
await db.insert(schema.pujaSamagri).values([
  // Satyanarayan Puja - Essential
  { pujaTypeId: 1, samagriItemId: 1, quantity: "0.5", tier: "essential", isOptional: false },
  { pujaTypeId: 1, samagriItemId: 2, quantity: "50", tier: "essential", isOptional: false },
  { pujaTypeId: 1, samagriItemId: 3, quantity: "25", tier: "essential", isOptional: false },
  { pujaTypeId: 1, samagriItemId: 7, quantity: "200", tier: "essential", isOptional: false },
  { pujaTypeId: 1, samagriItemId: 8, quantity: "1", tier: "essential", isOptional: false },
  
  // Satyanarayan Puja - Standard (includes essential + more)
  { pujaTypeId: 1, samagriItemId: 4, quantity: "50", tier: "standard", isOptional: false },
  { pujaTypeId: 1, samagriItemId: 5, quantity: "2", tier: "standard", isOptional: false },
  { pujaTypeId: 1, samagriItemId: 11, quantity: "2", tier: "standard", isOptional: false },
  
  // Griha Pravesh - Essential
  { pujaTypeId: 2, samagriItemId: 1, quantity: "1", tier: "essential", isOptional: false },
  { pujaTypeId: 2, samagriItemId: 7, quantity: "500", tier: "essential", isOptional: false },
  { pujaTypeId: 2, samagriItemId: 8, quantity: "2", tier: "essential", isOptional: false },
  { pujaTypeId: 2, samagriItemId: 12, quantity: "1", tier: "essential", isOptional: false },
]);

// Sample Priests
console.log("👨‍🦳 Seeding priest profiles...");
// Note: These are sample priests for demonstration. In production, priests would register themselves.

// Sample Temples
console.log("🛕 Seeding temples...");
await db.insert(schema.temples).values([
  {
    name: "ISKCON Temple",
    deity: "Krishna",
    address: "Hare Krishna Hill, Chord Road",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560010",
    contactPhone: "+91-80-23471956",
    contactEmail: "info@iskconbangalore.org",
    website: "https://www.iskconbangalore.org",
    description: "One of the largest ISKCON temples in the world, dedicated to Lord Krishna",
    isActive: true,
  },
  {
    name: "Tirupati Balaji Temple",
    deity: "Venkateswara",
    address: "Tirumala Hills",
    city: "Tirupati",
    state: "Andhra Pradesh",
    pincode: "517504",
    contactPhone: "+91-877-2277777",
    description: "One of the most visited and richest temples in the world",
    isActive: true,
  },
]);

// Auspicious Dates for next 3 months
console.log("📅 Seeding auspicious dates...");
const today = new Date();
await db.insert(schema.auspiciousDates).values([
  {
    date: new Date(2024, 11, 15), // Dec 15, 2024
    occasion: "Margashirsha Purnima",
    muhurtaStart: "06:30",
    muhurtaEnd: "08:45",
    nakshatra: "Rohini",
    tithi: "Purnima",
    description: "Highly auspicious for all ceremonies",
    isHighlyAuspicious: true,
  },
  {
    date: new Date(2025, 0, 1), // Jan 1, 2025
    occasion: "New Year",
    muhurtaStart: "07:00",
    muhurtaEnd: "09:00",
    nakshatra: "Pushya",
    tithi: "Shukla Pratipada",
    description: "Auspicious for new beginnings",
    isHighlyAuspicious: false,
  },
  {
    date: new Date(2025, 0, 13), // Jan 13, 2025
    occasion: "Makar Sankranti",
    muhurtaStart: "07:15",
    muhurtaEnd: "12:30",
    nakshatra: "Uttara Ashadha",
    tithi: "Amavasya",
    description: "Highly auspicious for Griha Pravesh and donations",
    isHighlyAuspicious: true,
  },
]);

// Notification Templates
console.log("📧 Seeding notification templates...");
await db.insert(schema.notificationTemplates).values([
  {
    code: "BOOKING_CONFIRMED",
    name: "Booking Confirmation",
    subject: "Your booking has been confirmed - {{bookingNumber}}",
    body: "Dear {{customerName}}, your booking for {{pujaName}} on {{bookingDate}} has been confirmed. Booking Number: {{bookingNumber}}",
    channel: "email",
    variables: ["customerName", "pujaName", "bookingDate", "bookingNumber"],
    isActive: true,
  },
  {
    code: "PAYMENT_SUCCESS",
    name: "Payment Successful",
    subject: "Payment received for booking {{bookingNumber}}",
    body: "Thank you {{customerName}}! We have received your payment of ₹{{amount}} for booking {{bookingNumber}}.",
    channel: "sms",
    variables: ["customerName", "amount", "bookingNumber"],
    isActive: true,
  },
]);

console.log("\n✅ Database seeding completed successfully!");

await connection.end();
process.exit(0);
