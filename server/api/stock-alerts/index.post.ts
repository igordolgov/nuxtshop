// server/api/stock-alerts/index.post.ts
// Заявка «сообщить о поступлении» (POST /api/stock-alerts). Публично.
// Товар проверяется на существование; повторная заявка с тем же контактом
// на тот же товар — успех БЕЗ записи (дедупликация). Админам уходит
// уведомление в Telegram (best-effort: сбой сети не ломает заявку).
import { readProducts } from '../../lib/productHelpers';
import {
  StockAlertValidationError,
  MAX_STOCK_ALERTS,
  hasStockAlert,
  nextStockAlertId,
  normalizeStockAlertInput,
  readStockAlerts,
  writeStockAlerts,
} from '../../lib/stockAlertHelpers';
import { getAdminChatIds, isTelegramConfigured, sendMessage } from '../../lib/telegram';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Honeypot: скрытое поле «website» заполняют только боты — тихо «успех»
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return { success: true, message: 'Готово! Сообщим, когда товар появится' };
    }

    const clean = normalizeStockAlertInput(body ?? {});

    const products = await readProducts(event);
    const product = products.find((p) => String(p?.id) === clean.productId);
    if (!product) {
      throw createError({ statusCode: 400, message: 'Товар не найден' });
    }

    const alerts = await readStockAlerts(event);
    if (hasStockAlert(alerts, clean.productId, clean.contact)) {
      return { success: true, message: 'Вы уже подписаны — сообщим при поступлении' };
    }

    // Предохранитель от переполнения: вытесняем самые старые заявки
    const trimmed =
      alerts.length >= MAX_STOCK_ALERTS
        ? alerts.slice(alerts.length - MAX_STOCK_ALERTS + 1)
        : alerts;

    trimmed.push({
      id: nextStockAlertId(trimmed),
      productId: clean.productId,
      productName: product.name,
      contact: clean.contact,
      createdAt: new Date().toISOString(),
    });
    await writeStockAlerts(event, trimmed);

    // Уведомление админам: кто и о чём просит сообщить
    try {
      const env = event.context.cloudflare?.env;
      if (isTelegramConfigured(env)) {
        const origin = getRequestURL(event).origin;
        const text =
          `🔔 Запрос о поступлении\n` +
          `📦 «${product.name}» (id ${product.id})\n` +
          `👤 ${clean.contact}\n\n` +
          `Список заявок: ${origin}/admin/reviews`;
        for (const chatId of getAdminChatIds(env)) {
          await sendMessage(env, chatId, text);
        }
      }
    } catch (e) {
      console.warn('stock-alerts: telegram-уведомление не удалось', e);
    }

    return { success: true, message: 'Готово! Сообщим, когда товар появится' };
  } catch (error) {
    if (error instanceof StockAlertValidationError) {
      throw createError({ statusCode: 400, message: error.message });
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка сохранения заявки о поступлении:', error);
    throw createError({ statusCode: 500, message: 'Не удалось отправить заявку' });
  }
});
