// server/api/products/[id].put.js
import { readProducts, writeProducts, slugify, generateUniqueSlug } from '../../lib/productHelpers.js'
import { optimizeImage } from '../../lib/imageOptimizer.js'
import fs from 'fs/promises'
import path from 'path'

// Функция для сохранения изображений (аналогично index.post.js)
async function saveBase64Image(base64String, productId, imageType = 'main') {
  try {
    if (!base64String || !base64String.startsWith('data:image/')) {
      return base64String
    }

    const matches = base64String.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      return base64String
    }

    const originalFormat = matches[1]
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

async function processGalleryImages(gallery, productId) {
  if (!Array.isArray(gallery) || gallery.length === 0) {
    return []
  }
  
  const processedGallery = []
  
  for (let i = 0; i < gallery.length; i++) {
    const image = gallery[i]
    if (image && image.startsWith('data:image/')) {
      console.log(`🖼️ Обнаружено base64 изображение галереи ${i + 1}`)
      const savedUrl = await saveBase64Image(image, productId, `gallery-${i}`)
      processedGallery.push(savedUrl)
    } else if (image) {
      // Сохраняем только если изображение не пустое
      processedGallery.push(image)
    }
  }
  
  return processedGallery
}

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id
  
  // Проверяем что ID передан
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID товара не указан'
    })
  }
  
  try {
    const body = await readBody(event)
    
    if (!body || Object.keys(body).length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Нет данных для обновления'
      })
    }
    
    console.log(`📝 Обновление товара с ID: ${id}`)
    
    const products = await readProducts()
    
    // Гибкий поиск по ID (строка или число)
    const productIndex = products.findIndex(p => p.id === id || p.id === Number(id) || String(p.id) === id)
    
    if (productIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Товар не найден'
      })
    }
    
    const oldProduct = products[productIndex]
    
    // Удаляем старые изображения если они заменяются
    if (body.image && body.image !== oldProduct.image && body.image.startsWith('data:image/')) {
      // Удаляем старое основное изображение
      if (oldProduct.image && oldProduct.image.startsWith('/images/products/')) {
        try {
          const oldImagePath = path.resolve(process.cwd(), 'public', oldProduct.image.substring(1))
          await fs.unlink(oldImagePath).catch(() => {})
          console.log(`🗑️ Удалено старое изображение: ${oldProduct.image}`)
        } catch (e) {
          console.log(`⚠️ Не удалось удалить старое изображение: ${e.message}`)
        }
      }
      
      console.log('🖼️ Обновление основного изображения')
      body.image = await saveBase64Image(body.image, id, 'main')
    }
    
    // Обрабатываем галерею изображений
    let gallery = oldProduct.gallery || []
    if (Array.isArray(body.gallery) && body.gallery.length > 0) {
      const hasNewBase64Images = body.gallery.some(img => img && img.startsWith('data:image/'))
      if (hasNewBase64Images) {
        console.log('🖼️ Обновление галереи изображений')
        gallery = await processGalleryImages(body.gallery, id)
      } else {
        gallery = body.gallery
      }
    } else if (body.gallery !== undefined) {
      // Если передали пустой массив - очищаем галерею
      gallery = []
    }
    
    // Автоматически определяем inStock на основе stockQuantity
    const stockQuantity = parseInt(body.stockQuantity) ?? oldProduct.stockQuantity ?? 0
    const inStock = stockQuantity > 0
    
    // Создаем обновленный товар (сохраняем только переданные поля)
    const updatedProduct = {
      ...oldProduct,
      name: body.name ?? oldProduct.name,
      description: body.description ?? oldProduct.description,
      price: body.price !== undefined ? parseFloat(body.price) : oldProduct.price,
      image: body.image !== undefined ? body.image : oldProduct.image,
      categories: Array.isArray(body.categories) ? body.categories : oldProduct.categories,
      gallery: gallery,
      inStock: inStock,
      stockQuantity: stockQuantity,
      updatedAt: new Date().toISOString()
    }
    
    // Обновляем slug, если изменилось название
    if (body.name && body.name !== oldProduct.name) {
      const baseSlug = slugify(body.name)
      updatedProduct.slug = generateUniqueSlug(baseSlug, products, id)
    }
    
    // Заменяем товар в массиве
    products[productIndex] = updatedProduct
    
    // Сохраняем
    await writeProducts(products)
    
    console.log(`✅ Товар обновлен: ${updatedProduct.name}`)
    
    return { 
      success: true, 
      message: 'Товар успешно обновлен',
      product: updatedProduct
    }
    
  } catch (error) {
    // Если ошибка уже обработана (createError), пробрасываем дальше
    if (error.statusCode) throw error
    
    console.error('❌ Ошибка при обновлении товара:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Внутренняя ошибка сервера'
    })
  }
})