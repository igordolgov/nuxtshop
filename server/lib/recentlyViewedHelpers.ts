// server/lib/recentlyViewedHelpers.ts
// ============================================
// Серверная история просмотров пользователя (синк с аккаунтом):
// KV-ключ recently-viewed:<userId>, валидация присылаемого списка slugs
// и чтение/запись.
//
// Санитизация/merge — ЕДИНЫЙ модуль app/utils/recentlyViewedSync.ts (все
// импорты type-only) — клиент и сервер не расходятся, как в cartSync/favoritesSync.
//
// KV без транзакций: одновременные PUT с двух устройств — last write wins.
// Конфликт решается merge на клиенте при входе/загрузке, а не на сервере.
// ============================================

import type { H3Event } from 'h3';
import { kvDelete, kvGetJSON, kvPutJSON } from './storage';
// Чистые функции санитизации — общий модуль с клиентом
import { normalizeRemoteRecent } from '../../app/utils/recentlyViewedSync';

const RECENT_KEY_PREFIX = 'recently-viewed:';
/** TTL истории просмотров в KV: 90 дней, обновляется при каждой записи (эфемерные данные) */
const RECENT_TTL_SECONDS = 60 * 60 * 24 * 90;

/** История, как она хранится в KV (массив slug'ов + метка времени последней записи) */
export interface StoredRecentlyViewed {
  items: string[];
  updatedAt: string;
}

const recentKey = (userId: string): string => RECENT_KEY_PREFIX + userId;

/**
 * Валидация и нормализация списка из PUT /api/my/recently-viewed.
 * Возвращает null, если payload не список ({ items } не массив и не массив).
 */
function normalizeRecentInput(raw: unknown): string[] | null {
  return normalizeRemoteRecent(raw);
}

export async function readUserRecentlyViewed(
  event: H3Event,
  userId: string,
): Promise<StoredRecentlyViewed | null> {
  const stored = await kvGetJSON<StoredRecentlyViewed>(event, recentKey(userId));
  if (!stored || !Array.isArray(stored.items)) return null;
  // На всякий случай прогоняем через санитизацию и при чтении:
  // записи могли пережить смену схемы
  const safe = normalizeRemoteRecent(stored);
  if (!safe) return null;
  return { items: safe, updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : '' };
}

/**
 * Сохраняет историю просмотров пользователя. Принимает unknown: payload клиента
 * проходит валидацию здесь, а не в роуте.
 * Пустая история — легитимное состояние «очистил» →
 * ключ удаляется (не копим пустые записи в KV).
 */
export async function writeUserRecentlyViewed(
  event: H3Event,
  userId: string,
  recentlyViewed: unknown,
): Promise<StoredRecentlyViewed | null> {
  const safe = normalizeRecentInput(recentlyViewed);
  if (!safe) throw new Error('История просмотров не прошла валидацию');

  if (safe.length === 0) {
    await kvDelete(event, recentKey(userId));
    return null;
  }

  const stored: StoredRecentlyViewed = { items: safe, updatedAt: new Date().toISOString() };
  await kvPutJSON(event, recentKey(userId), stored, RECENT_TTL_SECONDS);
  return stored;
}
