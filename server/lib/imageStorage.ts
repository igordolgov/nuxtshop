// server/lib/imageStorage.ts
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

import type { H3Event } from 'h3'
import { optimizeImage, calculateQuality } from './imageOptimizer'

/** Префикс ключей картинок в KV (namespace общий с каталогом data:products). */
export const IMAGE_KV_PREFIX = 'img:'

/** Минимальные структурные типы биндингов (по образцу routes/api/images) */
interface R2PutBucket {
  put(key: string, value: Buffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
}

interface KVImageStore {
  put(key: string, value: Buffer, options?: { metadata?: { contentType?: string } }): Promise<unknown>
}

interface ImageEnv {
  IMAGES_BUCKET?: R2PutBucket
  KV?: KVImageStore
}

/** Результат сохранения: ключ в хранилище и имя хранилища (для лога) */
interface SavedImage {
  key: string
  where: 'R2' | 'KV'
}

/** Расширение файла по MIME из data-URI (jpeg→jpg, svg+xml→svg). */
function extFromMime(mime: string | undefined): string {
  const map: Record<string, string> = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
    avif: 'avif',
    'svg+xml': 'svg',
  }
  return map[mime?.toLowerCase() ?? ''] || 'bin'
}

/**
 * Кладёт картинку в хранилище (R2 или KV) под уникальный ключ.
 * @param keyStem начало ключа без суффикса: «products/product»
 *        (каталог, по умолчанию) или «news/news» (фото новостей из админки).
 * @returns ключ вида stem-… или null, если ни одного хранилища нет
 */
async function putImage(
  env: ImageEnv,
  imageBuffer: Buffer,
  mime: string,
  keyStem = 'products/product',
): Promise<SavedImage | null> {
  const key = `${keyStem}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extFromMime(mime)}`
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
 * @param keyStem префикс ключа хранилища: "products/product" или
 *        "news/news" — ключи разложены по папкам, раздача общая /api/images/<key>.
 * @returns URL картинки: "/api/images/<stem>-…" или data-URI
 */
export async function processImage(
  event: H3Event,
  base64String: string,
  imageType = 'main',
  keyStem = 'products/product',
): Promise<string> {
  if (!base64String || !base64String.startsWith('data:image/')) {
    return base64String
  }

  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) return base64String

    const mime = matches[1]!
    const imageBuffer = Buffer.from(matches[2]!, 'base64')

    const env = event?.context?.cloudflare?.env as ImageEnv | undefined
    if (env && (env.IMAGES_BUCKET || env.KV)) {
      // Контент не перекодируем (optimizeImage на Workers — passthrough),
      // поэтому расширение соответствует фактическому формату upload-а.
      const saved = await putImage(env, imageBuffer, mime, keyStem)
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
      quality: calculateQuality(imageBuffer.length),
    })
    return `data:image/webp;base64,${optimizedBuffer.toString('base64')}`
  } catch (error) {
    console.error('❌ Ошибка сохранения картинки, используем оригинал:', error instanceof Error ? error.message : error)
    return base64String
  }
}

/**
 * Обрабатывает массив картинок галереи: data-URI сохраняются в хранилище,
 * готовые URL проходят насквозь. Пустые/бинарные элементы отбрасываются.
 */
export async function processGallery(
  event: H3Event,
  gallery: Array<string | null | undefined> | null | undefined,
): Promise<string[]> {
  if (!Array.isArray(gallery) || gallery.length === 0) return []

  const processed: string[] = []
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
