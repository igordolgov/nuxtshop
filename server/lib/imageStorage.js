// server/lib/imageStorage.js
/**
 * Хранилище картинок для Cloudflare Workers.
 *
 * Картинка кладётся в отдельное хранилище, товар получает короткий путь
 * /api/images/<key>, который отдаёт server/routes/api/images/[...key].ts
 * с кэшем «год, immutable» (ключи уникальны per-upload). Это убирает
 * base64-раздувание products.json/KV (было +33% к весу) и даёт картинкам
 * собственный кэш в браузере.
 *
 * Приоритет хранилищ:
 *   1) R2 (биндинг IMAGES_BUCKET) — опционально, если когда-нибудь
 *      будет включён на аккаунте (включение требует платёжной карты);
 *   2) Workers KV (биндинг KV — тот же namespace, где лежит каталог)
 *      под префиксом "img:" — работает сразу, без дашборда и карт;
 *   3) Fallback (биндингов нет: локальный `nuxt dev`) — data-URI
 *      прямо в JSON товара, как раньше.
 */

import { optimizeImage, calculateQuality } from './imageOptimizer.js'

/** Префикс ключей картинок в KV (namespace общий с каталогом data:products). */
export const IMAGE_KV_PREFIX = 'img:'

/** Расширение файла по MIME из data-URI (jpeg→jpg, svg+xml→svg). */
function extFromMime(mime) {
  const map = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', avif: 'avif', 'svg+xml': 'svg' }
  return map[mime?.toLowerCase()] || 'bin'
}

/**
 * Кладёт картинку в хранилище (R2 или KV) под уникальный ключ.
 * @returns {{ key: string, where: string } | null} ключ products/… или null,
 *          если ни одного хранилища нет
 */
async function putImage(env, imageBuffer, mime) {
  const key = `products/product-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extFromMime(mime)}`
  const contentType = `image/${mime}`

  if (env.IMAGES_BUCKET) {
    await env.IMAGES_BUCKET.put(key, imageBuffer, { httpMetadata: { contentType } })
    return { key, where: 'R2' }
  }
  if (env.KV) {
    // KV принимает ArrayBuffer/TypedArray: Buffer — подкласс Uint8Array.
    await env.KV.put(IMAGE_KV_PREFIX + key, imageBuffer, { metadata: { contentType } })
    return { key, where: 'KV' }
  }
  return null
}

/**
 * Сохраняет картинку: в R2/KV (если биндинг есть) или в data-URI (fallback).
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

    const env = event?.context?.cloudflare?.env
    if (env && (env.IMAGES_BUCKET || env.KV)) {
      // Контент не перекодируем (optimizeImage на Workers — passthrough),
      // поэтому расширение соответствует фактическому формату upload-а.
      const saved = await putImage(env, imageBuffer, mime)
      if (saved) {
        console.log(`✅ ${imageType}: ${(imageBuffer.length / 1024).toFixed(1)} KB → ${saved.where} ${saved.key}`)
        return `/api/images/${saved.key}`
      }
    }

    // Fallback без биндингов — как раньше: оптимизация-заглушка + data-URI
    console.log(`🖼️ Оптимизация ${imageType}: ${(imageBuffer.length / 1024).toFixed(1)} KB (хранилище недоступно — data-URI)`)
    const optimizedBuffer = await optimizeImage(imageBuffer, {
      maxWidth: imageType === 'main' ? 1200 : 800,
      maxHeight: imageType === 'main' ? 1200 : 800,
      format: 'webp',
      quality: typeof calculateQuality === 'function' ? calculateQuality(imageBuffer.length) : 85,
    })
    return `data:image/webp;base64,${optimizedBuffer.toString('base64')}`
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
