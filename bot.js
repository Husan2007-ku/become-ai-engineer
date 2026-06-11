const TelegramBot = require('node-telegram-bot-api');
const db = require('./database/db');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '👋 Salom! BecomeAI Engineer botiga xush kelibsiz!\n\n' +
    '📱 Kursga kirish uchun telefon raqamingizni yuboring.\n' +
    'Format: +998901234567'
  );
});

// Asinxron (async) qildik, chunki db.query javobini kutishimiz kerak
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (text.match(/^\+998\d{9}$/)) {
    try {
      // ? o'rniga $1 va $2 ishlatildi, await bilan so'rov bajarildi
      await db.query(
        'UPDATE users SET telegram_chat_id = $1 WHERE phone = $2', 
        [chatId.toString(), text]
      );
      bot.sendMessage(chatId, '✅ Raqamingiz tizimga bog\'landi!\n\nEndi saytga kirganda kod avtomatik yuboriladi.');
    } catch (err) {
      console.error('Bot message bazaga yozishda xato:', err.message);
      bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos keyinroq qayta urinib ko\'ring.');
    }
  }
});

// Kod asinxron ishlagani uchun bu yerdagi Promise mantiqan toza holatga keltirildi
function sendOtpToTelegram(phone, code) {
  return new Promise(async (resolve) => {
    try {
      // SQLite dagi .get() o'rniga db.query ishlatilib rows[0] olindi
      const result = await db.query('SELECT telegram_chat_id FROM users WHERE phone = $1', [phone]);
      const user = result.rows[0];

      if (!user || !user.telegram_chat_id) {
        resolve(false);
        return;
      }

      bot.sendMessage(
        user.telegram_chat_id,
        '🔐 Tasdiqlash kodingiz:\n\n<code>' + code + '</code>\n\n👆 Kodni bosing — avtomatik nusxalanadi!\n\n⏰ Kod 5 daqiqa ichida yaroqli.\n❌ Kodni hech kimga bermang!',
        { parse_mode: 'HTML' }
      ).then(() => {
        console.log('Telegram kod yuborildi!');
        resolve(true);
      }).catch((e) => {
        console.log('Telegram xato:', e.message);
        resolve(false);
      });
    } catch(e) {
      console.log('Xato:', e.message);
      resolve(false);
    }
  });
}

module.exports = { bot, sendOtpToTelegram };