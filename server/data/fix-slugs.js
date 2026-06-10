// server/data/fix-slugs.js
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Полная таблица транслитерации (ГОСТ 7.79-2000)
const TRANSLIT_MAP = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya'
}

function transliterate(text) {
  if (!text) return ''
  
  let result = text.toLowerCase()
  
  // Особые случаи (двойные буквы)
  result = result.replace(/щ/g, 'sch')
  result = result.replace(/ш/g, 'sh')
  result = result.replace(/ч/g, 'ch')
  result = result.replace(/ц/g, 'ts')
  result = result.replace(/ю/g, 'yu')
  result = result.replace(/я', 'ya')
  result = result.replace(/ё/g, 'yo')
  result = result.replace(/ж/g, 'zh')
  
  // Остальные буквы
  for (const [rus, eng] of Object.entries(TRANSLIT_MAP)) {
    if (!['щ', 'ш', 'ч', 'ц', 'ю', 'я', 'ё', 'ж'].includes(rus)) {
      result = result.replace(new RegExp(rus, 'g'), eng)
    }
  }
  
  return result
}

function slugify(str) {
  if (!str || typeof str !== 'string') return `product-${Date.now()}`
  
  let slug = transliterate(str.trim())
  
  // Удаляем всё кроме букв, цифр, пробелов и дефисов
  slug = slug
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') // Удаляем дефисы в начале и конце
  
  if (!slug) {
    slug = `product-${Date.now()}`
  }
  
  return slug
}

function generateUniqueSlug(baseSlug, existingProducts, currentId) {
  // Собираем все существующие slug
  const existingSlugs = new Set(
    existingProducts
      .filter(p => p.id !== currentId)
      .map(p => p.slug)
  )
  
  // Если базовый slug свободен
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug
  }
  
  // Ищем свободный с суффиксом
  let counter = 1
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++
  }
  
  return `${baseSlug}-${counter}`
}

async function fixSlugs() {
  try {
    const filePath = join(__dirname, 'products.json')
    
    // Проверяем существование файла
    if (!existsSync(filePath)) {
      console.error('❌ Файл products.json не найден')
      process.exit(1)
    }
    
    const data = readFileSync(filePath, 'utf-8')
    
    if (!data.trim()) {
      console.error('❌ Файл products.json пуст')
      process.exit(1)
    }
    
    let products
    try {
      products = JSON.parse(data)
    } catch {
      console.error('❌ Ошибка парсинга JSON')
      process.exit(1)
    }
    
    if (!Array.isArray(products)) {
      console.error('❌ products.json должен содержать массив')
      process.exit(1)
    }
    
    console.log(`📦 Найдено товаров: ${products.length}`)
    
    let updatedCount = 0
    let skippedCount = 0
    
    // Сначала генерируем все новые slug
    const newSlugs = new Map()
    products.forEach(product => {
      if (!product.slug || !/^[a-z0-9-]+$/.test(product.slug)) {
        const baseSlug = slugify(product.name)
        newSlugs.set(product.id, baseSlug)
      }
    })
    
    // Обновляем товары с уникальными slug
    const updatedProducts = products.map(product => {
      // Проверяем корректность текущего slug
      if (product.slug && /^[a-z0-9-]+$/.test(product.slug)) {
        skippedCount++
        return product
      }
      
      const baseSlug = newSlugs.get(product.id) || slugify(product.name)
      const newSlug = generateUniqueSlug(baseSlug, products, product.id)
      
      console.log(`  ${product.name}`)
      console.log(`    "${product.slug || '(пусто)'}" → "${newSlug}"`)
      
      updatedCount++
      
      return {
        ...product,
        slug: newSlug,
        updatedAt: new Date().toISOString()
      }
    })
    
    // Сохраняем
    writeFileSync(filePath, JSON.stringify(updatedProducts, null, 2), 'utf-8')
    
    console.log('')
    console.log('═════════════════════════════')
    console.log(`✅ Обновлено: ${updatedCount}`)
    console.log(`⏭️  Пропущено: ${skippedCount}`)
    console.log(`📁 Файл: ${filePath}`)
    console.log('═════════════════════════════')
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message)
    process.exit(1)
  }
}

// Запуск
fixSlugs()