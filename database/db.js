const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'academy.db'));

db.exec(
  "CREATE TABLE IF NOT EXISTS users (" +
  "id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "phone TEXT UNIQUE NOT NULL," +
  "telegram TEXT," +
  "telegram_chat_id TEXT," +
  "course TEXT DEFAULT '60kun'," +
  "current_day INTEGER DEFAULT 1," +
  "completed_days TEXT DEFAULT '[]'," +
  "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
  ");"
);

db.exec(
  "CREATE TABLE IF NOT EXISTS otp_codes (" +
  "id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "phone TEXT NOT NULL," +
  "code TEXT NOT NULL," +
  "expires_at DATETIME NOT NULL," +
  "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
  ");"
);

module.exports = db;