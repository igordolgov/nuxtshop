// server/api/products/add.post.js
import { readProducts, writeProducts, slugify, generateUniqueSlug } from '../../lib/productHelpers.js'
import { optimizeImage } from '../../lib/imageOptimizer.js'
import fs from 'fs/promises'
import path from 'path'

// Функция для сохранения base64 изображений
async function saveBase64Image(base64String, productId, imageType = 'main') {
  try {
    if (!base64String || !base64String.startsWith('data:image/')) {
      return base64String
    }

    const matches = base64String.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      return base64String
    }

    const base64Data = matches[2]
    const imageBuffer = Buffer.from(base64Data, 'base64')
    
    console.log(`🖼️ Оптимизация изображения ${imageType}, исходный размер: ${(imageBuffer.length / 1024).toFixed(2)} KB`)
    
    const optimizationOptions = {
      maxWidth: imageType === 'main' ? 1200 : 800,
      maxHeight: imageType === 'main' ? 1200 : 800,
      format: 'webp',
      quality: 85
    }
    
    const optimizedBuffer = await optimizeImage(imageBuffer, optimizationOptions)
    
    console.log(`✅ Изображение оптимизировано, размер после: ${(optimizedBuffer.length / 1024).toFixed(2)} KB`)
    
    const fileName = `product-${productId}-${imageType}-${Date.now()}.webp`
    const filePath = path.resolve(process.cwd(), 'public', 'images', 'products', fileName)
    
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    
    await fs.writeFile(filePath, optimizedBuffer)
    
    return `/images/products/${fileName}`
    
  } catch (error) {
    console.error('❌ Ошибка оптимизации изображения:', error)
    return base64String
  }
}

// Обработка галереи изображений
async function processGalleryImages(gallery, productId) {
  if (!Array.isArray(gallery) || gallery.length === 0) {
    return []
  }
  
  const processedGallery = []
  
  for (let i = 0; i < gallery.length; i++) {
    const image = gallery[i]
    if (image && image.startsWith('data:image/')) {
      console.log(`🖼️ Обработка изображения галереи ${i + 1}`)
      const savedUrl = await saveBase64Image(image, productId, `gallery-${i}`)
      processedGallery.push(savedUrl)
    } else if (image) {
      processedGallery.push(image)
    }
  }
  
  return processedGallery
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Валидация обязательных полей
    if (!body.name || !body.name.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Название товара обязательно'
      })
    }
    
    if (body.price === undefined || body.price === null || isNaN(parseFloat(body.price))) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Цена товара обязательна'
      })
    }
    
    const products = await readProducts()
    
    // Генерируем новый ID
    const newId = products.length > 0 
      ? Math.max(...products.map(p => Number(p.id) || 0)) + 1 
      : 1
    
    // Генерируем уникальный slug
    const baseSlug = slugify(body.name) || `product-${newId}`
    const finalSlug = generateUniqueSlug(baseSlug, products)
    
    // Обрабатываем изображение
    let imageUrl = body.image || '/images/products/placeholder.webp'
    if (body.image && body.image.startsWith('data:image/')) {
      console.log('🖼️ Обработка основного изображения')
      imageUrl = await saveBase64Image(body.image, newId, 'main')
    }
    
    // Обрабатываем галерею
    const gallery = await processGalleryImages(body.gallery, newId)
    
    // Определяем наличие на складе
    const stockQuantity = parseInt(body.stockQuantity) || 0
    const inStock = stockQuantity > 0
    
    // Создаём новый товар с правильной структурой
    const newProduct = {
      id: String(newId),
      slug: finalSlug,
      name: body.name.trim(),
      description: body.description || '',
      price: parseFloat(body.price),
      image: imageUrl,
      gallery: gallery,
      categories: Array.isArray(body.categories) ? body.categories : [],
      inStock: inStock,
      stockQuantity: stockQuantity,
      characteristics: body.characteristics || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    products.push(newProduct)
    await writeProducts(products)
    
    console.log(`✅ Товар добавлен: ${newProduct.name} (ID: ${newProduct.id}, slug: ${newProduct.slug})`)
    
    return { 
      success: true, 
      message: 'Товар успешно добавлен',
      product: newProduct
    }
    
  } catch (error) {
    if (error.statusCode) throw error
    
    console.error('❌ Ошибка при добавлении товара:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Внутренняя ошибка сервера'
    })
  }
})