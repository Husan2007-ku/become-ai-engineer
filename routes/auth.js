const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { sendOtpToTelegram } = require('../bot');

router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Telefon raqam kiritilmadi' });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    return res.status(403).json({ success: false, message: 'Siz kursga yozilmagansiz. Avval tolov qiling.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(phone);
  db.prepare('INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(phone, code, expiresAt);

  const sent = await sendOtpToTelegram(phone, code);

  if (!sent) {
    console.log(`OTP kod ${phone} uchun: ${code}`);
  }

  res.json({ success: true, message: sent ? 'Telegram botga kod yuborildi' : 'Kod yuborildi' });
});

router.post('/verify-otp', (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ success: false, message: 'Malumot yetishmayapti' });
  }

  const otpRecord = db.prepare('SELECT * FROM otp_codes WHERE phone = ? AND code = ?').get(phone, code);

  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'Kod noto\'g\'ri' });
  }

  if (new Date(otpRecord.expires_at) < new Date()) {
    return res.status(400).json({ success: false, message: 'Kod muddati o\'tgan' });
  }

  db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(phone);

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

  res.json({ success: true, user: { phone: user.phone, course: user.course, current_day: user.current_day, completed_days: JSON.parse(user.completed_days) } });
});

router.post('/complete-day', (req, res) => {
  const { phone, day } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
  }

  const completedDays = JSON.parse(user.completed_days);
  if (!completedDays.includes(day)) {
    completedDays.push(day);
  }

  const nextDay = Math.max(...completedDays) + 1;

  db.prepare('UPDATE users SET completed_days = ?, current_day = ? WHERE phone = ?')
    .run(JSON.stringify(completedDays), nextDay, phone);

  res.json({ success: true, completed_days: completedDays, current_day: nextDay });
});

router.post('/admin/add-user', (req, res) => {
  const { phone, telegram, course, adminKey } = req.body;

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }

  try {
    db.prepare('INSERT INTO users (phone, telegram, course) VALUES (?, ?, ?)').run(phone, telegram, course || '60kun');
    res.json({ success: true, message: 'Foydalanuvchi qoshildi' });
  } catch(e) {
    res.status(400).json({ success: false, message: 'Bu raqam allaqachon mavjud' });
  }
});

// Admin: barcha foydalanuvchilarni ko'rish
router.get('/admin/users', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.json({ success: true, users });
});

// Admin: foydalanuvchi o'chirish
router.delete('/admin/delete-user', (req, res) => {
  const { phone, adminKey } = req.body;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }
  db.prepare('DELETE FROM users WHERE phone = ?').run(phone);
  db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(phone);
  res.json({ success: true, message: 'O\'chirildi' });
});

module.exports = router;