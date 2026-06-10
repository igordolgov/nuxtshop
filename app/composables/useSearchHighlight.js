// composables/useSearchHighlight.js
export const useSearchHighlight = () => {
  // Функция для экранирования HTML
  const escapeHtml = (text) => {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // Функция для безопасного создания HTML с подсветкой
  const highlightText = (text, query, highlightClass = 'search-highlight') => {
    // Если запрос короче 2 символов, возвращаем просто текст без подсветки
    if (!query || query.length < 2 || !text || typeof text !== 'string') {
      return escapeHtml(text)
    }

    const normalizedQuery = query.trim().toLowerCase()
    const textStr = String(text)
    
    if (!normalizedQuery || normalizedQuery.length < 2) {
      return escapeHtml(textStr)
    }

    try {
      // Экранируем весь текст сначала
      const escapedText = escapeHtml(textStr)
      const lowerText = textStr.toLowerCase()
      const queryLower = normalizedQuery.toLowerCase()
      
      // Находим все позиции вхождения запроса в оригинальном тексте (без экранирования)
      const positions = []
      let startIndex = 0
      
      while (startIndex < lowerText.length) {
        const index = lowerText.indexOf(queryLower, startIndex)
        if (index === -1) break
        
        positions.push({
          start: index,
          end: index + queryLower.length
        })
        
        startIndex = index + 1 // Ищем следующее вхождение
      }

      // Если нет вхождений, возвращаем просто экранированный текст
      if (positions.length === 0) {
        return escapedText
      }

      // Теперь нам нужно преобразовать позиции в оригинальном тексте в позиции в экранированном тексте
      // Это сложно, поэтому используем другой подход: будем работать с подстроками
      
      let result = ''
      let lastIndex = 0
      
      // Для каждой позиции вхождения
      for (const pos of positions) {
        // Добавляем текст до вхождения
        result += escapeHtml(textStr.substring(lastIndex, pos.start))
        
        // Добавляем подсвеченный текст
        const matchText = textStr.substring(pos.start, pos.end)
        result += `<span class="${highlightClass}">${escapeHtml(matchText)}</span>`
        
        lastIndex = pos.end
      }
      
      // Добавляем оставшийся текст
      result += escapeHtml(textStr.substring(lastIndex))
      
      return result
    } catch (error) {
      console.error('Highlight error:', error, 'text:', text, 'query:', query)
      return escapeHtml(text)
    }
  }

  // Оптимизированная версия для лучшей производительности
  const highlightTextOptimized = (text, query, highlightClass = 'search-highlight') => {
    if (!query || query.length < 2 || !text || typeof text !== 'string') {
      return escapeHtml(text)
    }

    const queryLower = query.trim().toLowerCase()
    if (queryLower.length < 2) {
      return escapeHtml(text)
    }

    const textStr = String(text)
    const textLower = textStr.toLowerCase()
    
    // Используем регулярное выражение для поиска всех вхождений
    const regex = new RegExp(`(${queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    
    // Разделяем текст на части: совпадения и несовпадения
    const parts = textStr.split(regex)
    
    // Собираем результат с подсветкой
    let result = ''
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Четные индексы - несовпадающие части
        result += escapeHtml(parts[i])
      } else {
        // Нечетные индексы - совпадающие части
        result += `<span class="${highlightClass}">${escapeHtml(parts[i])}</span>`
      }
    }
    
    return result
  }

  // Подсветка для бейджей (работает только от 2 символов)
  const highlightBadge = (text, query) => {
    if (!query || query.length < 2) {
      return escapeHtml(text)
    }
    return highlightTextOptimized(text, query, 'badge-highlight')
  }

  // Проверка содержит ли текст запрос (работает только от 2 символов)
  const containsQuery = (text, query) => {
    if (!text || !query || query.length < 2) return false
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery || normalizedQuery.length < 2) return false
    return String(text).toLowerCase().includes(normalizedQuery)
  }

  // Проверяет, достаточно ли длинный запрос для подсветки
  const isQueryValidForHighlight = (query) => {
    return query && query.trim().length >= 2
  }

  return {
    highlightText: highlightTextOptimized, // Используем оптимизированную версию
    highlightBadge,
    containsQuery,
    isQueryValidForHighlight
  }
}