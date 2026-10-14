// server/api/telegram/webhook.post.js
// Приём обновлений Telegram (этап 2): нажатия inline-кнопок на карточке
// заказа. Вызывается СЕРВЕРАМИ TELEGRAM (не браузером) — без сессий.
// Безопасность, слои:
//   1. X-Telegram-Bot-Api-Secret-Token === секрет (только настоящий Telegram);
//   2. whitelist: кнопки жмут только пользователи из TELEGRAM_ADMIN_USER_IDS
//      (fallback: TELEGRAM_ADMIN_CHAT_ID) — поддерживает несколько админов;
//   3. дедуп update_id в KV (TTL 1ч) от повторных доставок Telegram —
//      бизнес-логика и так идемпотентна, дедуп — защита от лишних правок.
import { getOrderById, updateOrderStatus, ORDER_STATUS_LABELS } from '../../lib/orderHelpers'
import { kvGetJSON, kvPutJSON } from '../../lib/storage'
import { answerCallbackQuery, editOrderCard, getAdminUserIds } from '../../lib/telegram'

export default defineEventHandler(async (event) => {
  const env = event.context.cloudflare?.env

  // ── 1. Только настоящий Telegram ──
  const secret = getHeader(event, 'X-Telegram-Bot-Api-Secret-Token')
  if (!env?.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const update = await readBody(event)

  // ── 2. Дедупликация по update_id (KV, TTL 1 час) ──
  const dedupeKey = `tg:upd:${update?.update_id}`
  if (await kvGetJSON(event, dedupeKey)) return { ok: true }
  await kvPutJSON(event, dedupeKey, true, 3600)

  // Обрабатываем только нажатия кнопок; остальные апдейты игнорируем
  const cq = update?.callback_query
  if (!cq) return { ok: true }

  // ── 3. Whitelist: только администраторы (список id) ──
  const adminIds = getAdminUserIds(env)
  if (!adminIds.includes(String(cq.from?.id))) {
    await answerCallbackQuery(env, cq.id, '⛔ Недостаточно прав', true)
    return { ok: true }
  }

  // ── 4. Разбор callback_data: order:confirm:ORD-xxx | order:cancel:ORD-xxx
  const [scope, action, orderId] = String(cq.data || '').split(':')
  if (scope !== 'order' || !orderId || !['confirm', 'cancel'].includes(action)) {
    await answerCallbackQuery(env, cq.id, 'Неизвестная команда')
    return { ok: true }
  }
  const status = action === 'confirm' ? 'confirmed' : 'cancelled'

  try {
    // ── 5. Бизнес-охрана переходов (webhook-слой; HTTP-эндпоинт остаётся
    // гибким для админки). Из финальных статусов менять нельзя ──
    const existing = await getOrderById(event, orderId)
    if (!existing) {
      await answerCallbackQuery(env, cq.id, 'Заказ не найден', true)
      return { ok: true }
    }
    if (['cancelled', 'delivered'].includes(existing.status)) {
      await answerCallbackQuery(
        env,
        cq.id,
        `Заказ уже: ${ORDER_STATUS_LABELS[existing.status]}`,
        true,
      )
      return { ok: true }
    }
    if (existing.status === 'shipped' && status === 'cancelled') {
      await answerCallbackQuery(env, cq.id, '⚠️ Заказ уже передан в доставку', true)
      return { ok: true }
    }

    // ── 6. Смена статуса (та же логика, что у админки) + перерисовка карточки
    const order = await updateOrderStatus(event, orderId, status)
    await editOrderCard(env, cq.message.chat.id, cq.message.message_id, order)
    await answerCallbackQuery(env, cq.id, `Заказ: ${ORDER_STATUS_LABELS[order.status]}`)
  } catch (error) {
    // Ошибка не должна ронять webhook: Telegram бы ретраил апдейт бесконечно
    console.error('[telegram-webhook] ошибка обработки:', error?.message)
    await answerCallbackQuery(env, cq.id, 'Ошибка сервера, попробуйте позже', true)
  }

  return { ok: true }
})