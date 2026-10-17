// server/api/orders/index.post.js
// Создание заказа (POST /api/orders). Публичный эндпоинт: заказ можно
// оформить без авторизации; для авторизованных заказ связывается с
// пользователем через сессию. Все деньги пересчитываются на сервере.
// После сохранения — карточка заказа админам в Telegram с кнопками
// «Подтвердить/Отменить».
// ⚠️ ВАЖНО (доказано экспериментом, две итерации): отправка через
// ctx.waitUntil() / fire-and-forget НЕ доставляет карточки в этом
// рантайме (Nitro cloudflare-module) — фоновая задача обрывается после
// ответа покупателю. Синхронный await — доставляет всегда.
// Принято решение: синхронная отправка. Цена — ~0.2–0.5с к ответу;
// надёжность доставки важнее теоретической элегантности.
// Логируются ОБА исхода — тишина в логах не должна означать «наверное, ушло».
import { createOrder } from '../../lib/orderHelpers'
import { getSessionUser } from '../../utils/auth'
import { sendOrderCard } from '../../lib/telegram'

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

    // ── Telegram: карточка заказа с кнопками. СИНХРОННО (см. шапку) ──
    const env = event.context.cloudflare?.env

    if (env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_ADMIN_CHAT_ID) {
      const ok = await sendOrderCard(env, order)
      console.log(
        `[telegram] карточка ${order.id}: ${ok ? 'отправлена ✅' : 'НЕ отправлена (причина — [telegram] ... failed выше)'}`,
      )
    } else {
      console.warn('[telegram] skip: секреты отсутствуют в env', {
        hasEnv: Boolean(env),
        hasToken: Boolean(env?.TELEGRAM_BOT_TOKEN),
        hasChatId: Boolean(env?.TELEGRAM_ADMIN_CHAT_ID),
      })
    }

    return { success: true, order, message: `Заказ ${order.id} создан` }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка создания заказа:', error)
    throw createError({ statusCode: 500, message: 'Не удалось создать заказ' })
  }
})