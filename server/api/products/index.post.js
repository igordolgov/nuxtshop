// server/api/products/index.post.js
import { readProducts, writeProducts, slugify, generateUniqueSlug } from '../../lib/productHelpers'
import { requireAdmin } from '../../utils/auth'
import { processImage, processGallery } from '../../lib/imageStorage'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)
    if (!body?.name?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Название товара обязательно' })
    }
    if (!body.price || Number.isNaN(parseFloat(body.price))) {
      throw createError({ statusCode: 400, statusMessage: 'Цена товара обязательна' })
    }

    const products = await readProducts(event)

    const newId = products.length > 0 ? Math.max(...products.map((p) => Number(p.id) || 0)) + 1 : 1
    const slug = generateUniqueSlug(slugify(body.name) || `product-${newId}`, products)

    let imageUrl = body.image || '/images/products/placeholder.webp'
    if (body.image?.startsWith('data:image/')) {
      imageUrl = await processImage(body.image, 'main')
    }
    const gallery = await processGallery(body.gallery)

    const stockQuantity = parseInt(body.stockQuantity) || 0
    let categories = ['Другое']
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      categories = body.categories
    } else if (body.categoriesInput) {
      categories = body.categoriesInput.split(',').map((c) => c.trim()).filter(Boolean)
    }

    const now = new Date().toISOString()
    const newProduct = {
      id: String(newId),
      slug,
      name: body.name.trim(),
      description: body.description || '',
      price: parseFloat(body.price),
      image: imageUrl,
      categories,
      gallery,
      inStock: stockQuantity > 0,
      stockQuantity,
      characteristics: body.characteristics || {},
      createdAt: now,
      updatedAt: now,
    }

    products.push(newProduct)
    await writeProducts(event, products)

    return { success: true, product: newProduct, message: 'Товар успешно добавлен' }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка добавления товара:', error)
    throw createError({ statusCode: 500, statusMessage: 'Не удалось добавить товар' })
  }
})