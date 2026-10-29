// server/routes/api/images/[...key].get.ts
/**
 * Выдача картинок из R2 (биндинг IMAGES_BUCKET).
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

export default defineEventHandler(async (event) => {
  // Только чтение: GET отдают браузеры, HEAD — CDN/проверки доступности.
  // (Файл без суффикса .get — иначе nitro не матчит HEAD и отвечает 404.)
  const method = event.method
  if (method !== 'GET' && method !== 'HEAD') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const key = event.context.params?.key
  const r2 = (event.context.cloudflare?.env as { IMAGES_BUCKET?: R2BucketLike } | undefined)
    ?.IMAGES_BUCKET

  if (!r2 || !key) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  }

  const object = await r2.get(key)
  if (!object) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  }

  setHeader(event, 'Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return object.body
})
