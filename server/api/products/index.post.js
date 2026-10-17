// server/api/products/index.post.js
// Создание товара (POST /api/products). Только админ.
// Категории ОБЯЗАТЕЛЬНЫ, форматы нормализует normalizeCategories
// (в productHelpers, общая с PUT):
//   categories: ['Электроника']         — массив строк
//   categories: 'Электроника, Техника'  — строка через запятую
//   categoriesInput: '...'              — строка через запятую (форма админки)
// Фиктивная категория «Другое» больше не подставляется:
// раньше она записывалась в KV при пустом поле и доезжала до корзины.
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

    const body = await readBody(event)
    if (!body?.name?.trim()) {
      throw createError({ statusCode: 400, message: 'Название товара обязательно' })
    }
    if (!body.price || Number.isNaN(parseFloat(body.price))) {
      throw createError({ statusCode: 400, message: 'Цена товара обязательна' })
    }

    // Категории: обязательны (сообщения согласованы с валидацией в админке).
    // null → поле не пришло; для POST это так же пусто, как []
    const categories = normalizeCategories(body) ?? []
    if (categories.length === 0) {
      throw createError({ statusCode: 400, message: 'Укажите хотя бы одну категорию' })
    }

    const products = await readProducts(event)

    const newId = products.length > 0 ? Math.max(...products.map((p) => Number(p.id) || 0)) + 1 : 1
    const slug = generateUniqueSlug(slugify(body.name) || `product-${newId}`, products)

    // Fallback-картинка — СУЩЕСТВУЮЩИЙ файл (раньше был
    // /images/products/placeholder.webp, которого нет в public/images)
    let imageUrl = body.image || '/images/placeholder.jpg'
    if (body.image?.startsWith('data:image/')) {
      imageUrl = await processImage(body.image, 'main')
    }
    const gallery = await processGallery(body.gallery)

    const stockQuantity = parseInt(body.stockQuantity) || 0

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
    throw createError({ statusCode: 500, message: 'Не удалось добавить товар' })
  }
})