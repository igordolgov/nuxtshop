// server/api/orders/index.post.js
// Создание заказа (POST /api/orders). Публичный эндпоинт: заказ можно
// оформить без авторизации; для авторизованных заказ связывается с
// пользователем через сессию. Все деньги пересчитываются на сервере.
// После сохранения — уведомление админу в Telegram через waitUntil:
// ответ покупателю не ждёт Telegram; недоступность Telegram не влияет
// на заказ. Итог отправки логируется (виден в wrangler tail).
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

    // ── Telegram: уведомление админа о новом заказе ──
    const env = event.context.cloudflare?.env
    const ctx = event.context.cloudflare?.ctx
    const text = formatNewOrderMessage(order)

    const send = async () => {
      // ⚠️ ЗНАНИЕ ИЗ ОТЛАДКИ: логи внутри waitUntil НЕ попадают в tail.
      // Это осознанный компромисс: ради неблокирующего ответа покупателю.
      // Наблюдаемость обеспечена самим фактом доставки в чат + ретраи
      // не нужны (упавшую отправку видно по отсутствию карточки в чате)
      const ok = await notifyAdmin(env, text)
      if (!ok) console.warn(`[telegram] не удалось отправить уведомление по ${order.id}`)
    }

    if (ctx?.waitUntil) {
      ctx.waitUntil(send())
    } else {
      // Fallback-контексты без waitUntil: ждём синхронно (dev и др.)
      send().catch(() => {})
    }

    return { success: true, order, message: `Заказ ${order.id} создан` }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка создания заказа:', error)
    throw createError({ statusCode: 500, statusMessage: 'Не удалось создать заказ' })
  }
})