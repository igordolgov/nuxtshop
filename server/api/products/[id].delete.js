// server/api/products/[id].delete.js
import { readProducts, writeProducts } from '../../lib/productHelpers.js'

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id
  
  // Проверяем что ID передан
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID товара не указан'
    })
  }
  
  try {
    console.log(`🗑️ Попытка удаления товара с ID: ${id}`)
    
    const products = await readProducts()
    const productIndex = products.findIndex(p => p.id === id || p.id === Number(id))
    
    if (productIndex === -1) {
      console.error(`❌ Товар с ID ${id} не найден`)
      throw createError({
        statusCode: 404,
        statusMessage: 'Товар не найден'
      })
    }
    
    const productToDelete = products[productIndex]
    console.log(`🗑️ Удаление товара: ${productToDelete.name} (ID: ${productToDelete.id})`)
    
    products.splice(productIndex, 1)
    await writeProducts(products)
    
    console.log(`✅ Товар успешно удален: ${productToDelete.name}`)
    
    return { 
      success: true, 
      message: 'Товар успешно удален',
      deletedProduct: productToDelete
    }
    
  } catch (error) {
    // Если ошибка уже обработана (createError), пробрасываем дальше
    if (error.statusCode) throw error
    
    console.error('❌ Ошибка при удалении товара:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Внутренняя ошибка сервера'
    })
  }
})