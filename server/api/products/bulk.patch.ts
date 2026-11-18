// server/api/products/bulk.patch.ts
import { readProducts, writeProducts } from '../../lib/productHelpers';
import { applyBulkPatch, normalizeIdList, parseBulkPatch } from '../../lib/bulkHelpers';
import { requireStaff } from '../../utils/auth';
import { adminActionLog } from '../../lib/logger';
import { diffProduct, recordProductHistory } from '../../lib/productHistory';
import {
  findRestockedProducts,
  formatRestockAdminSummary,
  notifyRestockSubscribers,
  reportRestockToAdmins,
} from '../../lib/stockAlertNotify';

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

    // ── Поступление при массовой правке: те же уведомления заявок +
    // сводка админам ВСЕГДА (даже sent=0 — видно, кому связываться вручную).
    // Best-effort: сбой бота не отменяет сохранение.
    const env = event.context.cloudflare?.env;
    const restocked = findRestockedProducts(products, updated);
    if (env?.TELEGRAM_BOT_TOKEN && restocked.length > 0) {
      try {
        const origin = getRequestURL(event).origin;
        const result = await notifyRestockSubscribers(event, env, restocked, origin);
        await reportRestockToAdmins(
          env,
          formatRestockAdminSummary({
            names: restocked.map((p) => p.name ?? ''),
            sent: result.sent,
            pendingContacts: result.pendingContacts,
          }),
        );
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

    // ── История изменений по каждому товару: дифф до/после массовой
    // правки. products ещё держит СТАРЫЕ объекты (writeProducts собрал
    // новый массив, не мутируя старый) — сравниваем с updated.
    const oldById = new Map(products.map((p) => [p.id, p]));
    for (const p of updated) {
      const changes = diffProduct(oldById.get(p.id) ?? null, p);
      if (changes.length > 0) {
        await recordProductHistory(event, {
          id: p.id,
          actor: { id: staff.id, email: staff.email, role: staff.role },
          action: 'updated',
          productName: p.name,
          changes,
        });
      }
    }

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
