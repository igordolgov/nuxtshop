// composables/useSearchHighlight.js
export const useSearchHighlight = () => {
  // Функция для экранирования HTML
  const escapeHtml = (text) => {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
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