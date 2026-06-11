const { Pool } = require('pg');

// Render yoki localhost .env ichidagi DATABASE_URL ni o'qiydi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Tashqi serverga xavfsiz ulanish uchun shart
  }
});

// Jadvallarni PostgreSQL formatida yaratish
const initDb = async () => {
  try {
    // 1. Users jadvali
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        telegram TEXT,
        telegram_chat_id TEXT,
        course TEXT DEFAULT '60kun',
        current_day INTEGER DEFAULT 1,
        completed_days TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. OTP kodlar jadvali
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("PostgreSQL jadvallari tekshirildi va muvaffaqiyatli tayyorlandi! 🚀");
  } catch (err) {
    console.error("PostgreSQL-da jadval yaratishda xatolik yuz berdi:", err);
  }
};

// Server yonganda jadvallarni tekshirib olish uchun chaqiramiz
initDb();

module.exports = {
  // SQLite dagi db.prepare().run() yoki .all() larni o'rniga db.query() ishlatamiz
  query: (text, params) => pool.query(text, params),
};