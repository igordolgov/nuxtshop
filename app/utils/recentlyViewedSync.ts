// app/utils/recentlyViewedSync.ts
// ============================================
// Чистая логика синхронизации истории просмотров с аккаунтом (без
// Vue/localStorage/DOM-импортов — файл подключается и клиентом, и СЕРВЕРОМ:
// recentlyViewedHelpers импортирует его в серверный tsconfig-граф).
//
// История — плоский массив slug'ов (то, что стоит в /product/<значение>),
// порядок = свежесть: первый элемент просмотрен последним.
//
//   RECENTLY_VIEWED_KEY / RECENTLY_VIEWED_MAX — канонические константы
//     (useRecentlyViewed реэкспортирует их для совместимости);
//   normalizeRemoteRecent — санитизация ответа GET /api/my/recently-viewed
//     и присылаемого PUT-пейлоада;
//   mergeRecent — объединение локальной и серверной истории при входе;
//   recentSignature — стабильный слепок для дедупликации PUT.
// ============================================

export const RECENTLY_VIEWED_KEY = 'recentlyViewed';
export const RECENTLY_VIEWED_MAX = 12;

/** Лимит длины одного slug'а (то же, что в localStorage-санитизации клиента) */
export const RECENT_SLUG_MAX_LENGTH = 200;

/**
 * Санитизация списка slug'ов: только непустые строки с капом длины,
 * дубли схлопываются (остаётся ПЕРВОЕ вхождение — самое свежее),
 * лимит RECENTLY_VIEWED_MAX. Принимает { items: [...] } или голый массив;
 * мусорный вход → null («на сервере ничего осмысленного нет»).
 */
export const normalizeRemoteRecent = (raw: unknown): string[] | null => {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : null;
  if (!list) return null;

  const out: string[] = [];
  for (const entry of list.slice(0, RECENTLY_VIEWED_MAX)) {
    if (typeof entry !== 'string' || !entry) continue;
    const slug = entry.slice(0, RECENT_SLUG_MAX_LENGTH);
    if (!out.includes(slug)) out.push(slug);
  }
  return out;
};

/**
 * Объединение историй при входе в аккаунт / загрузке страницы с сессией.
 *
 * Правила:
 *  - локальная история пуста → серверная целиком (вход на новом устройстве);
 *  - серверной нет (null) → локальная без изменений;
 *  - иначе: локальный порядок (это устройство «живёт» карточками сейчас,
 *    его просмотры свежее) + slug'и, которых локально не видели, — в конец
 *    (на сервере они тоже были «старыми» для этого устройства);
 *  - кап RECENTLY_VIEWED_MAX, входы не мутируются.
 */
export const mergeRecent = (
  local: string[] | null,
  remote: string[] | null,
  max: number = RECENTLY_VIEWED_MAX,
): string[] => {
  const localItems = local ?? [];
  const remoteItems = remote ?? [];

  if (remoteItems.length === 0) return [...localItems];
  if (localItems.length === 0) return [...remoteItems];

  const out = [...localItems];
  for (const slug of remoteItems) {
    if (!out.includes(slug)) out.push(slug);
  }
  return out.slice(0, max);
};

/** Стабильный слепок истории для дедупликации PUT */
export const recentSignature = (items: string[]): string => JSON.stringify(items);
