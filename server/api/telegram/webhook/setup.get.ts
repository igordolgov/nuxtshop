// server/api/telegram/webhook/setup.get.ts
// GET /api/telegram/webhook/setup — статус подключения Telegram (только админ).
// Отдаёт: сконфигурированы ли секреты и что Telegram отвечает на
// getWebhookInfo (зарегистрированный url, очередь, последняя ошибка доставки).
// UI-карточка в админке (/admin/orders) по этим данным рисует состояние.
import { isTelegramConfigured, getWebhookInfo } from '../../../lib/telegram'
import { requireAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const env = event.context.cloudflare?.env
  if (!env?.TELEGRAM_BOT_TOKEN) {
    // Без токена Bot API недоступен вообще — карточка покажет «не настроено»
    return { configured: false, webhook: null, error: null }
  }

  const info = await getWebhookInfo(env)
  return {
    configured: isTelegramConfigured(env),
    // ok:false (нет сети/битый токен) → webhook: null, причина в error
    webhook: info.ok ? (info.result ?? null) : null,
    error: info.ok ? null : (info.description ?? 'Telegram недоступен'),
  }
})
