// server/api/products/bulk.patch.ts
import { readProducts, writeProducts } from '../../lib/productHelpers';
import { applyBulkPatch, normalizeIdList, parseBulkPatch } from '../../lib/bulkHelpers';
import { requireStaff } from '../../utils/auth';
import { adminActionLog } from '../../lib/logger';
import { findRestockedProducts, notifyRestockSubscribers } from '../../lib/stockAlertNotify';
import { getAdminChatIds, sendMessage } from '../../lib/telegram';

// PATCH /api/products/bulk  { ids, inStock?, stockQuantity?, setCategories?/addCategories?/removeCategories? }
// Массовое изменение: один запрос и одна запись KV на весь список
// выбранных товаров (вместо N последовательных PUT).
export default defineEventHandler(async (event) => {
  try {
    const staff = await requireStaff(event);

    const body = await readBody<Record<string, unknown>>(event);

    const ids = normalizeIdList(body?.ids);
    if (!ids || ids.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Не выбран ни один товар',
        data: { code: 'bulkNoIds' },
      });
    }

    // Валидация полей патча (тексты ошибок видит клиент)
    const patch = parseBulkPatch(body);
    if (!patch.hasChanges) {
      throw createError({
        statusCode: 400,
        message: 'Не указано ни одного изменения',
        data: { code: 'bulkNoChanges' },
      });
    }

    const products = await readProducts(event);
    const { updated, skipped } = applyBulkPatch(products, ids, patch);

    if (updated.length > 0) {
      const byId = new Map(updated.map((p) => [p.id, p]));
      await writeProducts(
        event,
        products.map((p) => byId.get(p.id) ?? p),
      );
    }

    // ── Поступление при массовой правке: те же уведомления заявок.
    // Best-effort: сбой бота не отменяет сохранение.
    const env = event.context.cloudflare?.env;
    const restocked = findRestockedProducts(products, updated);
    if (env?.TELEGRAM_BOT_TOKEN && restocked.length > 0) {
      try {
        const origin = getRequestURL(event).origin;
        const { sent } = await notifyRestockSubscribers(event, env, restocked, origin);
        if (sent > 0) {
          for (const chatId of getAdminChatIds(env)) {
            await sendMessage(
              env,
              chatId,
              `📤 Массовая правка: о поступлении уведомлено — ${sent}`,
            );
          }
        }
      } catch (e) {
        console.warn('[stock-alerts] уведомление о поступлении не удалось:', e);
      }
    }

    // Массовая правка — действие с широким радиусом, логируем размах
    adminActionLog.add({
      action: 'PRODUCTS_BULK_PATCHED',
      actor: { id: staff.id, email: staff.email, role: staff.role },
      updatedCount: updated.length,
      fields: Object.keys(patch).filter((k) => k !== 'hasChanges'),
    });

    return {
      success: true,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      skipped,
      products: updated,
      message: `Обновлено товаров: ${updated.length}`,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка массового обновления товаров:', error);
    throw createError({
      statusCode: 500,
      message: 'Не удалось выполнить массовое обновление',
      data: { code: 'bulkUpdateFailed' },
    });
  }
});
