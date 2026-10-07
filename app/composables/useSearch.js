// useSearch.js - расширенный composable для умного поиска с подсветкой
import { ref, computed, watch, nextTick } from 'vue'
import { useDebounceFn } from '@vueuse/core'

/**
 * Composable для умного поиска с подсветкой и подсказками
 * @param {Array} items - массив элементов для поиска
 * @param {Array} searchFields - поля для поиска
 * @param {Object} options - дополнительные опции
 */
export function useSmartSearch(items, searchFields = ['name', 'description'], options = {}) {
  const {
    debounceMs = 300,
    maxSuggestions = 5,
    minQueryLength = 2,
    highlightClass = 'search-highlight',
    enableFuzzySearch = true
  } = options

  // Реактивные состояния
  const searchQuery = ref('')
  const isSearching = ref(false)
  const showSuggestions = ref(false)
  const activeSuggestionIndex = ref(-1)
  const searchResults = ref([])
  const suggestionItems = ref([])
  const isSelectingSuggestion = ref(false)

  // Debounced поиск
  const performSearch = useDebounceFn(async (query) => {
    if (!query || query.length < minQueryLength) {
      searchResults.value = []
      suggestionItems.value = []
      isSearching.value = false
      return
    }

    isSearching.value = true

    try {
      // Поиск по локальным данным
      const results = await searchInItems(query)
      searchResults.value = results
      suggestionItems.value = results.slice(0, maxSuggestions)
    } catch (error) {
      console.error('Search error:', error)
      searchResults.value = []
      suggestionItems.value = []
    } finally {
      isSearching.value = false
    }
  }, debounceMs)

  // Поиск по элементам
  const searchInItems = async (query) => {
    const normalizedQuery = query.toLowerCase().trim()
    
    return items.value.filter(item => {
      return searchFields.some(field => {
        const fieldValue = getNestedValue(item, field)?.toString().toLowerCase()
        if (!fieldValue) return false

        if (enableFuzzySearch) {
          return fuzzyMatch(fieldValue, normalizedQuery)
        }
        return fieldValue.includes(normalizedQuery)
      })
    }).map(item => ({
      ...item,
      highlights: generateHighlights(item, normalizedQuery)
    }))
  }

  // Нечеткий поиск
  const fuzzyMatch = (text, query) => {
    let queryIndex = 0
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        queryIndex++
      }
    }
    return queryIndex === query.length
  }

  // Генерация подсветки для всех полей
  const generateHighlights = (item, query) => {
    const highlights = {}
    
    searchFields.forEach(field => {
      const fieldValue = getNestedValue(item, field)
      if (fieldValue) {
        highlights[field] = highlightText(fieldValue.toString(), query)
      }
    })
    
    return highlights
  }

  // Функция подсветки текста
  const highlightText = (text, query) => {
    if (!query) return text
    
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
    return text.replace(regex, `<span class="${highlightClass}">$1</span>`)
  }

  // Экранирование спецсимволов для regex
  const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Получение вложенных значений объекта
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  // Обработчики клавиатуры для навигации по подсказкам
  const handleKeydown = (event) => {
    if (!showSuggestions.value) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        activeSuggestionIndex.value = Math.min(
          activeSuggestionIndex.value + 1,
          suggestionItems.value.length - 1
        )
        break
        
      case 'ArrowUp':
        event.preventDefault()
        activeSuggestionIndex.value = Math.max(activeSuggestionIndex.value - 1, -1)
        break
        
      case 'Enter':
        event.preventDefault()
        if (activeSuggestionIndex.value >= 0) {
          selectSuggestion(suggestionItems.value[activeSuggestionIndex.value])
        } else {
          // Если нет активной подсказки, выполняем поиск
          performSearch(searchQuery.value)
        }
        break
        
      case 'Escape':
        hideSuggestions()
        break
    }
  }

  // Выбор подсказки
  const selectSuggestion = (suggestion) => {
    isSelectingSuggestion.value = true
    searchQuery.value = suggestion.name || suggestion.title
    hideSuggestions()
    
    // Сбрасываем флаг после завершения выбора
    nextTick(() => {
      isSelectingSuggestion.value = false
    })
  }

  // Показ подсказок
  const showSuggestionsPanel = () => {
    showSuggestions.value = true
  }

  // Скрытие подсказок
  const hideSuggestions = () => {
    showSuggestions.value = false
    activeSuggestionIndex.value = -1
  }

  // Сброс поиска
  const resetSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
    suggestionItems.value = []
    hideSuggestions()
  }

  // Показать все результаты
  const showAllResults = () => {
    hideSuggestions()
    // Здесь можно добавить логику для показа всех результатов
    console.log('Показать все результаты для:', searchQuery.value)
  }

  // Watchers
  watch(searchQuery, (newQuery) => {
    if (isSelectingSuggestion.value) {
      return // Не выполняем поиск при выборе подсказки
    }
    
    if (newQuery && newQuery.length >= minQueryLength) {
      performSearch(newQuery)
      showSuggestionsPanel()
    } else {
      searchResults.value = []
      suggestionItems.value = []
      hideSuggestions()
    }
  })

  watch(suggestionItems, (newSuggestions) => {
    if (newSuggestions.length > 0) {
      showSuggestions.value = true
    }
  })

  // Computed свойства
  const hasResults = computed(() => searchResults.value.length > 0)
  const hasSuggestions = computed(() => suggestionItems.value.length > 0)
  const totalResults = computed(() => searchResults.value.length)

  // Публичный API
  return {
    // Data
    searchQuery,
    isSearching,
    showSuggestions,
    activeSuggestionIndex,
    searchResults,
    suggestionItems,
    
    // Computed
    hasResults,
    hasSuggestions,
    totalResults,
    
    // Methods
    handleKeydown,
    selectSuggestion,
    showSuggestionsPanel,
    hideSuggestions,
    resetSearch,
    showAllResults,
    highlightText
  }
}

/**
 * Composable для поиска с API бэкенда
 */
export function useApiSearch(apiEndpoint, searchFields = ['name'], options = {}) {
  const {
    debounceMs = 300,
    minQueryLength = 2
    // highlightClass убран — не используется
  } = options

  const searchQuery = ref('')
  const isSearching = ref(false)
  const apiResults = ref([])
  const searchError = ref(null)
  const showSuggestions = ref(false)
  const isSelectingSuggestion = ref(false)

  // ИСПРАВЛЕНО: useDebounceFn возвращает функцию, а не объект с execute
  const performApiSearch = useDebounceFn(async (query) => {
    if (!query || query.length < minQueryLength) {
      apiResults.value = []
      return
    }

    isSearching.value = true
    searchError.value = null

    try {
      const response = await $fetch(apiEndpoint, {
        method: 'POST',
        body: {
          query,
          fields: searchFields,
          limit: options.limit || 10
        }
      })
      
      apiResults.value = response.data.map(item => ({
        ...item,
        highlights: generateApiHighlights(item, query, searchFields)
      }))
      showSuggestions.value = true
    } catch (error) {
      console.error('API search error:', error)
      searchError.value = error.message
      apiResults.value = []
    } finally {
      isSearching.value = false
    }
  }, debounceMs)

  const generateApiHighlights = (item, query, fields) => {
    const highlights = {}
    const normalizedQuery = query.toLowerCase()
    
    fields.forEach(field => {
      const fieldValue = getNestedValue(item, field)
      if (fieldValue) {
        highlights[field] = highlightText(fieldValue.toString(), normalizedQuery)
      }
    })
    
    return highlights
  }

  const selectSuggestion = (suggestion) => {
    isSelectingSuggestion.value = true
    searchQuery.value = suggestion.name || suggestion.title
    hideSuggestions()
    
    nextTick(() => {
      isSelectingSuggestion.value = false
    })
  }

  const hideSuggestions = () => {
    showSuggestions.value = false
  }

  watch(searchQuery, (newQuery) => {
    if (isSelectingSuggestion.value) {
      return
    }
    
    if (newQuery) {
      performApiSearch(newQuery)
    } else {
      apiResults.value = []
    }
  })

  return {
    searchQuery,
    isSearching,
    apiResults,
    searchError,
    showSuggestions,
    performApiSearch,
    selectSuggestion,
    hideSuggestions
  }
}

/**
 * Хук для использования поиска в компонентах
 */
export function useSearch() {
  const route = useRoute()
  const router = useRouter()
  
  // Интеграция с router для поисковых параметров
  // ИСПРАВЛЕНО: убран неиспользуемый параметр searchResults
  const syncWithRoute = (searchQuery) => {
    // Обновляем URL при поиске
    watch(searchQuery, (newQuery) => {
      const query = { ...route.query }
      
      if (newQuery) {
        query.search = newQuery
      } else {
        delete query.search
      }
      
      router.replace({ query })
    })

    // Восстанавливаем поиск из URL при загрузке
    onMounted(() => {
      if (route.query.search) {
        searchQuery.value = route.query.search
      }
    })
  }

  return {
    syncWithRoute
  }
}

// Вспомогательная функция для подсветки текста
function highlightText(text, query) {
  if (!query) return text
  
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return text.replace(regex, `<span class="search-highlight">$1</span>`)
}

// Вспомогательная функция для экранирования regex
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Вспомогательная функция для получения вложенных значений
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}