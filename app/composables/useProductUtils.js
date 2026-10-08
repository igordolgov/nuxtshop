// app/composables/useProductUtils.js
const NO_IMAGE = '/images/no-image.svg'

export const useProductUtils = () => {
  /**
   * Возвращает URL картинки или заглушку.
   * Внешние плейсхолдеры (placeholder.com и т.п.) заменяются на локальную заглушку.
   */
  const getSafeImage = (url) => {
    if (!url) return NO_IMAGE
    if (typeof url !== 'string') return NO_IMAGE
    if (url.includes('placeholder.com')) return NO_IMAGE
    if (url.includes('via.placeholder.com')) return NO_IMAGE
    return url
  }

  /**
   * Форматирование цены для каталога (без валюты, компактно).
   * Для вывода с валютой используй appState.search.formatPrice.
   */
  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price)

  return {
    getSafeImage,
    formatPrice,
    NO_IMAGE,
  }
}