// server/api/my/telegram-link.post.ts
// Одноразовый код привязки аккаунта к Telegram-боту (POST). Только
// авторизованный покупатель. Код живёт 15 минут в KV tg:link:<code>;
// применяет его webhook, получив от бота /start link-КОД. Ответ —
// готовая deep-link ссылка https://t.me/<bot>?start=<code>: клиент
// показывает кнопку «Открыть бота».
import { requireUser } from '../../utils/auth';
import { kvGetJSON, kvPutJSON } from '../../lib/storage';
import { getBotUsername } from '../../lib/telegram';

// Кэш username бота (getMe) — 24 часа: username меняется редко,
// а getMe на каждый клик — лишний сетевой вызов
const BOT_USERNAME_KEY = 'tg:bot:username';
const BOT_USERNAME_TTL = 86_400;
const CODE_TTL_SECONDS = 900;

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const env = event.context.cloudflare?.env;

  if (!env?.TELEGRAM_BOT_TOKEN) {
    throw createError({
      statusCode: 400,
      message: 'Telegram-бот не настроен',
      data: { code: 'telegramNotConfigured' },
    });
  }

  const username =
    (await kvGetJSON<string>(event, BOT_USERNAME_KEY)) ?? (await getBotUsername(env));
  if (!username) {
    throw createError({
      statusCode: 502,
      message: 'Не удалось связаться с Telegram — попробуйте позже',
      data: { code: 'telegramUnavailable' },
    });
  }
  await kvPutJSON(event, BOT_USERNAME_KEY, username, BOT_USERNAME_TTL);

  // link-XXXXXX: 10 символов hex из UUID (40 бит случайности) — хватает
  // для одноразового 15-минутного кода; перебор бессмыслен
  const code = `link-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  await kvPutJSON(
    event,
    `tg:link:${code}`,
    { userId: user.id, createdAt: new Date().toISOString() },
    CODE_TTL_SECONDS,
  );

  return {
    success: true,
    code,
    url: `https://t.me/${username}?start=${code}`,
    expiresIn: CODE_TTL_SECONDS,
  };
});
