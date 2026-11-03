// server/lib/imageOptimizer.ts

/**
 * Image optimization for Cloudflare Workers
 *
 * Sharp не работает на Workers (нет полноценного Node.js runtime).
 * Реальное сжатие/ресайз делает Cloudflare Image Resizing в production:
 * https://developers.cloudflare.com/images/transform-images/
 *
 * Пример URL: /cdn-cgi/image/width=400,quality=80,format=webp/path/to/image.jpg
 */

/** Настройки оптимизации (зарезервированы под будущий бэкенд обработки) */
export interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: string;
}

/** Опции расчёта качества по размеру исходника */
export interface QualityOptions {
  minQuality?: number;
  maxQuality?: number;
  threshold1?: number;
  threshold2?: number;
  threshold3?: number;
}

/** Опции генерации /cdn-cgi/image/… URL */
export interface CloudflareImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  fit?: string;
  dpr?: number;
}

/** Метаданные изображения (на Workers заполняется только size) */
export interface ImageMetadata {
  format: string | null;
  width: number | null;
  height: number | null;
  size: number;
  hasAlpha: boolean | null;
  orientation: number | null;
  density: number | null;
  note: string;
}

/**
 * Оптимизирует и сжимает изображение.
 * На Workers контент не перекодируем — возвращаем оригинал как есть;
 * фактическая оптимизация выполняется Image Resizing на раздаче.
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  _options: OptimizeOptions = {},
): Promise<Buffer> {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error('Некорректный буфер изображения')
  }

  console.log('🖼️ Возвращаю оригинал. Используйте Cloudflare Image Resizing для оптимизации.')
  return imageBuffer
}

const FORMAT_MAP: Record<string, string> = {
  'image/jpeg': 'webp',
  'image/jpg': 'webp',
  'image/png': 'webp',
  'image/webp': 'webp',
  'image/gif': 'webp',
  'image/avif': 'avif',
  'image/tiff': 'webp',
}

/** Определяет оптимальный формат для изображения по MIME */
export function getOptimalFormat(mimeType?: string): string {
  return FORMAT_MAP[mimeType?.toLowerCase() ?? ''] || 'webp'
}

/**
 * Вычисляет качество на основе размера исходного изображения.
 * Чем крупнее исходник, тем агрессивнее сжатие (1-100).
 */
export function calculateQuality(originalSize: number, options: QualityOptions = {}): number {
  const {
    minQuality = 60,
    maxQuality = 90,
    threshold1 = 500000,
    threshold2 = 2000000,
    threshold3 = 5000000,
  } = options

  if (originalSize <= threshold1) return maxQuality
  if (originalSize <= threshold2) return 80
  if (originalSize <= threshold3) return 70
  return minQuality
}

/** Проверяет буфер по magic bytes: JPEG / PNG / GIF / WebP (RIFF) */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false
  }

  const signatures: number[][] = [
    [0xff, 0xd8, 0xff], // JPEG
    [0x89, 0x50, 0x4e, 0x47], // PNG
    [0x47, 0x49, 0x46, 0x38], // GIF
    [0x52, 0x49, 0x46, 0x46], // WebP (RIFF)
  ]

  for (const sig of signatures) {
    if (buffer.length >= sig.length) {
      const matches = sig.every((byte, i) => buffer[i] === byte)
      if (matches) return true
    }
  }

  return false
}

/** Метаданные изображения (на Workers — только size, остальное в Resizing) */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  return {
    format: null,
    width: null,
    height: null,
    size: buffer.length,
    hasAlpha: null,
    orientation: null,
    density: null,
    note: 'Use Cloudflare Image Resizing for metadata extraction',
  }
}

/** Создаёт превью изображения (на Workers — passthrough оригинала) */
export async function createThumbnail(imageBuffer: Buffer, size = 200): Promise<Buffer> {
  return optimizeImage(imageBuffer, {
    maxWidth: size,
    maxHeight: size,
    quality: 75,
    format: 'webp',
  })
}

/** Генерирует Cloudflare Image Resizing URL (/cdn-cgi/image/…) */
export function getCloudflareImageUrl(imagePath: string, options: CloudflareImageOptions = {}): string {
  const { width = 400, height, quality = 80, format = 'webp', fit = 'cover', dpr = 1 } = options

  const params: string[] = []
  if (width) params.push(`width=${width}`)
  if (height) params.push(`height=${height}`)
  params.push(`quality=${quality}`)
  params.push(`format=${format}`)
  params.push(`fit=${fit}`)
  if (dpr > 1) params.push(`dpr=${dpr}`)

  return `/cdn-cgi/image/${params.join(',')}${imagePath}`
}
