// server/lib/imageStorage.js
/**
 * Хранилище картинок для Cloudflare Workers.
 *
 * Основной режим — Cloudflare R2 (биндинг IMAGES_BUCKET в wrangler.jsonc):
 * картинка кладётся в бакет, товар получает короткий путь
 * /api/images/<key>, который отдаёт server/routes/api/images/[...key].get.ts
 * с кэшем «год, immutable» (ключи уникальны per-upload). Это убирает
 * base64-раздувание products.json/KV (было +33% к весу) и даёт картинкам
 * собственный кэш в браузере и на CDN.
 *
 * Fallback (биндинга нет: локальный `nuxt dev`, R2 не настроен) —
 * прежнее поведение: data-URI прямо в JSON товара.
 */

import { optimizeImage, calculateQuality } from './imageOptimizer.js'

/**
 * R2-бакет из биндингов воркера (или null — в dev/без настройки).
 * @param {import('h3').H3Event} event
 */
function getR2(event) {
  return event?.context?.cloudflare?.env?.IMAGES_BUCKET ?? null
}

/** Расширение файла по MIME из data-URI (jpeg→jpg, svg+xml→svg). */
function extFromMime(mime) {
  const map = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', avif: 'avif', 'svg+xml': 'svg' }
  return map[mime?.toLowerCase()] || 'bin'
}

/**
 * Сохраняет картинку: в R2 (если биндинг есть) или в data-URI (fallback).
 * @returns {string} URL для товара: "/api/images/products/…" или data-URI
 */
export async function processImage(event, base64String, imageType = 'main') {
  if (!base64String || !base64String.startsWith('data:image/')) {
    return base64String
  }

  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) return base64String

    const mime = matches[1]
    const imageBuffer = Buffer.from(matches[2], 'base64')

    const r2 = getR2(event)
    if (!r2) {
      // Fallback без R2 — как раньше: оптимизация-заглушка + data-URI
      console.log(`🖼️ Оптимизация ${imageType}: ${(imageBuffer.length / 1024).toFixed(1)} KB (R2 недоступен — data-URI)`)
      const optimizedBuffer = await optimizeImage(imageBuffer, {
        maxWidth: imageType === 'main' ? 1200 : 800,
        maxHeight: imageType === 'main' ? 1200 : 800,
        format: 'webp',
        quality: typeof calculateQuality === 'function' ? calculateQuality(imageBuffer.length) : 85,
      })
      return `data:image/webp;base64,${optimizedBuffer.toString('base64')}`
    }

    // Основной путь: кладём в R2 под уникальный ключ.
    // Контент не перекодируем (optimizeImage на Workers — passthrough),
    // поэтому расширение соответствует фактическому формату upload-а.
    const key = `products/product-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extFromMime(mime)}`
    await r2.put(key, imageBuffer, { httpMetadata: { contentType: `image/${mime}` } })
    console.log(`✅ ${imageType}: ${(imageBuffer.length / 1024).toFixed(1)} KB → R2 ${key}`)

    return `/api/images/${key}`
  } catch (error) {
    console.error('❌ Ошибка сохранения картинки, используем оригинал:', error.message)
    return base64String
  }
}

/**
 * Обрабатывает массив картинок галереи.
 */
export async function processGallery(event, gallery) {
  if (!Array.isArray(gallery) || gallery.length === 0) return []

  const processed = []
  for (let i = 0; i < gallery.length; i++) {
    const image = gallery[i]
    if (image && image.startsWith('data:image/')) {
      processed.push(await processImage(event, image, `gallery-${i}`))
    } else if (image) {
      processed.push(image)
    }
  }
  return processed
}
