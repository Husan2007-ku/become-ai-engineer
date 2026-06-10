const TelegramBot = require('node-telegram-bot-api');
const db = require('./database/db');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '👋 Salom! BecomeAI Academy botiga xush kelibsiz!\n\n' +
    '📱 Kursga kirish uchun telefon raqamingizni yuboring.\n' +
    'Format: +998901234567'
  );
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (text.match(/^\+998\d{9}$/)) {
    db.prepare('UPDATE users SET telegram_chat_id = ? WHERE phone = ?').run(chatId.toString(), text);
    bot.sendMessage(chatId, '✅ Raqamingiz tizimga bog\'landi!\n\nEndi saytga kirganda kod avtomatik yuboriladi.');
  }
});

function sendOtpToTelegram(phone, code) {
  return new Promise((resolve) => {
    try {
      const user = db.prepare('SELECT telegram_chat_id FROM users WHERE phone = ?').get(phone);

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