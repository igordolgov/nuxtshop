// server/lib/favoritesHelpers.ts
// ============================================
// Серверное избранное пользователя (синк с аккаунтом): KV-ключ favorites:<userId>,
// валидация присылаемого списка и чтение/запись.
//
// Санитизация/merge — ЕДИНЫЙ модуль app/utils/favoritesSync.ts (все импорты
// type-only, в рантайме файл независим от Vue) — клиент и сервер не расходятся,
// как это уже сделано для корзины (cartSync/cartHelpers).
//
// KV без транзакций: одновременные PUT с двух устройств — last write wins.
// Конфликт решается merge на клиенте при входе/загрузке, а не на сервере.
// ============================================

import type { H3Event } from 'h3';
import { kvDelete, kvGetJSON, kvPutJSON } from './storage';
// Чистые функции санитизации — общий модуль с клиентом
import { normalizeRemoteFavorites, type SyncFavorite } from '../../app/utils/favoritesSync';

const FAVORITES_KEY_PREFIX = 'favorites:';
/** TTL избранного в KV: 365 дней, обновляется при каждой записи (профильные данные, живут дольше корзины) */
const FAVORITES_TTL_SECONDS = 60 * 60 * 24 * 365;

/** Избранное, как оно хранится в KV (список снапшотов + метка времени последней записи) */
export interface StoredFavorites {
  items: SyncFavorite[];
  updatedAt: string;
}

const favoritesKey = (userId: string): string => FAVORITES_KEY_PREFIX + userId;

/**
 * Валидация и нормализация списка из PUT /api/my/favorites.
 * Возвращает null, если payload не список ({ items } не массив и не массив) —
 * остальные битые записи отбрасываются поштучно.
 */
function normalizeFavoritesInput(raw: unknown): SyncFavorite[] | null {
  return normalizeRemoteFavorites(raw);
}

export async function readUserFavorites(
  event: H3Event,
  userId: string,
): Promise<StoredFavorites | null> {
  const stored = await kvGetJSON<StoredFavorites>(event, favoritesKey(userId));
  if (!stored || !Array.isArray(stored.items)) return null;
  // На всякий случай прогоняем через санитизацию и при чтении:
  // записи могли пережить смену схемы
  const safe = normalizeRemoteFavorites(stored);
  if (!safe) return null;
  return { items: safe, updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : '' };
}

/**
 * Сохраняет избранное пользователя. Принимает unknown: payload клиента
 * проходит валидацию/белый список здесь, а не в роуте.
 * Пустой список — легитимное состояние «очистил» →
 * ключ удаляется (не копим пустые записи в KV).
 */
export async function writeUserFavorites(
  event: H3Event,
  userId: string,
  favorites: unknown,
): Promise<StoredFavorites | null> {
  const safe = normalizeFavoritesInput(favorites);
  if (!safe) throw new Error('Избранное не прошло валидацию');

  if (safe.length === 0) {
    await kvDelete(event, favoritesKey(userId));
    return null;
  }

  const stored: StoredFavorites = { items: safe, updatedAt: new Date().toISOString() };
  await kvPutJSON(event, favoritesKey(userId), stored, FAVORITES_TTL_SECONDS);
  return stored;
}
