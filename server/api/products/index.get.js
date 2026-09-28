// server/api/products/index.get.js
import { readProducts } from '../../lib/productHelpers.js'

export default defineEventHandler(async (event) => {
  console.log('📥 GET /api/products вызван')
  
  try {
    const products = await readProducts()
    
    // Получаем параметры запроса для фильтрации
    const query = getQuery(event)
    
    let filteredProducts = products
    
    // Фильтр по категории
    if (query.category) {
      filteredProducts = filteredProducts.filter(p => 
        p.categories && p.categories.includes(query.category)
      )
      console.log(`📂 Фильтр по категории: ${query.category}, найдено: ${filteredProducts.length}`)
    }
    
    // Фильтр по наличию
    if (query.inStock === 'true') {
      filteredProducts = filteredProducts.filter(p => p.inStock)
      console.log(`📦 Фильтр по наличию, найдено: ${filteredProducts.length}`)
    }
    
    // Фильтр по цене
    if (query.minPrice) {
      filteredProducts = filteredProducts.filter(p => p.price >= parseFloat(query.minPrice))
    }
    if (query.maxPrice) {
      filteredProducts = filteredProducts.filter(p => p.price <= parseFloat(query.maxPrice))
    }
    
    // Поиск по названию
    if (query.search) {
      const searchLower = query.search.toLowerCase()
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 Поиск: "${query.search}", найдено: ${filteredProducts.length}`)
    }
    
    // Сортировка
    if (query.sort) {
      switch (query.sort) {
        case 'price-asc':
          filteredProducts.sort((a, b) => a.price - b.price)
          break
        case 'price-desc':
          filteredProducts.sort((a, b) => b.price - a.price)
          break
        case 'name':
          filteredProducts.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
          break
        case 'newest':
          filteredProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          break
      }
    }
    
    // Пагинация
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 0 // 0 = все товары
    
    if (limit > 0) {
      const start = (page - 1) * limit
      const paginatedProducts = filteredProducts.slice(start, start + limit)
      
      return {
        products: paginatedProducts,
        pagination: {
          total: filteredProducts.length,
          page: page,
          limit: limit,
          totalPages: Math.ceil(filteredProducts.length / limit)
        }
      }
    }
    
    console.log(`✅ Возвращено товаров: ${filteredProducts.length}`)
    return filteredProducts
    
  } catch (error) {
    console.error('❌ Ошибка при получении товаров:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Не удалось загрузить товары'
    })
  }
})