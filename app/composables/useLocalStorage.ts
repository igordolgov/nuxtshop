// useLocalStorage.ts
export const useLocalStorage = () => {
  const saveToLocalStorage = (key: string, data: unknown): void => {
    if (process.client) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(
          `💾 Сохранено в localStorage (${key}):`,
          (data as { length?: unknown })?.length || 'data',
        );
      } catch (error) {
        console.error('Ошибка сохранения в localStorage:', error);
        throw error;
      }
    }
  };

  const loadFromLocalStorage = <T = unknown>(key: string): T | null => {
    if (process.client) {
      try {
        const saved = localStorage.getItem(key);
        return saved ? (JSON.parse(saved) as T) : null;
      } catch (error) {
        console.error('Ошибка загрузки из localStorage:', error);
        return null;
      }
    }
    return null;
  };

  const removeFromLocalStorage = (key: string): void => {
    if (process.client) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Ошибка удаления из localStorage:', error);
      }
    }
  };

  return {
    saveToLocalStorage,
    loadFromLocalStorage,
    removeFromLocalStorage,
  };
};
