// server/lib/productHelpers.js
/**
 * Хранилище товаров в памяти воркера.
 *
 * ВАЖНО: на Cloudflare Workers нет файловой системы. Данные живут
 * в модульной переменной. Это позволяет приложению работать, но:
 *  - Изменения теряются при перезапуске изолята Cloudflare (обычно минуты-часы).
 *  - При нескольких изолятах данные расходятся.
 * Для постоянного хранения — мигрировать на Cloudflare D1 / KV.
 */

import productsSeed from '../data/products.json'

// In-memory store. Инициализируется из инлайн-JSON при сборке.
let productsState = Array.isArray(productsSeed) ? [...productsSeed] : []

// Полная таблица транслитерации
const TRANSLIT_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd',
  е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

/**
 * Инвалидирует кэш. В in-memory версии — no-op (кэш и есть состояние).
 */
export function invalidateProductsCache() {
  // no-op
}

/**
 * Читает продукты. Возвращает in-memory массив.
 * @returns {Promise<Array>}
 */
export async function readProducts() {
  return productsState
}

/**
 * Записывает продукты в in-memory store.
 * @param {Array} products
 * @returns {Promise<boolean>}
 */
export async function writeProducts(products) {
  if (!Array.isArray(products)) {
    throw new Error('Products must be an array')
  }
  productsState = products
  return true
}

/**
 * Транслитерация кириллицы в латиницу
 */
function transliterate(text) {
  if (!text || typeof text !== 'string') return ''

  let result = text.toLowerCase()

  result = result.replace(/щ/g, 'sch')
  result = result.replace(/ш/g, 'sh')
  result = result.replace(/ч/g, 'ch')
  result = result.replace(/ц/g, 'ts')
  result = result.replace(/ю/g, 'yu')
  result = result.replace(/я/g, 'ya')
  result = result.replace(/ё/g, 'yo')
  result = result.replace(/ж/g, 'zh')

  for (const [rus, eng] of Object.entries(TRANSLIT_MAP)) {
    if (!['щ', 'ш', 'ч', 'ц', 'ю', 'я', 'ё', 'ж'].includes(rus)) {
      result = result.replace(new RegExp(rus, 'g'), eng)
    }
  }

  return result
}

/**
 * Создаёт slug из строки
 */
export function slugify(str) {
  if (!str || typeof str !== 'string') return `product-${Date.now()}`

  let slug = transliterate(str.trim())

  slug = slug
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || `product-${Date.now()}`
}

/**
 * Генерирует уникальный slug
 */
export function generateUniqueSlug(baseSlug, existingProducts, excludeId = null) {
  const existingSlugs = new Set(
    existingProducts
      .filter((p) => p.id !== excludeId && p.id !== String(excludeId))
      .map((p) => p.slug)
  )

  if (!existingSlugs.has(baseSlug)) return baseSlug

  let counter = 1
  while (existingSlugs.has(`${baseSlug}-${counter}`)) counter++

  return `${baseSlug}-${counter}`
}

/**
 * Находит товар по slug или ID
 */
export async function getProductBySlug(slugOrId) {
  const products = await readProducts()
  return products.find((p) => p.slug === slugOrId || String(p.id) === slugOrId) || null
}

/**
 * Находит товар по ID
 */
export async function getProductById(id) {
  const products = await readProducts()
  return products.find((p) => String(p.id) === String(id)) || null
}

/**
 * Возвращает все продукты
 */
export async function getAllProducts() {
  return readProducts()
}

/**
 * Находит похожие товары по категориям
 */
export async function getSimilarProducts(currentProduct, limit = 4) {
  if (!currentProduct?.categories?.length) return []

  const products = await readProducts()
  const currentId = String(currentProduct.id)

  return products
    .filter(
      (p) =>
        String(p.id) !== currentId &&
        p.categories?.some((cat) => currentProduct.categories.includes(cat))
    )
    .slice(0, limit)
}

/**
 * Валидирует структуру продукта
 */
export function validateProduct(product) {
  const errors = []

  if (!product.name?.trim()) errors.push('Название обязательно')
  if (!product.price || isNaN(parseFloat(product.price))) errors.push('Цена обязательна')
  if (product.price < 0) errors.push('Цена не может быть отрицательной')

  return { valid: errors.length === 0, errors }
}

/**
 * Создаёт новый продукт с дефолтными значениями
 */
export function createProductObject(data) {
  const now = new Date().toISOString()
  const stockQuantity = parseInt(data.stockQuantity) || 0

  return {
    id: data.id || String(Date.now()),
    slug: data.slug || slugify(data.name),
    name: data.name?.trim() || '',
    description: data.description || '',
    price: parseFloat(data.price) || 0,
    image: data.image || '/images/products/placeholder.webp',
    gallery: Array.isArray(data.gallery) ? data.gallery : [],
    categories: Array.isArray(data.categories) ? data.categories : ['Другое'],
    inStock: stockQuantity > 0,
    stockQuantity,
    characteristics: data.characteristics || {},
    createdAt: now,
    updatedAt: now,
  }
}

export default {
  readProducts,
  writeProducts,
  invalidateProductsCache,
  slugify,
  generateUniqueSlug,
  getProductBySlug,
  getProductById,
  getAllProducts,
  getSimilarProducts,
  validateProduct,
  createProductObject,
}