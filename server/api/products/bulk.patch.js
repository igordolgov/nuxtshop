// server/api/products/bulk.patch.js
import { readProducts, writeProducts } from '../../lib/productHelpers'
import { applyBulkPatch, normalizeIdList, parseBulkPatch } from '../../lib/bulkHelpers'
import { requireAdmin } from '../../utils/auth'

// PATCH /api/products/bulk  { ids, inStock?, stockQuantity?, setCategories?/addCategories?/removeCategories? }
// Массовое изменение: один запрос и одна запись KV на весь список
// выбранных товаров (вместо N последовательных PUT).
export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)

    const ids = normalizeIdList(body?.ids)
    if (!ids || ids.length === 0) {
      throw createError({ statusCode: 400, message: 'Не выбран ни один товар' })
    }

    // Валидация полей патча (тексты ошибок видит клиент)
    const patch = parseBulkPatch(body)
    if (!patch.hasChanges) {
      throw createError({ statusCode: 400, message: 'Не указано ни одного изменения' })
    }

    const products = await readProducts(event)
    const { updated, skipped } = applyBulkPatch(products, ids, patch)

    if (updated.length > 0) {
      const byId = new Map(updated.map((p) => [p.id, p]))
      await writeProducts(
        event,
        products.map((p) => byId.get(p.id) ?? p),
      )
    }

    return {
      success: true,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      skipped,
      products: updated,
      message: `Обновлено товаров: ${updated.length}`,
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка массового обновления товаров:', error)
    throw createError({ statusCode: 500, message: 'Не удалось выполнить массовое обновление' })
  }
})
