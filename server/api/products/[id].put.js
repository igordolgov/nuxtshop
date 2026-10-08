// server/api/products/[id].put.js
import { readProducts, writeProducts, slugify, generateUniqueSlug } from '../../lib/productHelpers'
import { requireAdmin } from '../../utils/auth'
import { processImage, processGallery } from '../../lib/imageStorage'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'ID товара не указан', message: 'ID товара не указан' })
    }

    const body = await readBody(event)

    const products = await readProducts(event)
    const index = products.findIndex((p) => String(p.id) === String(id))
    if (index === -1) {
      throw createError({ statusCode: 404, statusMessage: 'Товар не найден', message: 'Товар не найден' })
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

    let categories = existing.categories
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      categories = body.categories
    } else if (body.categoriesInput) {
      categories = body.categoriesInput.split(',').map((c) => c.trim()).filter(Boolean)
    }

    const updated = {
      ...existing,
      name: body.name?.trim() ?? existing.name,
      description: body.description ?? existing.description,
      price: body.price !== undefined ? parseFloat(body.price) : existing.price,
      image: imageUrl,
      gallery,
      categories,
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
    throw createError({ statusCode: 500, statusMessage: 'Не удалось обновить товар', message: 'Не удалось обновить товар' })
  }
})