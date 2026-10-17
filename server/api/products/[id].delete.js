// server/api/products/[id].delete.js
import { readProducts, writeProducts } from '../../lib/productHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID товара не указан' })
    }

    const products = await readProducts(event)
    const index = products.findIndex((p) => String(p.id) === String(id))
    if (index === -1) {
      throw createError({ statusCode: 404, message: 'Товар не найден' })
    }

    const deleted = products[index]
    products.splice(index, 1)
    await writeProducts(event, products)

    // Картинки data-URI живут внутри JSON товара — отдельная очистка файлов не нужна
    return { success: true, message: `Товар "${deleted.name}" удалён`, deletedId: deleted.id }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка удаления товара:', error)
    throw createError({ statusCode: 500, message: 'Не удалось удалить товар' })
  }
})