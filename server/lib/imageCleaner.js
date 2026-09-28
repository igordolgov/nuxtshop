// server/lib/imageCleaner.js
import fs from 'fs/promises'
import path from 'path'
import { readProducts } from './productHelpers.js'

// Защищённые файлы, которые нельзя удалять
const PROTECTED_FILES = [
  'placeholder.webp',
  'no-image.webp',
  'default.webp'
]

// Возраст файла в днях, после которого можно удалять (защита от удаления новых загружаемых)
const MIN_FILE_AGE_DAYS = 1

/**
 * Проверяет возраст файла
 */
async function getFileAge(filePath) {
  try {
    const stats = await fs.stat(filePath)
    const now = Date.now()
    const fileTime = stats.mtimeMs
    return (now - fileTime) / (1000 * 60 * 60 * 24) // в днях
  } catch {
    return 0
  }
}

/**
 * Очищает неиспользуемые изображения продуктов
 * @param {Object} options - Опции очистки
 * @param {boolean} options.dryRun - Только показать что будет удалено
 * @param {number} options.minAgeDays - Минимальный возраст файла для удаления
 * @returns {Promise<{deleted: string[], kept: string[], errors: string[]}>}
 */
export async function cleanupUnusedProductImages(options = {}) {
  const { dryRun = false, minAgeDays = MIN_FILE_AGE_DAYS } = options
  
  const result = {
    deleted: [],
    kept: [],
    errors: [],
    totalSize: 0
  }
  
  try {
    const imagesDir = path.resolve(process.cwd(), 'public', 'images', 'products')
    
    // Проверяем существование директории
    try {
      await fs.access(imagesDir)
    } catch {
      console.log('📁 Директория изображений не существует')
      return result
    }
    
    // Читаем продукты
    const products = await readProducts()
    
    // Собираем все используемые изображения
    const usedImages = new Set()
    
    products.forEach(product => {
      if (product.image?.startsWith('/images/products/')) {
        usedImages.add(path.basename(product.image))
      }
      
      if (Array.isArray(product.gallery)) {
        product.gallery.forEach(image => {
          if (image?.startsWith('/images/products/')) {
            usedImages.add(path.basename(image))
          }
        })
      }
    })
    
    console.log(`📷 Найдено используемых изображений: ${usedImages.size}`)
    
    // Получаем все файлы в директории
    const files = await fs.readdir(imagesDir)
    console.log(`📁 Всего файлов в директории: ${files.length}`)
    
    // Проверяем каждый файл
    for (const file of files) {
      const filePath = path.join(imagesDir, file)
      
      try {
        // Пропускаем защищённые файлы
        if (PROTECTED_FILES.includes(file.toLowerCase())) {
          result.kept.push(file)
          continue
        }
        
        // Пропускаем используемые файлы
        if (usedImages.has(file)) {
          result.kept.push(file)
          continue
        }
        
        // Проверяем возраст файла
        const fileAge = await getFileAge(filePath)
        if (fileAge < minAgeDays) {
          result.kept.push(`${file} (слишком новый: ${fileAge.toFixed(1)} дн.)`)
          continue
        }
        
        // Получаем размер файла
        const stats = await fs.stat(filePath)
        
        if (dryRun) {
          console.log(`🔍 [DRY RUN] Будет удалён: ${file} (${(stats.size / 1024).toFixed(1)} KB)`)
          result.deleted.push(file)
          result.totalSize += stats.size
        } else {
          await fs.unlink(filePath)
          console.log(`🗑️ Удалён: ${file} (${(stats.size / 1024).toFixed(1)} KB)`)
          result.deleted.push(file)
          result.totalSize += stats.size
        }
        
      } catch (error) {
        result.errors.push(`${file}: ${error.message}`)
        console.error(`❌ Ошибка с файлом ${file}:`, error.message)
      }
    }
    
    console.log('')
    console.log('═══════════════════════════════════')
    console.log(`✅ Очистка завершена (${dryRun ? 'DRY RUN' : 'РЕАЛЬНО'})`)
    console.log(`🗑️ Удалено: ${result.deleted.length}`)
    console.log(`📁 Оставлено: ${result.kept.length}`)
    console.log(`💾 Освобождено: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`)
    if (result.errors.length > 0) {
      console.log(`⚠️ Ошибок: ${result.errors.length}`)
    }
    console.log('═══════════════════════════════════')
    
    return result
    
  } catch (error) {
    console.error('❌ Ошибка очистки изображений:', error)
    result.errors.push(error.message)
    return result
  }
}

/**
 * Удаляет конкретное изображение файла
 */
export async function deleteImageFile(imagePath) {
  if (!imagePath?.startsWith('/images/products/')) {
    return false
  }
  
  try {
    const filePath = path.resolve(process.cwd(), 'public', imagePath.substring(1))
    await fs.unlink(filePath)
    console.log(`🗑️ Удалён файл: ${imagePath}`)
    return true
  } catch (error) {
    console.error(`❌ Ошибка удаления ${imagePath}:`, error.message)
    return false
  }
}