// composables/useTokens.js
export const useDesignTokens = () => {
  const getToken = (name) => {
    if (process.client) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(`--${name}`).trim()
    }
    return '' // На сервере возвращаем дефолт
  }
  
  const setToken = (name, value) => {
    if (process.client) {
      document.documentElement.style.setProperty(`--${name}`, value)
    }
  }
  
  return { getToken, setToken }
}