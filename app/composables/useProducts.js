// composables/useProducts.js
// ============================================
// Composable: useProducts
// Назначение: Управление состоянием товаров
// Функции: загрузка, создание, обновление, удаление, поиск
// Зависимости: useFavorites
// ============================================

import { ref, computed } from 'vue'

// ============================================
// Глобальное состояние (синглтон)
// ============================================
let productsState = null
let isInitialized = false
let eventListenerAdded = false

export const useProducts = () => {
  if (productsState) {
    return productsState
  }

  // ============================================
  // Реактивное состояние (создаётся один раз)
  // ============================================
  const products = ref([])
  const loading = ref(false)
  const error = ref(null)

  const favorites = useFavorites()
  const favoritesUpdateTrigger = ref(0)

  // ============================================
  // Кэш для категорий
  // ============================================
  let cachedCategories = []
  let lastProductsForCategories = ''

  // ============================================
  // Функция для исправления URL изображений
  // ============================================
  const fixImageUrl = (url) => {
    if (!url || url === 'null' || url === 'undefined') {
      return '/images/placeholder.jpg'
    }
    if (url.startsWith('data:')) return url
    if (url.startsWith('photo-') || url.match(/^photo-[a-zA-Z0-9-]+/)) {
      return `https://images.unsplash.com/${url}`
    }
    if (url.includes('unsplash.com')) return url
    if (url.startsWith('images/') || url.startsWith('products/')) return `/${url}`
    if (url.includes('.') && !url.includes('/')) return `/images/${url}`
    if (url.startsWith('/')) return url
    if (url.startsWith('http')) return url
    return '/images/placeholder.jpg'
  }

  // ============================================
  // Функция для исправления URL в объекте товара
  // ============================================
  const fixProductImages = (product) => {
    if (!product) return product
    const fixed = { ...product }
    if (fixed.image) {
      fixed.image = fixImageUrl(fixed.image)
    }
    if (Array.isArray(fixed.gallery)) {
      fixed.gallery = fixed.gallery
        .map(img => fixImageUrl(img))
        .filter(img => img && img !== '/images/placeholder.jpg')
    }
    return fixed
  }

  // ============================================
  // Функция для показа уведомлений
  // ============================================
  const showNotification = (type, message) => {
    if (process.client) {
      try {
        const { $notify } = useNuxtApp()
        if ($notify) {
          if (type === 'success') $notify.success(message)
          else if (type === 'error') $notify.error(message)
          else $notify.info(message)
          return
        }
      } catch {
        // fallback если $notify недоступен
      }
    }
    console.log(`[${type.toUpperCase()}] ${message}`)
  }

  // ============================================
  // Функция для автоматического обновления inStock
  // ============================================
  const updateProductStockStatus = (product) => ({
    ...product,
    inStock: product.stockQuantity > 0
  })

  // ============================================
  // Функция для очистки данных перед сохранением
  // ============================================
  const cleanProductsForStorage = (productsList) => {
    if (!Array.isArray(productsList)) return []
    return productsList.map(product => {
      const cleaned = { ...product }
      if (cleaned.image?.startsWith('data:') && cleaned.image.length > 100000) {
        cleaned.image = '/images/placeholder.jpg'
      }
      if (Array.isArray(cleaned.gallery)) {
        cleaned.gallery = cleaned.gallery
          .map(img => (img?.startsWith('data:') && img.length > 100000)
            ? '/images/placeholder.jpg'
            : img
          )
          .filter(Boolean)
      }
      return cleaned
    })
  }

  // ============================================
  // Загрузка товаров с сервера
  // ============================================
  const loadProducts = async (force = false) => {
    if (products.value.length > 0 && !force) {
      return products.value
    }

    loading.value = true
    error.value = null

    try {
      const response = await $fetch('/api/products')

      products.value = response.map(product =>
        updateProductStockStatus(
          fixProductImages({
            ...product,
            isFavorite: favorites.isFavorite(product.id)
          })
        )
      )

      if (process.client) {
        const cleanedProducts = cleanProductsForStorage(products.value)
        localStorage.setItem('products', JSON.stringify(cleanedProducts))
      }

      return products.value

    } catch (err) {
      console.error('[useProducts] Ошибка загрузки товаров:', err)
      error.value = err.message
      showNotification('error', 'Ошибка загрузки товаров')

      if (process.client) {
        try {
          const cached = localStorage.getItem('products')
          if (cached) {
            const parsedProducts = JSON.parse(cached)
            products.value = parsedProducts.map(product =>
              updateProductStockStatus(
                fixProductImages({
                  ...product,
                  isFavorite: favorites.isFavorite(product.id)
                })
              )
            )
            showNotification('info', 'Используются кэшированные данные')
          }
        } catch (localStorageError) {
          console.warn('[useProducts] Ошибка загрузки из localStorage:', localStorageError.message)
        }
      }

      return []
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Переключение избранного
  // ============================================
  const toggleFavorite = async (productId) => {
    try {
      favorites.toggleFavorite(productId)
      const productIndex = products.value.findIndex(p => p.id === productId)
      if (productIndex !== -1) {
        products.value[productIndex].isFavorite = favorites.isFavorite(productId)
        if (process.client) {
          const cleanedProducts = cleanProductsForStorage(products.value)
          localStorage.setItem('products', JSON.stringify(cleanedProducts))
        }
      }
      return true
    } catch (err) {
      console.error('[useProducts] Ошибка переключения избранного:', err)
      showNotification('error', 'Ошибка при обновлении избранного')
      return false
    }
  }

  // ============================================
  // Обновление товара
  // ============================================
  const updateProduct = async (productId, updatedData) => {
    loading.value = true
    error.value = null

    try {
      const finalData = { ...updatedData, inStock: updatedData.stockQuantity > 0 }
      const response = await $fetch(`/api/products/${productId}`, {
        method: 'PUT',
        body: finalData
      })

      if (response.success) {
        const index = products.value.findIndex(p => p.id === productId)
        const wasFavorite = favorites.isFavorite(productId)

        if (index !== -1) {
          products.value[index] = updateProductStockStatus(
            fixProductImages({
              ...products.value[index],
              ...response.product,
              isFavorite: wasFavorite
            })
          )
        } else {
          const newProduct = updateProductStockStatus(
            fixProductImages({ ...response.product, isFavorite: wasFavorite })
          )
          products.value.push(newProduct)
        }

        if (process.client) {
          localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
        }

        showNotification('success', 'Товар успешно обновлен')
        return index !== -1 ? products.value[index] : products.value[products.value.length - 1]
      } else {
        throw new Error(response.message || 'Ошибка при обновлении товара')
      }

    } catch (err) {
      console.error('[useProducts] Ошибка обновления товара:', err)
      showNotification('error', `Ошибка обновления товара: ${err.message || 'Неизвестная ошибка'}`)

      const index = products.value.findIndex(p => p.id === productId)
      if (index !== -1) {
        products.value[index] = updateProductStockStatus(
          fixProductImages({
            ...products.value[index],
            ...updatedData,
            isFavorite: favorites.isFavorite(productId),
            updatedAt: new Date().toISOString()
          })
        )
        if (process.client) {
          localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
        }
        showNotification('info', 'Товар обновлен локально (ошибка сервера)')
        return products.value[index]
      }

      throw err
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Создание нового товара
  // ============================================
  const createProduct = async (productData) => {
    loading.value = true
    error.value = null

    const buildFallbackProduct = (data) => updateProductStockStatus(
      fixProductImages({
        id: Date.now().toString(),
        name: data.name,
        description: data.description || '',
        price: data.price,
        categories: data.categories,
        image: data.image || '',
        gallery: data.gallery || [],
        inStock: data.stockQuantity > 0,
        stockQuantity: data.stockQuantity || 0,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        slug: `${data.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      })
    )

    try {
      const finalData = { ...productData, inStock: productData.stockQuantity > 0 }
      const response = await $fetch('/api/products', { method: 'POST', body: finalData })

      let newProduct
      if (response.success && response.product) {
        newProduct = updateProductStockStatus(fixProductImages({ ...response.product, isFavorite: false }))
      } else if (response.id) {
        newProduct = updateProductStockStatus(fixProductImages({ ...response, isFavorite: false }))
      } else {
        newProduct = buildFallbackProduct(productData)
      }

      products.value = [newProduct, ...products.value]
      if (process.client) {
        localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
      }

      showNotification('success', 'Товар успешно создан')
      return newProduct

    } catch (err) {
      console.error('[useProducts] Ошибка создания товара:', err)
      showNotification('error', `Ошибка создания товара: ${err.message || 'Неизвестная ошибка'}`)

      const newProduct = buildFallbackProduct(productData)
      products.value = [newProduct, ...products.value]
      showNotification('info', 'Товар создан локально (ошибка сервера)')
      return newProduct

    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Удаление товара
  // ============================================
  const deleteProduct = async (productId) => {
    if (process.client) {
      const confirmed = window.confirm('Вы уверены, что хотите удалить этот товар?')
      if (!confirmed) return false
    }

    loading.value = true
    error.value = null

    const removeLocally = () => {
      const productIndex = products.value.findIndex(p => p.id === productId)
      if (productIndex !== -1) {
        const productName = products.value[productIndex].name
        products.value.splice(productIndex, 1)
        if (process.client) {
          localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
          if (favorites.isFavorite(productId)) {
            favorites.removeFromFavorites(productId)
          }
        }
        return productName
      }
      return null
    }

    try {
      const response = await $fetch(`/api/products/${productId}`, { method: 'DELETE' })

      if (response.success) {
        const name = removeLocally()
        if (name) {
          showNotification('success', `Товар "${name}" удален`)
          return true
        }
        return false
      } else {
        throw new Error(response.message || 'Ошибка при удалении товара')
      }

    } catch (err) {
      console.error('[useProducts] Ошибка удаления товара:', err)
      showNotification('error', `Ошибка удаления товара: ${err.message || 'Неизвестная ошибка'}`)

      const name = removeLocally()
      if (name) {
        showNotification('info', `Товар "${name}" удален локально (ошибка сервера)`)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Получение товара по slug
  // ============================================
  const getProductBySlug = async (slug) => {
    try {
      const localProduct = products.value.find(p => p.slug === slug || p.id === slug)
      if (localProduct) return localProduct

      if (!loading.value) {
        await loadProducts(true)
        const refreshedProduct = products.value.find(p => p.slug === slug || p.id === slug)
        if (refreshedProduct) return refreshedProduct
      }

      try {
        const response = await $fetch(`/api/product/${slug}`)
        if (response) {
          const productWithFavorite = updateProductStockStatus(
            fixProductImages({ ...response, isFavorite: favorites.isFavorite(response.id) })
          )
          products.value.push(productWithFavorite)
          return productWithFavorite
        }
      } catch (apiError) {
        console.warn('[useProducts] Ошибка API поиска товара:', apiError)
      }

      return null
    } catch (err) {
      console.error('[useProducts] Ошибка поиска товара по slug:', err)
      return null
    }
  }

  // ============================================
  // Получение товара по ID
  // ============================================
  const getProductById = (id) => products.value.find(product => product.id === id)

  // ============================================
  // Получение товаров по категории
  // ============================================
  const getProductsByCategory = (category) => {
    if (!category) return products.value
    return products.value.filter(p => p.categories?.includes(category))
  }

  // ============================================
  // Поиск товаров
  // ============================================
  const searchProducts = (query) => {
    if (!query) return products.value
    const searchTerm = query.toLowerCase()
    return products.value.filter(product =>
      product.name?.toLowerCase().includes(searchTerm) ||
      product.description?.toLowerCase().includes(searchTerm) ||
      product.categories?.some(cat => cat.toLowerCase().includes(searchTerm))
    )
  }

  // ============================================
  // Фильтрация товаров
  // ============================================
  const filterProducts = (filters) => {
    let filtered = products.value
    if (filters.category) {
      filtered = filtered.filter(p => p.categories?.includes(filters.category))
    }
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(p => p.price >= filters.minPrice)
    }
    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.price <= filters.maxPrice)
    }
    if (filters.inStock !== undefined) {
      filtered = filtered.filter(p => p.inStock === filters.inStock)
    }
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(searchTerm) ||
        p.description?.toLowerCase().includes(searchTerm)
      )
    }
    return filtered
  }

  // ============================================
  // Сортировка товаров
  // ============================================
  const sortProducts = (productsList, sortBy) => {
    if (!sortBy?.field) return productsList

    const { field, direction = 'asc' } = sortBy
    const mult = direction === 'desc' ? -1 : 1

    return [...productsList].sort((a, b) => {
      switch (field) {
        case 'name':
          return mult * a.name.localeCompare(b.name)
        case 'price':
          return mult * (a.price - b.price)
        case 'date':
          return mult * (new Date(a.createdAt) - new Date(b.createdAt))
        default:
          return 0
      }
    })
  }

  // ============================================
  // Обновление количества товара
  // ============================================
  const updateProductQuantity = (productId, newQuantity) => {
    const productIndex = products.value.findIndex(p => p.id === productId)
    if (productIndex !== -1) {
      products.value[productIndex].stockQuantity = newQuantity
      products.value[productIndex].inStock = newQuantity > 0
      if (process.client) {
        localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
      }
      return true
    }
    return false
  }

  // ============================================
  // Уменьшение количества товара
  // ============================================
  const decreaseProductQuantity = (productId, amount = 1) => {
    const productIndex = products.value.findIndex(p => p.id === productId)
    if (productIndex !== -1) {
      const newQuantity = Math.max(0, products.value[productIndex].stockQuantity - amount)
      products.value[productIndex].stockQuantity = newQuantity
      products.value[productIndex].inStock = newQuantity > 0
      if (process.client) {
        localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
      }
      return newQuantity
    }
    return -1
  }

  // ============================================
  // Инициализация (только один раз)
  // ============================================
  if (process.client && !isInitialized) {
    isInitialized = true

    if (!eventListenerAdded) {
      eventListenerAdded = true
      window.addEventListener('favorites-updated', () => {
        favoritesUpdateTrigger.value++
        if (products.value.length > 0) {
          products.value = products.value.map(product => ({
            ...product,
            isFavorite: favorites.isFavorite(product.id)
          }))
          try {
            localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
          } catch (e) {
            console.warn('[useProducts] Не удалось сохранить в localStorage:', e.message)
          }
        }
      })
    }

    loadProducts(true).catch(err => {
      console.warn('[useProducts] Загрузка не удалась:', err)
    })
  }

  // ============================================
  // Формируем возвращаемый объект
  // ============================================
  productsState = {
    products: computed(() => products.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    categories: computed(() => {
      const currentProducts = products.value
      const productsKey = currentProducts.map(p => p.id).join(',')
      if (productsKey === lastProductsForCategories) return cachedCategories
      lastProductsForCategories = productsKey
      const allCategories = currentProducts.flatMap(product => product.categories || [])
      cachedCategories = [...new Set(allCategories)].sort((a, b) => a.localeCompare(b))
      return cachedCategories
    }),

    favoriteProducts: computed(() => {
      // eslint-disable-next-line no-unused-expressions
      favoritesUpdateTrigger.value
      return products.value.filter(product => favorites.isFavorite(product.id))
    }),

    isFavorite: (productId) => favorites.isFavorite(productId),
    favoritesCount: computed(() => favorites.favoritesCount),

    loadProducts,
    updateProduct,
    createProduct,
    deleteProduct,
    getProductBySlug,
    getProductById,

    getProductsByCategory,
    searchProducts,
    filterProducts,
    sortProducts,
    toggleFavorite,
    updateProductQuantity,
    decreaseProductQuantity
  }

  return productsState
}