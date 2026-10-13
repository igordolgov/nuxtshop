// server/api/orders/index.post.js
// Создание заказа (POST /api/orders). Публичный эндпоинт.
// ⚠️ ВРЕМЕННАЯ ОТЛАДОЧНАЯ ВЕРСИЯ: отправка в Telegram синхронная (await),
// чтобы все логи гарантированно попадали в wrangler tail — логи из
// waitUntil в tail не показываются (источник «немой» отладки).
// После диагностики вернуть waitUntil-версию (дам отдельно).
import { createOrder } from '../../lib/orderHelpers'
import { getSessionUser } from '../../utils/auth'
import { notifyAdmin, formatNewOrderMessage } from '../../lib/telegram'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Авторизация опциональна: гость или пользователь
    const user = await getSessionUser(event)

    const order = await createOrder(event, {
      items: body?.items,
      deliveryMethod: body?.deliveryMethod,
      paymentMethod: body?.paymentMethod,
      promoCode: body?.promoCode,
      // userId прикрепляется сервером — клиентский подделать не может
      customer: { ...body?.customer, userId: user?.id ?? null },
      notify: body?.notify,
      comment: body?.comment,
    })

    // ── Telegram: СИНХРОННО для отладки (все логи видны в tail) ──
    const env = event.context.cloudflare?.env
    console.log(
      '[orders-v3] telegram: env=', Boolean(env),
      'token=', Boolean(env?.TELEGRAM_BOT_TOKEN),
      'chatId=', Boolean(env?.TELEGRAM_ADMIN_CHAT_ID),
    )
    if (env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_ADMIN_CHAT_ID) {
      const text = formatNewOrderMessage(order)
      const ok = await notifyAdmin(env, text)
      console.log(`[orders-v3] отправка по ${order.id}: ${ok ? 'успех ✅' : 'ОШИБКА — см. [telegram] ... failed выше'}`)
    } else {
      console.warn('[orders-v3] skip: секретов нет в env')
    }

    return { success: true, order, message: `Заказ ${order.id} создан` }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка создания заказа:', error)
    throw createError({ statusCode: 500, statusMessage: 'Не удалось создать заказ' })
  }
})