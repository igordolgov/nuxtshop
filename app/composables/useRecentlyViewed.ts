// app/composables/useRecentlyViewed.ts
// ============================================
// Composable: useRecentlyViewed — история просмотров товаров
// («Недавно смотрели» на главной и в карточке товара).
//
// Хранилище — localStorage браузера (ключ recentlyViewed): персональные
// данные; история переживает перезагрузку и работает для гостей без аккаунта.
// Хранятся SLUG/ID из URL карточки (то, что стоит в /product/<значение>),
// компонент-полоса сам сопоставляет их с каталогом.
//
// Синк с аккаунтом (тот же паттерн, что в useCart/useFavorites):
// debounce-push на PUT /api/my/recently-viewed после мутаций истории,
// pull+merge при входе/загрузке с сессией, гашение при выходе/401.
// Чистая логика merge/санитизации — app/utils/recentlyViewedSync.ts
// (общая с сервером). Константы ключа/лимита каноничны там же.
//
// pushRecent — чистая функция (юнит-тесты без localStorage):
// повторы поднимают товар наверх, длина ограничена RECENTLY_VIEWED_MAX.
// ============================================

import {
  mergeRecent,
  normalizeRemoteRecent,
  recentSignature,
  RECENTLY_VIEWED_KEY,
  RECENTLY_VIEWED_MAX,
} from '../utils/recentlyViewedSync';

// Совместимость: потребители импортировали константы отсюда
export { RECENTLY_VIEWED_KEY, RECENTLY_VIEWED_MAX };

const OWNER_KEY = 'recently-viewed-owner';
// Задержка пуша после мутации: склеиваем серии изменений в один PUT
const PUSH_DEBOUNCE_MS = 1200;

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

// ─── Синк с аккаунтом (модульный синглтон) ─────────────────
// История — не реактивный стейт (компоненты перечитывают localStorage по
// событиям), поэтому sync-состояние — простые let на уровне модуля.
// Все функции-гварды import.meta.client: на SSR модульное состояние не трогается.

let syncUserId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
// Слепок последнего удачно отправленного состояния: PUT только на реальные диффы
let lastPushedSignature: string | null = null;
// Дедупликация pull при входе (login-страница + initializeApp могут
// вызвать handleAuthLogin почти одновременно).
let pullInFlight: Promise<void> | null = null;

/** Сырое чтение истории из localStorage (только клиент; битые данные → []) */
const readStoredSlugs = (): string[] => {
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

const readOwner = (): string | null => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};

const writeOwner = (userId: string): void => {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // приватный режим — синк продолжает работать в рамках сессии
  }
};

const pushRecentList = async (): Promise<void> => {
  if (!import.meta.client || !syncUserId) return;
  const list = readStoredSlugs();
  const signature = recentSignature(list);
  if (signature === lastPushedSignature) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  try {
    await $fetch('/api/my/recently-viewed', {
      method: 'PUT',
      credentials: 'include',
      body: { recentlyViewed: list },
    });
    lastPushedSignature = signature;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      // Сессия истекла на сервере: гасим синк, локальная история остаётся
      syncUserId = null;
      lastPushedSignature = null;
      return;
    }
    // Сеть/сервер упали — отправим при следующей мутации (signature не запомнен)
    console.warn('[useRecentlyViewed] Не удалось сохранить историю на сервере:', error);
  }
};

const schedulePush = (): void => {
  if (!import.meta.client || !syncUserId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushRecentList();
  }, PUSH_DEBOUNCE_MS);
};

/**
 * Вход в аккаунт / загрузка страницы с живой сессией: подтянуть серверную
 * историю и объединить с локальной (правила — mergeRecent в
 * recentlyViewedSync.ts). Вызывается из useAuth.login/register и из
 * initializeApp после checkAuth — как handleAuthLogin в useCart.
 */
const handleAuthLogin = (user: { id?: string | number | null } | null): Promise<void> => {
  if (!import.meta.client) return Promise.resolve();
  const userId = user?.id != null ? String(user.id) : null;
  if (!userId || syncUserId === userId) return Promise.resolve();
  if (pullInFlight) return pullInFlight;

  pullInFlight = (async () => {
    let remote: string[] | null = null;
    try {
      const resp = await $fetch<{ success: boolean; recentlyViewed: unknown }>(
        '/api/my/recently-viewed',
        { credentials: 'include' },
      );
      remote = normalizeRemoteRecent(resp?.recentlyViewed);
    } catch (error) {
      if ((error as { status?: number }).status === 401) return; // сессии нет
      console.warn('[useRecentlyViewed] Не удалось загрузить историю аккаунта:', error);
      return; // сеть упала — подтянем при следующем входе/загрузке
    }

    // На этом устройстве уже синхронизировали ДРУГОЙ аккаунт — локальную
    // историю (его) не переносим в новую учётку
    const owner = readOwner();
    const discardLocal = owner != null && owner !== userId;
    const merged = mergeRecent(discardLocal ? [] : readStoredSlugs(), remote);

    try {
      window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(merged));
    } catch {
      // переполнение квоты / приватный режим — история не критична
    }
    syncUserId = userId;
    writeOwner(userId);

    // Пушим только реальный дифф с сервером (пустой сервер + пустая локальная
    // → PUT не нужен вовсе)
    const current = recentSignature(merged);
    const remoteSignature = remote ? recentSignature(remote) : null;
    if (current !== remoteSignature) {
      lastPushedSignature = null;
      void pushRecentList();
    } else {
      lastPushedSignature = current;
    }

    // Полоса «Недавно смотрели» в ЭТОЙ вкладке перечитывает localStorage
    // по этому событию (storage срабатывает только в других вкладках)
    try {
      window.dispatchEvent(new CustomEvent('recently-viewed-updated'));
    } catch {
      // вне браузерного контекста — не критично
    }
  })();

  pullInFlight.finally(() => {
    pullInFlight = null;
  });
  return pullInFlight;
};

/**
 * Выход из аккаунта: синк гасится, локальная история остаётся гостевой.
 * Owner не трогаем — повторный вход в тот же аккаунт продолжит синк.
 */
const handleAuthLogout = (): void => {
  if (!import.meta.client) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  syncUserId = null;
  lastPushedSignature = null;
};

// Финальный пуш при уходе со страницы/скрытии таба: debounce не дождётся
if (import.meta.client) {
  const flush = () => {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    void pushRecentList();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

export const useRecentlyViewed = () => {
  /** Прочитать историю (только клиент; на SSR — пустой массив). */
  const readSlugs = (): string[] => {
    if (!import.meta.client) return [];
    return readStoredSlugs();
  };

  /** Записать просмотр карточки: slug наверх истории. */
  const addRecentlyViewed = (slug?: string | null): void => {
    if (!import.meta.client || !slug) return;
    try {
      window.localStorage.setItem(
        RECENTLY_VIEWED_KEY,
        JSON.stringify(pushRecent(readStoredSlugs(), slug)),
      );
    } catch {
      // переполнение квоты / приватный режим — история не критична
    }
    schedulePush();
  };

  /** Очистить историю (кнопка «Очистить» в блоке). */
  const clearRecentlyViewed = (): void => {
    if (!import.meta.client) return;
    try {
      window.localStorage.removeItem(RECENTLY_VIEWED_KEY);
    } catch {
      // игнорируем
    }
    schedulePush();
  };

  return {
    readSlugs,
    addRecentlyViewed,
    clearRecentlyViewed,
    handleAuthLogin,
    handleAuthLogout,
  };
};
