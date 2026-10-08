// app/composables/useFilters.js
import { ref, computed } from 'vue'

export const useFilters = (products) => {
  const getInitialSort = () => {
    if (import.meta.client) {
      try {
        const savedSort = localStorage.getItem('productSort')
        if (savedSort) {
          const parsed = JSON.parse(savedSort)
          if (parsed?.field && parsed.order) return parsed
        }
      } catch {
        // ignore
      }
    }
    return { field: 'createdAt', order: 'desc' }
  }

  const searchQuery = ref('')
  const filters = ref({
    categories: [],
    onlyInStock: false,
    onlyFavorites: false,
    priceRange: { min: null, max: null },
  })
  const sort = ref(getInitialSort())

  const sortProducts = (list, config) => {
    if (!config?.field) {
      return [...list].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.id || 0)
        const dateB = new Date(b.createdAt || b.id || 0)
        return dateB - dateA
      })
    }

    const { field, order } = config

    return [...list].sort((a, b) => {
      let aVal = a[field]
      let bVal = b[field]

      if (field === 'createdAt' || field === 'updatedAt') {
        const dateA = new Date(aVal || a.id || 0)
        const dateB = new Date(bVal || b.id || 0)
        return order === 'desc' ? dateB - dateA : dateA - dateB
      }

      if (field === 'id') {
        const numA = parseInt(aVal) || 0
        const numB = parseInt(bVal) || 0
        return order === 'desc' ? numB - numA : numA - numB
      }

      if (field === 'price') {
        return order === 'desc' ? bVal - aVal : aVal - bVal
      }

      if (field === 'name') {
        const aStr = (aVal || '').toString().toLowerCase()
        const bStr = (bVal || '').toString().toLowerCase()
        return order === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr)
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()

      if (aVal < bVal) return order === 'asc' ? -1 : 1
      if (aVal > bVal) return order === 'asc' ? 1 : -1
      return 0
    })
  }

  const displayedProducts = computed(() => {
    const productsValue = products.value
    if (!productsValue?.length) return []

    let filtered = productsValue

    const query = searchQuery.value?.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.categories?.some((cat) => cat?.toLowerCase().includes(query))
      )
    }

    const selectedCategories = filters.value.categories
    if (selectedCategories?.length > 0) {
      filtered = filtered.filter((p) =>
        p.categories?.some((cat) => selectedCategories.includes(cat))
      )
    }

    if (filters.value.onlyInStock) filtered = filtered.filter((p) => p.inStock)
    if (filters.value.onlyFavorites) filtered = filtered.filter((p) => p.isFavorite)

    const min = filters.value.priceRange?.min
    const max = filters.value.priceRange?.max
    if (min !== null && min !== undefined) filtered = filtered.filter((p) => p.price >= min)
    if (max !== null && max !== undefined) filtered = filtered.filter((p) => p.price <= max)

    return sortProducts(filtered, sort.value)
  })

  const actualPriceRange = computed(() => {
    const productsValue = products.value
    if (!productsValue?.length) return { min: 0, max: 1000 }
    const prices = productsValue.map((p) => p.price).filter((p) => !isNaN(p))
    if (!prices.length) return { min: 0, max: 1000 }
    return { min: Math.min(...prices), max: Math.max(...prices) }
  })

  const handleSearchUpdate = (value) => {
    searchQuery.value = value
  }

  const handleFiltersUpdate = (newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
  }

  const handleSortUpdate = (newSort) => {
    if (!newSort?.field) return
    sort.value = { ...sort.value, ...newSort }
    if (import.meta.client) {
      try {
        localStorage.setItem('productSort', JSON.stringify(sort.value))
      } catch {
        // ignore
      }
    }
  }

  const resetFilters = () => {
    filters.value = {
      categories: [],
      onlyInStock: false,
      onlyFavorites: false,
      priceRange: { min: null, max: null },
    }
    searchQuery.value = ''
  }

  const resetAll = () => {
    resetFilters()
    sort.value = { field: 'createdAt', order: 'desc' }
    if (import.meta.client) {
      localStorage.setItem('productSort', JSON.stringify(sort.value))
    }
  }

  return {
    searchQuery: computed(() => searchQuery.value),
    filters: computed(() => filters.value),
    sort: computed(() => sort.value),
    displayedProducts,
    actualPriceRange,
    handleSearchUpdate,
    handleFiltersUpdate,
    handleSortUpdate,
    resetFilters,
    resetAll,
  }
}