const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Neon PostgreSQL bazasi ulanishi (Sizning db faylingiz)
const db = require('./database/db'); 

const authRoutes = require('./routes/auth');

// Botni ishga tushiramiz
require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);

// =======================================================
//   ADMIN PANEL UCHUN REAL-TIME API-LAR (POSTGRESQL NEON)
// =======================================================

// 1. Kirishni tekshirish va barcha foydalanuvchilarni olish
app.get('/api/admin/users', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];

  // Parolni .env-dagi ADMIN_KEY bilan tekshirish
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Tizimga kirish taqiqlangan! Parol noto'g'ri." });
  }

  try {
    // Neon bazasidan barcha obunachilarni yaratilgan vaqti bo'yicha saralab olamiz
    const result = await db.query("SELECT * FROM allowed_users ORDER BY id DESC");
    
    // Frontend kutayotgan 'users' kaliti bilan ro'yxatni qaytaramiz
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
    // Avval raqam bazada bor-yo'qligini tekshiramiz
    const checkUser = await db.query("SELECT * FROM allowed_users WHERE phone = $1", [phone]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu raqam allaqachon ro'yxatga qo'shilgan!" });
    }

    // Neon bazasiga yangi ruxsat berilgan foydalanuvchini qo'shamiz
    // 'completed_days' standart holatda bo'sh massiv string holatida ketadi: '[]'
    await db.query(
      "INSERT INTO allowed_users (phone, telegram, course, completed_days, created_at) VALUES ($1, $2, $3, $4, NOW())",
      [phone, telegram || null, course || '60kun', '[]']
    );

    res.json({ success: true, message: "Foydalanuvchi muvaffaqiyatli qo'shildi!" });
  } catch (err) {
    console.error("Admin user qo'shish xatolik:", err);
    res.status(500).json({ success: false, message: "Server bazasiga yozishda xatolik." });
  }
});

// 3. Foydalanuvchini Telefon raqami bo'yicha O'chirish (Modal oynadagi tasdiq uchun)
app.delete('/api/admin/delete-user', async (req, res) => {
  const { phone, adminKey } = req.body;

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Parol noto'g'ri!" });
  }

  try {
    const result = await db.query("DELETE FROM allowed_users WHERE phone = $1", [phone]);
    
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

app.get('/course', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'course.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server ishlamoqda: http://localhost:${PORT}`);
});