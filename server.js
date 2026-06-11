const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Neon PostgreSQL bazasi ulanishini olamiz
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

// ==========================================
//   ADMIN PANEL UCHUN REAL-TIME API-LAR
// ==========================================

// 1. Statistika va Foydalanuvchilar ro'yxatini qidiruv bilan birga olish
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Jami ruxsat berilgan/qo'shilgan foydalanuvchilar soni (allowed_users jadvalidan)
    const totalUsersRes = await db.query("SELECT COUNT(*) FROM allowed_users");
    const totalUsers = parseInt(totalUsersRes.rows[0].count) || 0;

    // Bugun faol bo'lganlar (agar jadvalingizda last_active bo'lsa, bo'lmasa 0 qaytaradi)
    let activeToday = 0;
    try {
      const activeRes = await db.query("SELECT COUNT(*) FROM allowed_users WHERE updated_at::date = CURRENT_DATE");
      activeToday = parseInt(activeRes.rows[0].count) || 0;
    } catch (e) {
      // Agar updated_at bo'lmasa xato bermasligi uchun
    }

    // O'rtacha progress va Kursni tugatganlar (foydalanuvchilar ro'yxatidan kelib chiqib)
    let avgProgress = 0;
    let completedCourse = 0;
    try {
      const progressRes = await db.query("SELECT ROUND(AVG(progress), 1) as avg FROM allowed_users WHERE progress IS NOT NULL");
      avgProgress = parseFloat(progressRes.rows[0].avg) || 0;

      const completedRes = await db.query("SELECT COUNT(*) FROM allowed_users WHERE progress = 100");
      completedCourse = parseInt(completedRes.rows[0].count) || 0;
    } catch (e) {}

    // Qidiruv tizimi (Telefon raqam yoki Telegram username bo'yicha)
    const search = req.query.search || '';
    let usersQuery = "SELECT * FROM allowed_users ORDER BY id DESC";
    let params = [];

    if (search) {
      usersQuery = "SELECT * FROM allowed_users WHERE phone LIKE $1 OR telegram LIKE $1 ORDER BY id DESC";
      params = [`%${search}%`];
    }

    const usersList = await db.query(usersQuery, params);

    // Frontend kutayotgan formatda ma'lumotni qaytaramiz
    res.json({
      stats: {
        total: totalUsers,
        active: activeToday || totalUsers, // Agar aktivlik o'lchanmasa, jami sonni ko'rsatib turadi
        avgProgress: avgProgress,
        completed: completedCourse
      },
      users: usersList.rows
    });

  } catch (err) {
    console.error("Admin stats xatolik:", err);
    res.status(500).json({ error: "Bazadan ma'lumot olishda xatolik yuz berdi" });
  }
});

// 2. Foydalanuvchini admin panel orqali o'chirib tashlash (AMAL)
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  const adminKey = req.headers['admin-key'] || req.query.adminKey;

  // Render-dagi ADMIN_KEY bilan tekshiramiz
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Tizimga kirish taqiqlangan! Kod noto'g'ri." });
  }

  try {
    await db.query("DELETE FROM allowed_users WHERE id = $1", [id]);
    res.json({ success: true, message: "Foydalanuvchi muvaffaqiyatli o'chirildi!" });
  } catch (err) {
    console.error("O'chirishda xatolik:", err);
    res.status(500).json({ error: "Foydalanuvchini o'chirishda xatolik yuz berdi." });
  }
});

// ==========================================

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