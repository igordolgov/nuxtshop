// useLocalStorage.js
export const useLocalStorage = () => {
  const saveToLocalStorage = (key, data) => {
    if (process.client) {
      try {
        localStorage.setItem(key, JSON.stringify(data))
        console.log(`💾 Сохранено в localStorage (${key}):`, data?.length || 'data')
      } catch (error) {
        console.error('Ошибка сохранения в localStorage:', error)
        throw error
      }
    }
  }

  const loadFromLocalStorage = (key) => {
    if (process.client) {
      try {
        const saved = localStorage.getItem(key)
        return saved ? JSON.parse(saved) : null
      } catch (error) {
        console.error('Ошибка загрузки из localStorage:', error)
        return null
      }
    }
    return null
  }

  const removeFromLocalStorage = (key) => {
    if (process.client) {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.error('Ошибка удаления из localStorage:', error)
      }
    }
  }

  return {
    saveToLocalStorage,
    loadFromLocalStorage,
    removeFromLocalStorage
  }
}