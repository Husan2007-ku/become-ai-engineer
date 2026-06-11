// =======================================================
//   ADMIN PANEL UCHUN REAL-TIME API-LAR (POSTGRESQL NEON)
// =======================================================

// Bazadagi haqiqiy jadval nomini aniqlash funksiyasi
async function getTableName() {
  try {
    // Avval 'users' jadvali bormi tekshiradi
    const checkUsers = await db.query(`SELECT to_regclass('public.users') as tbl`);
    if (checkUsers.rows[0].tbl) return 'users';

    // Bo'lmasa 'allowed_users' jadvalini tekshiradi
    const checkAllowed = await db.query(`SELECT to_regclass('public.allowed_users') as tbl`);
    if (checkAllowed.rows[0].tbl) return 'allowed_users';

    // Agar ikkalasi ham bo'lmasa, standart holatda 'users' qaytaradi
    return 'users';
  } catch (e) {
    return 'users';
  }
}

// 1. Kirishni tekshirish va barcha foydalanuvchilarni olish
app.get('/api/admin/users', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Tizimga kirish taqiqlangan!" });
  }

  try {
    const table = await getTableName(); // Haqiqiy jadval nomini olamiz
    const result = await db.query(`SELECT * FROM ${table} ORDER BY id DESC`);
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Admin foydalanuvchilarni olishda xatolik:", err);
    res.status(500).json({ error: "Bazadan ma'lumot olishda xatolik yuz berdi" });
  }
});

// 2. Yangi Foydalanuvchi Qo'shish
app.post('/api/auth/admin/add-user', async (req, res) => {
  const { phone, telegram, course, adminKey } = req.body;

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Parol noto'g'ri!" });
  }

  if (!phone) {
    return res.status(400).json({ success: false, message: "Telefon raqam shart!" });
  }

  try {
    const table = await getTableName();

    // Avval tekshiramiz
    const checkUser = await db.query(`SELECT * FROM ${table} WHERE phone = $1`, [phone]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu raqam allaqachon bor!" });
    }

    // Bazaga qo'shish (ustunlar nomini moslashtirish bilan)
    await db.query(
      `INSERT INTO ${table} (phone, telegram, course, completed_days, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [phone, telegram || null, course || '60kun', '[]']
    );

    res.json({ success: true, message: "Foydalanuvchi qo'shildi!" });
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