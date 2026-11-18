// app/utils/favoritesSync.ts
// ============================================
// Чистая логика синхронизации избранного с аккаунтом (без Vue/KV/DOM-импортов —
// файл подключается и клиентом, и СЕРВЕРОМ: favoritesHelpers импортирует его
// в серверный tsconfig-граф, любые runtime-ссылки на composables его ломают).
//
//   SyncFavorite          — канонический снапшот избранного (FavoriteSnapshot
//                           в useFavorites — алиас этого типа);
//   normalizeRemoteFavorites — санитизация ответа GET /api/my/favorites
//                              и присылаемого PUT-пейлоада;
//   mergeFavorites        — объединение локального и серверного списков при входе;
//   favoritesSignature    — стабильный слепок для дедупликации PUT;
//   planFavoritesSync     — adopt/merge по маркеру последнего синка (внизу).
//
// Идемпотентность: handleAuthLogin вызывается при КАЖДОЙ загрузке страницы
// с живой сессией. Union по id сам по себе дублей не создаёт, но НЕ переносит
// удаления: удалённый на другом устройстве товар при каждой перезагрузке
// «воскресал» из локальной копии и уходил обратно на сервер (баг релиза
// синка). Лечится маркером: неизменённую с последнего синка локальную копию
// не сливаем — принимаем серверный список как есть (planFavoritesSync).
// ============================================

/** Снапшот товара в избранном — минимум полей для карточки.
 *  Структурно совпадает с FavoriteSnapshot из useFavorites (алиас там же). */
export interface SyncFavorite {
  id: string | null;
  slug: string | null;
  name: string;
  price: number | null;
  image: string | null;
  // Legacy-записи могли сохранить объект категории из categories[0]
  category: string | { name?: string | null } | null;
  categorySlug: string | null;
  brand: string | null;
  description: string;
  inStock: boolean;
  stockQuantity: number | null;
  addedAt: string;
}

/** Сколько снапшотов максимум в избранном (лимит и клиента, и сервера) */
export const SYNC_FAVORITES_MAX = 200;

const asFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const asCappedString = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
};

/** Категория: строка или легаси-объект { name } — прочие формы → null */
const sanitizeCategory = (value: unknown): string | { name?: string | null } | null => {
  if (typeof value === 'string') return value.slice(0, 200) || null;
  if (value && typeof value === 'object') {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name) return { name: name.slice(0, 200) };
    return null;
  }
  return null;
};

const addedAtTime = (value: string): number => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Санитизация одного снапшота с сервера/localStorage: белый список полей
 * (лишнее не попадает в стейт и в KV), строковые/числовые капы.
 * Запись без непустого id отбрасывается (id — ключ merge).
 */
export const sanitizeFavorite = (raw: unknown): SyncFavorite | null => {
  if (!raw || typeof raw !== 'object') return null;
  const fav = raw as Record<string, unknown>;

  const id = asCappedString(fav.id, 120);
  if (!id) return null;

  const price = asFiniteNumber(fav.price);
  const stockQuantity = asFiniteNumber(fav.stockQuantity);
  const addedAt = asCappedString(fav.addedAt, 40) ?? '';

  return {
    id,
    slug: asCappedString(fav.slug, 200),
    name: asCappedString(fav.name, 300) ?? '',
    price: price !== null ? Math.max(0, price) : null,
    image: asCappedString(fav.image, 5000),
    category: sanitizeCategory(fav.category),
    categorySlug: asCappedString(fav.categorySlug, 200),
    brand: asCappedString(fav.brand, 200),
    description: asCappedString(fav.description, 2000) ?? '',
    inStock: fav.inStock === undefined ? true : !!fav.inStock,
    stockQuantity: stockQuantity !== null ? Math.round(stockQuantity) : null,
    addedAt,
  };
};

/**
 * Санитизация серверного списка избранного. Принимает { items: [...] } или
 * голый массив (форма ответа определяется вызывающей стороной). Битые записи
 * отбрасываются поштучно, дубли id схлопываются (остаётся первый — самый
 * свежий), лимит SYNC_FAVORITES_MAX. Совсем мусорный вход → null.
 */
export const normalizeRemoteFavorites = (raw: unknown): SyncFavorite[] | null => {
  // Формы входа: голый массив, { items: [...] } или мусор → null
  // («на сервере ничего осмысленного нет»)
  const list: unknown[] | null = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : null;
  if (!list) return null;

  const seen = new Set<string>();
  const out: SyncFavorite[] = [];
  for (const entry of list.slice(0, SYNC_FAVORITES_MAX)) {
    const fav = sanitizeFavorite(entry);
    if (!fav) continue;
    const id = fav.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(fav);
  }
  return out;
};

/**
 * Объединение избранного при входе в аккаунт / загрузке страницы с сессией.
 *
 * Правила:
 *  - локальный пуст → серверный целиком (вход на новом устройстве);
 *  - иначе union по id; дубликат — снапшот с более СВЕЖИМ addedAt
 *    (несёт актуальные цену/картинку того устройства, что добавило позже);
 *  - порядок результата: по addedAt от свежих к старым (новые сверху,
 *    как и в самом списке избранного);
 *  - серверного списка нет (null) → локальный без изменений;
 *  - входы не мутируются.
 */
export const mergeFavorites = (
  local: SyncFavorite[] | null,
  remote: SyncFavorite[] | null,
): SyncFavorite[] => {
  const localItems = local ?? [];
  const remoteItems = remote ?? [];

  if (remoteItems.length === 0) return localItems.map((fav) => ({ ...fav }));
  if (localItems.length === 0) return remoteItems.map((fav) => ({ ...fav }));

  const byId = new Map<string, SyncFavorite>();
  for (const fav of localItems) {
    if (fav.id) byId.set(fav.id, { ...fav });
  }
  for (const fav of remoteItems) {
    if (!fav.id) continue;
    const existing = byId.get(fav.id);
    if (!existing) {
      byId.set(fav.id, { ...fav });
      continue;
    }
    if (addedAtTime(fav.addedAt) > addedAtTime(existing.addedAt)) byId.set(fav.id, { ...fav });
  }

  return [...byId.values()]
    .sort((a, b) => addedAtTime(b.addedAt) - addedAtTime(a.addedAt))
    .slice(0, SYNC_FAVORITES_MAX);
};

/**
 * Стабильный слепок списка для дедупликации PUT (не гоняем одинаковые
 * списки на сервер при каждом изменении). JSON.stringify с отсортированными
 * ключами на верхнем уровне снапшотов.
 */
export const favoritesSignature = (items: SyncFavorite[]): string => {
  const sorted = items.map((fav) => {
    const out: Record<string, unknown> = {};
    const source = fav as unknown as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      out[key] = source[key];
    }
    return out;
  });
  return JSON.stringify(sorted);
};

/**
 * Маркер последнего синка избранного (хранится в localStorage на клиенте):
 * слепок локального списка на момент, когда сервер его уже получил
 * (успешный PUT / adopt после pull).
 */
export interface FavoritesSyncMarker {
  userId: string;
  signature: string;
}

/** Решение pull-а: принять серверный список как есть или сливать с локальным */
export type FavoritesSyncPlan = { mode: 'adopt' | 'merge'; items: SyncFavorite[] };

/**
 * Что делать с серверным избранным при входе / загрузке страницы с сессией.
 *
 *  - Маркер совпадает (тот же пользователь, локальный список сигнатурно
 *    не изменился с последнего подтверждённого синка) → ADOPT: сервер —
 *    источник истины, принимаем его список целиком. Именно это переносит
 *    удаления и добавления, сделанные на другом устройстве: раньше union
 *    воскрешал удалённый товар при каждой перезагрузке (иногда со снапшотом
 *    со старой картинкой — его заморозило другое устройство раньше).
 *    Серверного нет (null — очищено на другом устройстве) → пустой список.
 *  - Маркера нет / он чужой / локальное менялось после синка (гостевые
 *    правки, сорванный PUT, смена аккаунта) → MERGE: union по id
 *    (идемпотентен), результат уйдёт на сервер PUT-ом.
 *
 * marker — то, что вернул клиент из localStorage (null — нет/битый).
 */
export const planFavoritesSync = (
  local: SyncFavorite[] | null,
  remote: SyncFavorite[] | null,
  marker: FavoritesSyncMarker | null,
  userId: string,
): FavoritesSyncPlan => {
  const localItems = local ?? [];

  const unchangedSinceSync =
    !!marker && marker.userId === userId && marker.signature === favoritesSignature(localItems);

  if (unchangedSinceSync) {
    return { mode: 'adopt', items: remote ?? [] };
  }

  return { mode: 'merge', items: mergeFavorites(localItems, remote) };
};
