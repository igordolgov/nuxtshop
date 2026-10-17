// server/api/products/bulk.delete.js
import { readProducts, writeProducts } from '../../lib/productHelpers'
import { applyBulkDelete, normalizeIdList } from '../../lib/bulkHelpers'
import { requireAdmin } from '../../utils/auth'

// DELETE /api/products/bulk  { ids }
// Массовое удаление одним запросом и одной записью KV.
// Тело запроса читается и из DELETE — h3 readBody это поддерживает.
export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)

    const ids = normalizeIdList(body?.ids)
    if (!ids || ids.length === 0) {
      throw createError({ statusCode: 400, message: 'Не выбран ни один товар' })
    }

    const products = await readProducts(event)
    const { remaining, deleted } = applyBulkDelete(products, ids)

    if (deleted.length > 0) {
      await writeProducts(event, remaining)
    }

    return {
      success: true,
      deletedCount: deleted.length,
      deletedIds: deleted.map((p) => p.id),
      message: `Удалено товаров: ${deleted.length}`,
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка массового удаления товаров:', error)
    throw createError({ statusCode: 500, message: 'Не удалось выполнить массовое удаление' })
  }
})
