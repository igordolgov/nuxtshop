// server/lib/imageOptimizer.js

/**
 * Image optimization for Cloudflare Pages
 * 
 * Sharp не работает на Cloudflare Pages (нет Node.js runtime).
 * Используйте Cloudflare Image Resizing в production:
 * https://developers.cloudflare.com/images/transform-images/
 * 
 * Пример URL: /cdn-cgi/image/width=400,quality=80,format=webp/path/to/image.jpg
 */

// Поддерживаемые форматы (для валидации)
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif']

/**
 * Оптимизирует и сжимает изображение
 * На Cloudflare возвращает оригинал — используйте Image Resizing URL
 * 
 * @param {Buffer} imageBuffer - Буфер изображения
 * @param {Object} options - Настройки оптимизации
 * @returns {Promise<Buffer>} - Оптимизированный буфер
 */
export async function optimizeImage(imageBuffer, options = {}) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error('Некорректный буфер изображения')
  }

  console.log('🖼️ Возвращаю оригинал. Используйте Cloudflare Image Resizing для оптимизации.')
  return imageBuffer
}

/**
 * Определяет оптимальный формат для изображения
 * @param {string} mimeType - MIME тип
 * @returns {string} - Формат для конвертации
 */
export function getOptimalFormat(mimeType) {
  const formatMap = {
    'image/jpeg': 'webp',
    'image/jpg': 'webp',
    'image/png': 'webp',
    'image/webp': 'webp',
    'image/gif': 'webp',
    'image/avif': 'avif',
    'image/tiff': 'webp'
  }
  
  return formatMap[mimeType?.toLowerCase()] || 'webp'
}

/**
 * Вычисляет качество на основе размера исходного изображения
 * @param {number} originalSize - Размер в байтах
 * @param {Object} options - Опции
 * @returns {number} - Качество (1-100)
 */
export function calculateQuality(originalSize, options = {}) {
  const { 
    minQuality = 60, 
    maxQuality = 90,
    threshold1 = 500000,
    threshold2 = 2000000,
    threshold3 = 5000000
  } = options
  
  if (originalSize <= threshold1) return maxQuality
  if (originalSize <= threshold2) return 80
  if (originalSize <= threshold3) return 70
  return minQuality
}

/**
 * Проверяет, является ли буфер валидным изображением
 * @param {Buffer} buffer 
 * @returns {Promise<boolean>}
 */
export async function isValidImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false
  }

  // Проверка по magic bytes (signature)
  const signatures = [
    [0xFF, 0xD8, 0xFF],           // JPEG
    [0x89, 0x50, 0x4E, 0x47],     // PNG
    [0x47, 0x49, 0x46, 0x38],     // GIF
    [0x52, 0x49, 0x46, 0x46]      // WebP (RIFF)
  ]

  for (const sig of signatures) {
    if (buffer.length >= sig.length) {
      const matches = sig.every((byte, i) => buffer[i] === byte)
      if (matches) return true
    }
  }

  return false
}

/**
 * Получает метаданные изображения
 * @param {Buffer} buffer 
 * @returns {Promise<Object>}
 */
export async function getImageMetadata(buffer) {
  return {
    format: null,
    width: null,
    height: null,
    size: buffer.length,
    hasAlpha: null,
    orientation: null,
    density: null,
    note: 'Use Cloudflare Image Resizing for metadata extraction'
  }
}

/**
 * Создаёт превью изображения
 * На Cloudflare используйте URL: /cdn-cgi/image/width=200,height=200,fit=cover/path/to/image.jpg
 * 
 * @param {Buffer} imageBuffer 
 * @param {number} size - Размер превью
 * @returns {Promise<Buffer>}
 */
export async function createThumbnail(imageBuffer, size = 200) {
  return optimizeImage(imageBuffer, {
    maxWidth: size,
    maxHeight: size,
    quality: 75,
    format: 'webp'
  })
}

/**
 * Генерирует Cloudflare Image Resizing URL
 * @param {string} imagePath - Путь к изображению
 * @param {Object} options - Опции
 * @returns {string} - URL для оптимизированного изображения
 */
export function getCloudflareImageUrl(imagePath, options = {}) {
  const {
    width = 400,
    height,
    quality = 80,
    format = 'webp',
    fit = 'cover',
    dpr = 1
  } = options

  const params = []
  if (width) params.push(`width=${width}`)
  if (height) params.push(`height=${height}`)
  params.push(`quality=${quality}`)
  params.push(`format=${format}`)
  params.push(`fit=${fit}`)
  if (dpr > 1) params.push(`dpr=${dpr}`)

  return `/cdn-cgi/image/${params.join(',')}${imagePath}`
}