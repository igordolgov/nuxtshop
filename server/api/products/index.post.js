// server/api/products/index.post.js
import { readProducts, writeProducts, slugify, generateUniqueSlug } from '../../lib/productHelpers.js'
import { processImage, processGallery } from '../../lib/imageStorage.js'

export default defineEventHandler(async (event) => {
  try {
    let body
    try {
      body = await readBody(event)
    } catch {
      const rawBody = await readRawBody(event, 'utf-8')
      if (rawBody) body = JSON.parse(rawBody)
    }

    if (!body) {
      throw createError({ statusCode: 400, statusMessage: 'Нет данных товара' })
    }

    if (!body.name?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Название товара обязательно' })
    }
    if (!body.price || isNaN(parseFloat(body.price))) {
      throw createError({ statusCode: 400, statusMessage: 'Цена товара обязательна' })
    }

    const products = await readProducts()

    const newId =
      products.length > 0 ? Math.max(...products.map((p) => Number(p.id) || 0)) + 1 : 1
    const productId = String(newId)

    const baseSlug = slugify(body.name) || `product-${newId}`
    const slug = generateUniqueSlug(baseSlug, products)

    // Обрабатываем картинки — сохраняем как data-URI
    let imageUrl = body.image || '/images/products/placeholder.webp'
    if (body.image?.startsWith('data:image/')) {
      imageUrl = await processImage(body.image, 'main')
    }

    const gallery = await processGallery(body.gallery)

    const stockQuantity = parseInt(body.stockQuantity) || 0
    const inStock = stockQuantity > 0

    let categories = ['Другое']
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      categories = body.categories
    } else if (body.categoriesInput) {
      categories = body.categoriesInput.split(',').map((c) => c.trim()).filter(Boolean)
    }

    const newProduct = {
      id: productId,
      slug,
      name: body.name.trim(),
      description: body.description || '',
      price: parseFloat(body.price),
      image: imageUrl,
      categories,
      gallery,
      inStock,
      stockQuantity,
      characteristics: body.characteristics || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    products.push(newProduct)
    await writeProducts(products)

    console.log(`✅ Товар добавлен: ${newProduct.name} (ID: ${newProduct.id})`)

    return { success: true, product: newProduct, message: 'Товар успешно добавлен' }
  } catch (error) {
    if (error.statusCode) throw error

    console.error('❌ Ошибка добавления товара:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Не удалось добавить товар: ' + error.message,
    })
  }
})