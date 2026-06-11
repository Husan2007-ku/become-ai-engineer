const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { sendOtpToTelegram } = require('../bot');

// OTP jo'natish
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Telefon raqam kiritilmadi' });
  }

  try {
    const userResult = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(403).json({ success: false, message: 'Siz kursga yozilmagansiz. Avval tolov qiling.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Eski OTP kodlarni tozalash va yangisini kiritish
    await db.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);
    await db.query('INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)', [phone, code, expiresAt]);

    const sent = await sendOtpToTelegram(phone, code);

    if (!sent) {
      console.log(`OTP kod ${phone} uchun (Telegramga ketmadi): ${code}`);
    }

    res.json({ success: true, message: sent ? 'Telegram botga kod yuborildi' : 'Kod yuborildi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi' });
  }
});

// OTP kodni tekshirish
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ success: false, message: 'Malumot yetishmayapti' });
  }

  try {
    const otpResult = await db.query('SELECT * FROM otp_codes WHERE phone = $1 AND code = $2', [phone, code]);
    const otpRecord = otpResult.rows[0];

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Kod noto\'g\'ri' });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Kod muddati o\'tgan' });
    }

    await db.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);

    const userResult = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    const user = userResult.rows[0];

    // PostgreSQL ob'ektlarni json qilib qaytarmasa, string bo'lsa parse qilamiz
    const completedDays = typeof user.completed_days === 'string' ? JSON.parse(user.completed_days) : user.completed_days;

    res.json({ 
      success: true, 
      user: { 
        phone: user.phone, 
        course: user.course, 
        current_day: user.current_day, 
        completed_days: completedDays || [] 
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi' });
  }
});

// Kunlik darsni yakunlash
router.post('/complete-day', async (req, res) => {
  const { phone, day } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }

    let completedDays = typeof user.completed_days === 'string' ? JSON.parse(user.completed_days) : user.completed_days;
    if (!completedDays) completedDays = [];

    if (!completedDays.includes(day)) {
      completedDays.push(day);
    }

    const nextDay = Math.max(...completedDays) + 1;

    await db.query(
      'UPDATE users SET completed_days = $1, current_day = $2 WHERE phone = $3',
      [JSON.stringify(completedDays), nextDay, phone]
    );

    res.json({ success: true, completed_days: completedDays, current_day: nextDay });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi' });
  }
});

// Admin: Foydalanuvchi qo'shish
router.post('/admin/add-user', async (req, res) => {
  const { phone, telegram, course, adminKey } = req.body;

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }

  try {
    await db.query(
      'INSERT INTO users (phone, telegram, course) VALUES ($1, $2, $3)', 
      [phone, telegram, course || '60kun']
    );
    res.json({ success: true, message: 'Foydalanuvchi qoshildi' });
  } catch (e) {
    res.status(400).json({ success: false, message: 'Bu raqam allaqachon mavjud yoki xatolik yuz berdi' });
  }
});

// Admin: Barcha foydalanuvchilarni ko'rish
router.get('/admin/users', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }
  
  try {
    const result = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Serverda xatolik' });
  }
});

// Admin: Foydalanuvchi o'chirish
router.delete('/admin/delete-user', async (req, res) => {
  const { phone, adminKey } = req.body;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }

  try {
    await db.query('DELETE FROM users WHERE phone = $1', [phone]);
    await db.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);
    res.json({ success: true, message: 'O\'chirildi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'O\'chirishda xatolik yuz berdi' });
  }
});

module.exports = router;