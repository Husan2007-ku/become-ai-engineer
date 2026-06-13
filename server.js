// =======================================================
// 1. KUTUBXONALARNI YUKLASH
// =======================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Admin kaliti xavfsizligi (Agar .env da bo'lmasa, standart qiymat oladi)
process.env.ADMIN_KEY = process.env.ADMIN_KEY || "husanai2025secret";

// =======================================================
// 2. MA'LUMOTLAR BAZASI VA TELEGRAM BOT INTEGRATSIYASI
// =======================================================
const db = require('./database/db'); 
const authRoutes = require('./routes/auth');
require('./bot'); // Telegram botni ishga tushirish

// =======================================================
// 3. EXPRESS ILOVASINI YARATISH
// =======================================================
const app = express();
const PORT = process.env.PORT || 3000;

// =======================================================
// 4. MIDDLEWARE (ORALIQ DASTURLAR)
// =======================================================
app.use(cors());
app.use(express.json());

// =======================================================
// 5. ASOSIY SAHIFA MARSHRUTLARI (ROUTING) - MUHIM QISM!
// =======================================================

// AYNAN SHU KOD index.html dan avval landing.html ni ochishni kafolatlaydi!
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Foydalanuvchi tizimga kirish qismi (Eski index.html shu yerga ko'chirildi)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/course', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'course.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Qolgan barcha statik fayllar (CSS, JS, Rasmlar) endi xavfsiz yuklanadi
app.use(express.static(path.join(__dirname, 'public')));

// API Marshrutlari
app.use('/api/auth', authRoutes);

// =======================================================
// 6. ADMIN PANEL UCHUN REAL-TIME API-LAR (POSTGRESQL NEON)
// =======================================================

// Bazadagi faol jadval nomini aniqlash funksiyasi
async function getTableName() {
    try {
        const checkUsers = await db.query(`SELECT to_regclass('public.users') as tbl`);
        if (checkUsers.rows[0].tbl) return 'users';

        const checkAllowed = await db.query(`SELECT to_regclass('public.allowed_users') as tbl`);
        if (checkAllowed.rows[0].tbl) return 'allowed_users';

        return 'users';
    } catch (e) {
        return 'users';
    }
}

// 1) Barcha foydalanuvchilarni olish (Admin panel uchun)
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

// 2) Yangi Foydalanuvchi Qo'shish
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

// 3) Foydalanuvchini O'chirish
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
// 7. XATOLIKLARNI BOSHQARISH (404 NOT FOUND OVERRIDE)
// =======================================================
// Mavjud bo'lmagan sahifaga kirilsa, avtomatik landing sahifaga yo'naltiradi
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// =======================================================
// 8. SERVERNI TINGLASH
// =======================================================
app.listen(PORT, () => {
    console.log(`Server muvaffaqiyatli ishlamoqda: http://localhost:${PORT}`);
});