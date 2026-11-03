// server/api/telegram/webhook/setup.post.ts
// POST /api/telegram/webhook/setup — регистрация вебхука кнопкой из админки
// (только админ). Заменяет ручной curl из README: адрес и секрет берутся
// из конфигурации воркера, токен бота нигде не светится.
// Полезно и при смене домена: одна кнопка переподключает вебхук заново.
import { isTelegramConfigured, setWebhook, getWebhookInfo } from '../../../lib/telegram';
import { resolveSiteUrl } from '../../../lib/seoHelpers';
import { requireAdmin } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const env = event.context.cloudflare?.env;
  if (!isTelegramConfigured(env)) {
    throw createError({
      statusCode: 400,
      message:
        'Секреты не настроены. Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID в настройках воркера',
    });
  }

  // Канонический origin (NUXT_PUBLIC_SITE_URL → origin запроса) + путь вебхука
  const url = `${resolveSiteUrl(event)}/api/telegram/webhook`;

  const res = await setWebhook(env, url);
  if (!res.ok) {
    // 502: не наша ошибка — Telegram отклонил (битый токен, секрет не по
    // маске A-Za-z0-9_- и т.п.). description показываем админу как есть
    throw createError({
      statusCode: 502,
      message: res.description || 'Telegram отклонил регистрацию вебхука',
    });
  }

  // Свежий статус сразу после регистрации — карточка перерисуется за один клик
  const info = await getWebhookInfo(env);
  return {
    success: true,
    url,
    webhook: info.ok ? (info.result ?? null) : null,
  };
});
