// composables/useTokens.ts
export const useDesignTokens = () => {
  const getToken = (name: string): string => {
    if (process.client) {
      return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    }
    return ''; // На сервере возвращаем дефолт
  };

  const setToken = (name: string, value: string): void => {
    if (process.client) {
      document.documentElement.style.setProperty(`--${name}`, value);
    }
  };

  return { getToken, setToken };
};
