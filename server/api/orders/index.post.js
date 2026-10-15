// server/api/orders/index.post.js
// Создание заказа (POST /api/orders). Публичный эндпоинт: заказ можно
// оформить без авторизации; для авторизованных заказ связывается с
// пользователем через сессию. Все деньги пересчитываются на сервере.
// После сохранения — карточка заказа админам в Telegram с кнопками
// «Подтвердить/Отменить». Отправка через waitUntil: ответ покупателю
// не ждёт Telegram; недоступность Telegram не влияет на заказ.
// ⚠️ Урок отладки: логируются ОБА исхода отправки — тишина в логах
// никогда не должна означать «вероятно, отправилось».
// ⚠️ Наблюдаемость: логи внутри waitUntil ненадёжны в wrangler tail —
// при диагностике доставки использовать синхронную отладочную версию.
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

    // ── Telegram: карточка заказа с кнопками ──
    const env = event.context.cloudflare?.env
    const ctx = event.context.cloudflare?.ctx

    const send = async () => {
      if (!env?.TELEGRAM_BOT_TOKEN || !env?.TELEGRAM_ADMIN_CHAT_ID) {
        console.warn('[telegram] skip: секреты отсутствуют в env', {
          hasEnv: Boolean(env),
          hasToken: Boolean(env?.TELEGRAM_BOT_TOKEN),
          hasChatId: Boolean(env?.TELEGRAM_ADMIN_CHAT_ID),
        })
        return
      }
      const ok = await sendOrderCard(env, order)
      // Явный лог обоих исходов — полная наблюдаемость каждого заказа
      console.log(
        `[telegram] карточка ${order.id}: ${ok ? 'отправлена ✅' : 'НЕ отправлена (причина — [telegram] ... failed выше)'}`,
      )
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