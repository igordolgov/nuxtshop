// server/routes/api/images/[...key].ts
/**
 * Выдача картинок из R2 (биндинг IMAGES_BUCKET) или Workers KV
 * (тот же namespace, что и каталог, префикс "img:" — см. imageStorage.js).
 *
 * Ключи вида products/product-<ts>-<rand>.<ext> уникальны для каждого
 * upload-а, поэтому контент неизменяем — кэш «год, immutable».
 * _headers на SSR-маршруты не действует (он только для статики из
 * assets), поэтому заголовки ставим здесь.
 */

interface R2ObjectLike {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
}

interface KVImageMetadata {
  contentType?: string;
}

interface KVImageStore {
  getWithMetadata(
    key: string,
    opts: { type: 'arrayBuffer' },
  ): Promise<{ value: ArrayBuffer | null; metadata: KVImageMetadata | null }>;
}

/** Префикс ключей картинок в KV — синхронизирован с IMAGE_KV_PREFIX. */
const KV_PREFIX = 'img:'

export default defineEventHandler(async (event) => {
  // Только чтение: GET отдают браузеры, HEAD — CDN/проверки доступности.
  // (Файл без суффикса .get — иначе nitro не матчит HEAD и отвечает 404.)
  const method = event.method
  if (method !== 'GET' && method !== 'HEAD') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const key = event.context.params?.key
  if (!key || key.includes('..') || key.startsWith('/')) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  }

  const env = event.context.cloudflare?.env as
    | { IMAGES_BUCKET?: R2BucketLike; KV?: KVImageStore }
    | undefined

  // 1) R2 — если биндинг когда-нибудь объявят в wrangler.jsonc.
  if (env?.IMAGES_BUCKET) {
    try {
      const object = await env.IMAGES_BUCKET.get(key)
      if (object) {
        setHeader(event, 'Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream')
        setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
        return object.body
      }
    } catch {
      // R2 недоступен/ошибка — пробуем KV, там могут лежать старые картинки.
    }
  }

  // 2) KV — основной режим (работает без включения R2).
  if (env?.KV) {
    const { value, metadata } = await env.KV.getWithMetadata(KV_PREFIX + key, { type: 'arrayBuffer' })
    if (value) {
      setHeader(event, 'Content-Type', metadata?.contentType ?? 'application/octet-stream')
      setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
      return Buffer.from(value)
    }
  }

  throw createError({ statusCode: 404, statusMessage: 'Image not found' })
})
