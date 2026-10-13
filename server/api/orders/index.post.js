// server/api/orders/index.post.js
// Создание заказа (POST /api/orders). Публичный эндпоинт: заказ можно
// оформить без авторизации; для авторизованных заказ связывается с
// пользователем через сессию. Все деньги пересчитываются на сервере.
import { createOrder } from '../../lib/orderHelpers'
import { getSessionUser } from '../../utils/auth'

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

    // TODO(этап 1, Telegram): notifyAdmin(...) — уведомление о новом заказе.
    // Отправка будет через waitUntil, чтобы не задерживать ответ покупателю,
    // и не должна ломать создание заказа при недоступности Telegram

    return { success: true, order, message: `Заказ ${order.id} создан` }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка создания заказа:', error)
    throw createError({ statusCode: 500, statusMessage: 'Не удалось создать заказ' })
  }
})