// app/composables/useFilters.js
import { ref, computed, watch } from 'vue'

const isDev = process.env.NODE_ENV === 'development'
const log = (...args) => isDev && console.log(...args)

export const useFilters = (products) => {
  //- ============================================
  //- Функция для получения начальной сортировки
  //- ============================================
  const getInitialSort = () => {
    if (process.client) {
      try {
        const savedSort = localStorage.getItem('productSort')
        if (savedSort) {
          const parsed = JSON.parse(savedSort)
          if (parsed?.field && parsed.order) {
            return parsed
          }
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }
    return { field: 'createdAt', order: 'desc' }
  }

  //- ============================================
  //- Состояние
  //- ============================================
  const searchQuery = ref('')
  const filters = ref({
    categories: [],
    onlyInStock: false,
    onlyFavorites: false,
    priceRange: { min: null, max: null }
  })
  const sort = ref(getInitialSort())

  //- ============================================
  //- Кэширование последнего результата
  //- ============================================
  let lastProductsRef = null
  let lastFiltersStr = ''
  let lastSortStr = ''
  let cachedResult = []

  //- ============================================
  //- Функция сортировки (выносим наружу для стабильности)
  //- ============================================
  const sortProducts = (productsToSort, sortConfig) => {
    if (!sortConfig?.field) {
      return [...productsToSort].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.id || 0)
        const dateB = new Date(b.createdAt || b.id || 0)
        return dateB - dateA
      })
    }

    const field = sortConfig.field
    const order = sortConfig.order

    return [...productsToSort].sort((a, b) => {
      let aVal = a[field]
      let bVal = b[field]

      // Для дат
      if (field === 'createdAt' || field === 'updatedAt') {
        const dateA = new Date(aVal || a.id || 0)
        const dateB = new Date(bVal || b.id || 0)
        return order === 'desc' ? dateB - dateA : dateA - dateB
      }
      
      // Для ID
      if (field === 'id') {
        const numA = parseInt(aVal) || 0
        const numB = parseInt(bVal) || 0
        return order === 'desc' ? numB - numA : numA - numB
      }

      // Для цены
      if (field === 'price') {
        return order === 'desc' ? bVal - aVal : aVal - bVal
      }

      // Для названия
      if (field === 'name') {
        const aStr = (aVal || '').toString().toLowerCase()
        const bStr = (bVal || '').toString().toLowerCase()
        return order === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr)
      }

      // Остальные поля
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()

      if (aVal < bVal) return order === 'asc' ? -1 : 1
      if (aVal > bVal) return order === 'asc' ? 1 : -1
      return 0
    })
  }

  //- ============================================
  //- Вычисляемые свойства для фильтрации
  //- ============================================
  const displayedProducts = computed(() => {
    const productsValue = products.value
    
    // Проверка на пустые данные
    if (!productsValue?.length) return []
    
    // Создаём ключ для кэша
    const filtersStr = JSON.stringify({
      search: searchQuery.value,
      categories: filters.value.categories,
      onlyInStock: filters.value.onlyInStock,
      onlyFavorites: filters.value.onlyFavorites,
      priceMin: filters.value.priceRange?.min,
      priceMax: filters.value.priceRange?.max
    })
    const sortStr = JSON.stringify(sort.value)
    
    // Проверяем кэш - если ничего не изменилось, возвращаем кэшированный результат
    if (
      lastProductsRef === productsValue &&
      lastFiltersStr === filtersStr &&
      lastSortStr === sortStr
    ) {
      return cachedResult
    }
    
    // Обновляем кэш
    lastProductsRef = productsValue
    lastFiltersStr = filtersStr
    lastSortStr = sortStr
    
    // Фильтрация
    let filtered = productsValue

    // Поиск
    const query = searchQuery.value?.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.categories?.some(cat => cat?.toLowerCase().includes(query))
      )
    }

    // Фильтрация по категориям
    const selectedCategories = filters.value.categories
    if (selectedCategories?.length > 0) {
      filtered = filtered.filter(product =>
        product.categories?.some(cat => selectedCategories.includes(cat))
      )
    }

    // Фильтр наличия
    if (filters.value.onlyInStock) {
      filtered = filtered.filter(product => product.inStock)
    }

    // Фильтр избранного
    if (filters.value.onlyFavorites) {
      filtered = filtered.filter(product => product.isFavorite)
    }

    // Фильтр по цене
    const priceMin = filters.value.priceRange?.min
    const priceMax = filters.value.priceRange?.max
    
    if (priceMin !== null && priceMin !== undefined) {
      filtered = filtered.filter(product => product.price >= priceMin)
    }
    if (priceMax !== null && priceMax !== undefined) {
      filtered = filtered.filter(product => product.price <= priceMax)
    }

    // Сортировка
    cachedResult = sortProducts(filtered, sort.value)
    
    return cachedResult
  })

  //- ============================================
  //- Диапазон цен
  //- ============================================
  const actualPriceRange = computed(() => {
    const productsValue = products.value
    if (!productsValue?.length) return { min: 0, max: 1000 }
    
    const prices = productsValue.map(p => p.price).filter(p => !isNaN(p))
    if (!prices.length) return { min: 0, max: 1000 }
    
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  })

  //- ============================================
  //- Методы управления состоянием
  //- ============================================
  const handleSearchUpdate = (value) => {
    searchQuery.value = value
  }

  const handleFiltersUpdate = (newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
  }

  const handleSortUpdate = (newSort) => {
    if (newSort?.field) {
      sort.value = { ...sort.value, ...newSort }
      
      // Сохраняем в localStorage
      if (process.client) {
        try {
          localStorage.setItem('productSort', JSON.stringify(sort.value))
        } catch (e) {
          // Игнорируем ошибки
        }
      }
    }
  }

  const resetFilters = () => {
    filters.value = {
      categories: [],
      onlyInStock: false,
      onlyFavorites: false,
      priceRange: { min: null, max: null }
    }
    searchQuery.value = ''
    // НЕ сбрасываем сортировку
  }

  const resetAll = () => {
    filters.value = {
      categories: [],
      onlyInStock: false,
      onlyFavorites: false,
      priceRange: { min: null, max: null }
    }
    searchQuery.value = ''
    sort.value = { field: 'createdAt', order: 'desc' }
    
    if (process.client) {
      localStorage.setItem('productSort', JSON.stringify(sort.value))
    }
  }

  return {
    // Состояние
    searchQuery: computed(() => searchQuery.value),
    filters: computed(() => filters.value),
    sort: computed(() => sort.value),
    
    // Вычисляемые свойства
    displayedProducts,
    actualPriceRange,
    
    // Методы
    handleSearchUpdate,
    handleFiltersUpdate,
    handleSortUpdate,
    resetFilters,
    resetAll
  }
}