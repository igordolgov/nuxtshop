// app/composables/useRecentlyViewed.ts
// ============================================
// Composable: useRecentlyViewed — история просмотров товаров
// («Недавно смотрели» на главной и в карточке товара).
//
// Хранилище — localStorage браузера (ключ recentlyViewed): персональные
// данные, серверу не нужны; история переживает перезагрузку и работает
// для гостей без аккаунта. Хранятся SLUG/ID из URL карточки (то, что
// стоит в /product/<значение>), компонент-полоса сам сопоставляет их
// с каталогом.
//
// pushRecent — чистая функция (юнит-тесты без localStorage):
// повторы поднимают товар наверх, длина ограничена RECENTLY_VIEWED_MAX.
// ============================================

export const RECENTLY_VIEWED_KEY = 'recentlyViewed';
export const RECENTLY_VIEWED_MAX = 12;

/** Чистая: добавить slug в историю — наверх списка, без дублей,
 *  с ограничением длины. Битые входы не бросают исключений. */
export const pushRecent = (
  list?: unknown,
  slug?: unknown,
  max: number = RECENTLY_VIEWED_MAX,
): string[] => {
  if (!slug || typeof slug !== 'string') {
    return Array.isArray(list) ? [...(list as string[])] : [];
  }
  const rest = (Array.isArray(list) ? (list as string[]) : []).filter((s) => s !== slug);
  return [slug, ...rest].slice(0, max);
};

export const useRecentlyViewed = () => {
  /** Прочитать историю (только клиент; на SSR — пустой массив). */
  const readSlugs = (): string[] => {
    if (!import.meta.client) return [];
    try {
      const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === 'string' && !!s)
        : [];
    } catch {
      return []; // битый JSON / недоступный localStorage — не критично
    }
  };

  /** Записать просмотр карточки: slug наверх истории. */
  const addRecentlyViewed = (slug?: string | null): void => {
    if (!import.meta.client || !slug) return;
    try {
      window.localStorage.setItem(
        RECENTLY_VIEWED_KEY,
        JSON.stringify(pushRecent(readSlugs(), slug)),
      );
    } catch {
      // переполнение квоты / приватный режим — история не критична
    }
  };

  /** Очистить историю (кнопка «Очистить» в блоке). */
  const clearRecentlyViewed = (): void => {
    if (!import.meta.client) return;
    try {
      window.localStorage.removeItem(RECENTLY_VIEWED_KEY);
    } catch {
      // игнорируем
    }
  };

  return { readSlugs, addRecentlyViewed, clearRecentlyViewed };
};
