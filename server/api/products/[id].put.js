// server/api/products/[id].put.js
import {
  readProducts,
  writeProducts,
  slugify,
  generateUniqueSlug,
  normalizeCategories,
} from '../../lib/productHelpers'
import { requireAdmin } from '../../utils/auth'
import { processImage, processGallery } from '../../lib/imageStorage'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID товара не указан' })
    }

    const body = await readBody(event)

    const products = await readProducts(event)
    const index = products.findIndex((p) => String(p.id) === String(id))
    if (index === -1) {
      throw createError({ statusCode: 404, message: 'Товар не найден' })
    }

    const existing = products[index]

    // Slug: если изменилось имя — генерируем заново, иначе оставляем
    let slug = existing.slug
    if (body.name && body.name.trim() !== existing.name) {
      slug = generateUniqueSlug(slugify(body.name), products, existing.id)
    }

    let imageUrl = existing.image
    if (body.image?.startsWith('data:image/')) {
      imageUrl = await processImage(body.image, 'main')
    } else if (body.image) {
      imageUrl = body.image
    }

    const gallery =
      body.gallery !== undefined ? await processGallery(body.gallery) : existing.gallery

    const stockQuantity =
      body.stockQuantity !== undefined ? parseInt(body.stockQuantity) || 0 : existing.stockQuantity

    // Категории: нормализуем все поддерживаемые форматы (массив, [{name}], CSV).
    // Поле пришло пустым — явная ошибка, а не молчаливое сохранение старых
    // (раньше очистка поля в редакторе незаметно оставляла прежние категории).
    // Поле не пришло вовсе (null) — категории не трогаем.
    const categories = normalizeCategories(body)
    if (categories !== null && categories.length === 0) {
      throw createError({ statusCode: 400, message: 'Укажите хотя бы одну категорию' })
    }

    const updated = {
      ...existing,
      name: body.name?.trim() ?? existing.name,
      description: body.description ?? existing.description,
      price: body.price !== undefined ? parseFloat(body.price) : existing.price,
      image: imageUrl,
      gallery,
      categories: categories ?? existing.categories,
      inStock: stockQuantity > 0,
      stockQuantity,
      characteristics: body.characteristics ?? existing.characteristics,
      slug,
      updatedAt: new Date().toISOString(),
    }

    products[index] = updated
    await writeProducts(event, products)

    return { success: true, product: updated, message: 'Товар обновлён' }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка обновления товара:', error)
    throw createError({ statusCode: 500, message: 'Не удалось обновить товар' })
  }
})