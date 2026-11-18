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
//   recentSignature — стабильный слепок для дедупликации PUT;
//   planRecentSync — adopt/merge по маркеру последнего синка (внизу).
//
// Идемпотентность: handleAuthLogin вызывается при КАЖДОЙ загрузке страницы
// с живой сессией. Union по slug сам по себе дублей не создаёт, но НЕ
// переносит удаления (очистку истории на другом устройстве) — локальная
// копия при перезагрузке «воскрешала» записи и уходила обратно на сервер.
// Лечится маркером, как в корзине/избранном (planRecentSync).
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

/**
 * Маркер последнего синка истории (хранится в localStorage на клиенте):
 * слепок локального списка на момент, когда сервер его уже получил
 * (успешный PUT / adopt после pull).
 */
export interface RecentSyncMarker {
  userId: string;
  signature: string;
}

/** Решение pull-а: принять серверную историю как есть или сливать с локальной */
export type RecentSyncPlan = { mode: 'adopt' | 'merge'; items: string[] };

/**
 * Что делать с серверной историей при входе / загрузке страницы с сессией
 * (те же правила, что planFavoritesSync / planCartSync):
 *  - маркер совпадает → ADOPT: сервер — источник истины (переносит очистку
 *    истории и новые просмотры с другого устройства); серверной нет → пусто;
 *  - маркера нет / чужой / локальное менялось (гостевые просмотры, сорванный
 *    PUT, смена аккаунта) → MERGE: mergeRecent (идемпотентен).
 */
export const planRecentSync = (
  local: string[] | null,
  remote: string[] | null,
  marker: RecentSyncMarker | null,
  userId: string,
  max: number = RECENTLY_VIEWED_MAX,
): RecentSyncPlan => {
  const localItems = local ?? [];

  const unchangedSinceSync =
    !!marker && marker.userId === userId && marker.signature === recentSignature(localItems);

  if (unchangedSinceSync) {
    return { mode: 'adopt', items: remote ?? [] };
  }

  return { mode: 'merge', items: mergeRecent(localItems, remote, max) };
};
