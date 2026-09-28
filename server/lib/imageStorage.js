// server/lib/imageStorage.js
/**
 * Хранилище картинок для Cloudflare Workers.
 *
 * ВАЖНО: на Workers нет fs. Временно сохраняем картинки как base64
 * data-URI прямо в JSON товара. Это раздувает JSON, но работает без
 * внешних сервисов.
 *
 * Правильное решение — Cloudflare R2. Настроить биндинг BLOB в
 * wrangler.jsonc и заменить эту реализацию.
 */

import { optimizeImage, calculateQuality } from './imageOptimizer.js'

/**
 * Оптимизирует картинку и возвращает data-URI.
 */
export async function processImage(base64String, imageType = 'main') {
  if (!base64String || !base64String.startsWith('data:image/')) {
    return base64String
  }

  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) return base64String

    const base64Data = matches[2]
    const imageBuffer = Buffer.from(base64Data, 'base64')

    console.log(`🖼️ Оптимизация ${imageType}: ${(imageBuffer.length / 1024).toFixed(1)} KB`)

    const optimizedBuffer = await optimizeImage(imageBuffer, {
      maxWidth: imageType === 'main' ? 1200 : 800,
      maxHeight: imageType === 'main' ? 1200 : 800,
      format: 'webp',
      quality: typeof calculateQuality === 'function' ? calculateQuality(imageBuffer.length) : 85,
    })

    const saved = ((1 - optimizedBuffer.length / imageBuffer.length) * 100).toFixed(0)
    console.log(`✅ Оптимизировано: ${(optimizedBuffer.length / 1024).toFixed(1)} KB (-${saved}%)`)

    return `data:image/webp;base64,${optimizedBuffer.toString('base64')}`
  } catch (error) {
    console.error('❌ Ошибка оптимизации, используем оригинал:', error.message)
    return base64String
  }
}

/**
 * Обрабатывает массив картинок галереи.
 */
export async function processGallery(gallery) {
  if (!Array.isArray(gallery) || gallery.length === 0) return []

  const processed = []
  for (let i = 0; i < gallery.length; i++) {
    const image = gallery[i]
    if (image && image.startsWith('data:image/')) {
      processed.push(await processImage(image, `gallery-${i}`))
    } else if (image) {
      processed.push(image)
    }
  }
  return processed
}