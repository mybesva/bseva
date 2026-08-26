import mysql from 'mysql2/promise';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(dbUrl);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('Connected to database');

// Sample priests data
const priests = [
  {
    name: 'Pandit Ramesh Sharma',
    email: 'ramesh.sharma@bseva.com',
    phone: '+91 98765 00001',
    experience: 25,
    languages: ['Hindi', 'Sanskrit', 'English'],
    specializations: ['Satyanarayan Puja', 'Griha Pravesh', 'Wedding Ceremonies'],
    rating: '4.90',
    totalReviews: 156,
    bio: 'Senior Vedic priest with 25 years of experience. Specializes in traditional North Indian rituals and ceremonies.',
  },
  {
    name: 'Acharya Venkatesh Iyer',
    email: 'venkatesh.iyer@bseva.com',
    phone: '+91 98765 00002',
    experience: 18,
    languages: ['Tamil', 'Sanskrit', 'English', 'Kannada'],
    specializations: ['Navagraha Puja', 'Kaal Sarp Dosh', 'Rudrabhishek'],
    rating: '4.85',
    totalReviews: 98,
    bio: 'Expert in South Indian traditions and Vedic astrology remedies. Known for precise mantra pronunciation.',
  },
  {
    name: 'Pandit Suresh Mishra',
    email: 'suresh.mishra@bseva.com',
    phone: '+91 98765 00003',
    experience: 15,
    languages: ['Hindi', 'Sanskrit', 'Marathi'],
    specializations: ['Ganesh Havan', 'Namkaran', 'Satyanarayan Puja'],
    rating: '4.75',
    totalReviews: 72,
    bio: 'Dedicated priest focusing on family ceremonies and auspicious beginnings. Patient and thorough in explanations.',
  },
  {
    name: 'Pandit Krishnamurthy',
    email: 'krishnamurthy@bseva.com',
    phone: '+91 98765 00004',
    experience: 30,
    languages: ['Telugu', 'Sanskrit', 'Hindi', 'English'],
    specializations: ['Wedding Ceremonies', 'Vastu Shanti', 'Griha Pravesh'],
    rating: '4.95',
    totalReviews: 234,
    bio: 'Highly experienced senior priest. Former temple priest with expertise in elaborate multi-day ceremonies.',
  },
  {
    name: 'Acharya Deepak Joshi',
    email: 'deepak.joshi@bseva.com',
    phone: '+91 98765 00005',
    experience: 12,
    languages: ['Hindi', 'Sanskrit', 'Gujarati'],
    specializations: ['Satyanarayan Puja', 'Office Inauguration', 'Festival Rituals'],
    rating: '4.70',
    totalReviews: 45,
    bio: 'Young and dynamic priest blending traditional knowledge with modern approach. Great with first-time devotees.',
  },
];

try {
  for (const priest of priests) {
    // Generate a unique openId for each priest
    const openId = `priest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Insert user
    const [userResult] = await connection.execute(
      `INSERT INTO users (openId, name, email, phone, role, loginMethod, isActive) 
       VALUES (?, ?, ?, ?, 'priest', 'email', true)`,
      [openId, priest.name, priest.email, priest.phone]
    );
    
    const userId = userResult.insertId;
    console.log(`Created user: ${priest.name} (ID: ${userId})`);
    
    // Insert priest profile
    await connection.execute(
      `INSERT INTO priest_profiles (userId, experience, languages, specializations, rating, totalReviews, bio, isVerified, verificationDate, availabilityStatus, basePrice) 
       VALUES (?, ?, ?, ?, ?, ?, ?, true, NOW(), 'available', 210000)`,
      [
        userId,
        priest.experience,
        JSON.stringify(priest.languages),
        JSON.stringify(priest.specializations),
        priest.rating,
        priest.totalReviews,
        priest.bio,
      ]
    );
    
    console.log(`Created priest profile for: ${priest.name}`);
  }
  
  console.log('\\nSeeding completed successfully!');
  console.log(`Added ${priests.length} priests to the database.`);
} catch (error) {
  console.error('Error seeding priests:', error);
} finally {
  await connection.end();
}
