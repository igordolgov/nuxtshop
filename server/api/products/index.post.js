// server/api/products/index.post.js
import { readProducts, writeProducts, slugify, generateUniqueSlug } from '../../lib/productHelpers.js'
import { optimizeImage, calculateQuality } from '../../lib/imageOptimizer.js'
import fs from 'fs/promises'
import path from 'path'

// Fallback - сохранение оригинала при ошибке оптимизации
async function saveOriginalImage(base64String, productId, imageType = 'main') {
  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) return base64String

    const imageFormat = matches[1]
    const base64Data = matches[2]
    
    const ext = imageFormat === 'jpeg' ? 'jpg' : imageFormat
    const fileName = `product-${productId}-${imageType}-${Date.now()}.${ext}`
    const filePath = path.resolve(process.cwd(), 'public', 'images', 'products', fileName)
    
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'))
    
    return `/images/products/${fileName}`
  } catch (error) {
    console.error('❌ Ошибка сохранения оригинала:', error)
    return base64String
  }
}

async function saveBase64Image(base64String, productId, imageType = 'main') {
  try {
    if (!base64String || !base64String.startsWith('data:image/')) {
      return base64String
    }

    const matches = base64String.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) return base64String

    const base64Data = matches[2]
    const imageBuffer = Buffer.from(base64Data, 'base64')
    
    console.log(`🖼️ Оптимизация ${imageType}: ${(imageBuffer.length / 1024).toFixed(1)} KB`)
    
    const optimizedBuffer = await optimizeImage(imageBuffer, {
      maxWidth: imageType === 'main' ? 1200 : 800,
      maxHeight: imageType === 'main' ? 1200 : 800,
      format: 'webp',
      quality: calculateQuality(imageBuffer.length)
    })
    
    const saved = ((1 - optimizedBuffer.length / imageBuffer.length) * 100).toFixed(0)
    console.log(`✅ Оптимизировано: ${(optimizedBuffer.length / 1024).toFixed(1)} KB (-${saved}%)`)
    
    const fileName = `product-${productId}-${imageType}-${Date.now()}.webp`
    const filePath = path.resolve(process.cwd(), 'public', 'images', 'products', fileName)
    
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, optimizedBuffer)
    
    return `/images/products/${fileName}`
    
  } catch (error) {
    console.error('❌ Ошибка оптимизации, сохраняем оригинал:', error.message)
    return await saveOriginalImage(base64String, productId, imageType)
  }
}

async function processGalleryImages(gallery, productId) {
  if (!Array.isArray(gallery) || gallery.length === 0) return []
  
  const processed = []
  
  for (let i = 0; i < gallery.length; i++) {
    const image = gallery[i]
    if (image && image.startsWith('data:image/')) {
      processed.push(await saveBase64Image(image, productId, `gallery-${i}`))
    } else if (image) {
      processed.push(image)
    }
  }
  
  return processed
}

export default defineEventHandler(async (event) => {
  try {
    // Надёжное чтение body
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
    
    // Валидация
    if (!body.name?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Название товара обязательно' })
    }
    if (!body.price || isNaN(parseFloat(body.price))) {
      throw createError({ statusCode: 400, statusMessage: 'Цена товара обязательна' })
    }
    
    const products = await readProducts()
    
    // Генерируем уникальный ID (инкремент)
    const newId = products.length > 0 
      ? Math.max(...products.map(p => Number(p.id) || 0)) + 1 
      : 1
    const productId = String(newId)
    
    // Генерируем уникальный slug
    const baseSlug = slugify(body.name) || `product-${newId}`
    const slug = generateUniqueSlug(baseSlug, products)
    
    // Обрабатываем изображения
    let imageUrl = body.image || '/images/products/placeholder.webp'
    if (body.image?.startsWith('data:image/')) {
      imageUrl = await saveBase64Image(body.image, productId, 'main')
    }
    
    const gallery = await processGalleryImages(body.gallery, productId)
    
    // Определяем наличие
    const stockQuantity = parseInt(body.stockQuantity) || 0
    const inStock = stockQuantity > 0
    
    // Парсим категории
    let categories = ['Другое']
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      categories = body.categories
    } else if (body.categoriesInput) {
      categories = body.categoriesInput.split(',').map(c => c.trim()).filter(Boolean)
    }
    
    // Создаём товар
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
      updatedAt: new Date().toISOString()
    }
    
    products.push(newProduct)
    await writeProducts(products)
    
    console.log(`✅ Товар добавлен: ${newProduct.name} (ID: ${newProduct.id})`)
    
    return { 
      success: true, 
      product: newProduct,
      message: 'Товар успешно добавлен'
    }
    
  } catch (error) {
    if (error.statusCode) throw error
    
    console.error('❌ Ошибка добавления товара:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Не удалось добавить товар: ' + error.message
    })
  }
})