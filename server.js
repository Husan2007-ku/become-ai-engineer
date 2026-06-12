// 1. Kutubxonalarni yuklash (Hamma narsadan tepada turishi shart)
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
process.env.ADMIN_KEY = "husanai2025secret";

// 2. Neon PostgreSQL ulanishi va Route fayllar
const db = require('./database/db'); 
const authRoutes = require('./routes/auth');

// 3. Telegram botni ishga tushirish
require('./bot');

// 4. Express loyihasini yaratish (Mana shu qator pastdagilardan tepada turishi shart edi!)
const app = express();
const PORT = process.env.PORT || 3000;

// 5. Middleware-lar
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 6. Auth marshrutlari
app.use('/api/auth', authRoutes);

// =======================================================
//   ADMIN PANEL UCHUN REAL-TIME API-LAR (POSTGRESQL NEON)
// =======================================================

// Bazadagi haqiqiy jadval nomini avtomatik aniqlash funksiyasi
async function getTableName() {
  try {
    // Avval 'users' jadvali bormi tekshiradi
    const checkUsers = await db.query(`SELECT to_regclass('public.users') as tbl`);
    if (checkUsers.rows[0].tbl) return 'users';

    // Bo'lmasa 'allowed_users' jadvalini tekshiradi
    const checkAllowed = await db.query(`SELECT to_regclass('public.allowed_users') as tbl`);
    if (checkAllowed.rows[0].tbl) return 'allowed_users';

    return 'users'; // Ikkalasi ham bo'lmasa standart 'users'
  } catch (e) {
    return 'users';
  }
}

// 1. Kirishni tekshirish va barcha foydalanuvchilarni olish
app.get('/api/admin/users', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Tizimga kirish taqiqlangan! Parol noto'g'ri." });
  }

  try {
    const table = await getTableName();
    const result = await db.query(`SELECT * FROM ${table} ORDER BY id DESC`);
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Admin foydalanuvchilarni olishda xatolik:", err);
    res.status(500).json({ error: "Bazadan ma'lumot olishda xatolik yuz berdi" });
  }
});

// 2. Yangi Foydalanuvchi Qo'shish (Admin panel ichidagi forma uchun)
app.post('/api/auth/admin/add-user', async (req, res) => {
  const { phone, telegram, course, adminKey } = req.body;

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Parol noto'g'ri!" });
  }

  if (!phone) {
    return res.status(400).json({ success: false, message: "Telefon raqam kiritilishi shart!" });
  }

  try {
    const table = await getTableName();

    const checkUser = await db.query(`SELECT * FROM ${table} WHERE phone = $1`, [phone]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu raqam allaqachon ro'yxatga qo'shilgan!" });
    }

    await db.query(
      `INSERT INTO ${table} (phone, telegram, course, completed_days, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [phone, telegram || null, course || '60kun', '[]']
    );

    res.json({ success: true, message: "Foydalanuvchi muvaffaqiyatli qo'shildi!" });
  } catch (err) {
    console.error("Admin user qo'shish xatolik:", err);
    res.status(500).json({ success: false, message: "Server bazasiga yozishda xatolik." });
  }
});

// 3. Foydalanuvchini O'chirish
app.delete('/api/admin/delete-user', async (req, res) => {
  const { phone, adminKey } = req.body;

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Parol noto'g'ri!" });
  }

  try {
    const table = await getTableName();
    const result = await db.query(`DELETE FROM ${table} WHERE phone = $1`, [phone]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi!" });
    }

    res.json({ success: true, message: "Foydalanuvchi bazadan o'chirildi!" });
  } catch (err) {
    console.error("O'chirishda xatolik:", err);
    res.status(500).json({ success: false, message: "Bazadan o'chirishda xatolik yuz berdi." });
  }
});

// =======================================================

// 7. Sahifa (Page) marshrutlari
app.get('/course', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'course.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// 8. Serverni tinglash
app.listen(PORT, () => {
  console.log(`Server ishlamoqda: http://localhost:${PORT}`);
});