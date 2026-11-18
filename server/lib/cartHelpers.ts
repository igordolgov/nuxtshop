// server/lib/cartHelpers.ts
// ============================================
// Серверная корзина пользователя (синк с аккаунтом): KV-ключ cart:<userId>,
// валидация присылаемого стейта и чтение/запись.
//
// Санитизация/merge — ЕДИНЫЙ модуль app/utils/cartSync.ts (все его импорты
// type-only, в рантайме файл независим от Vue) — клиент и сервер не
// расходятся, как это уже было с promoHelpers/deliveryPrice.
//
// KV без транзакций: одновременные PUT с двух устройств — last write wins
// (KV и так распространяется асинхронно, до 60 секунд между регионами).
// Конфликт решается merge на клиенте при входе/загрузке, а не на сервере.
// ============================================

import type { H3Event } from 'h3';
import { kvDelete, kvGetJSON, kvPutJSON } from './storage';
// Чистые функции санитизации — общий модуль с клиентом
import { normalizeRemoteCart, type SyncableCart } from '../../app/utils/cartSync';

const CART_KEY_PREFIX = 'cart:';
/** TTL корзины в KV: 90 дней, обновляется при каждой записи (брошенные корзины не живут вечно) */
const CART_TTL_SECONDS = 60 * 60 * 24 * 90;

/** Корзина, как она хранится в KV (SyncableCart + метка времени последней записи) */
interface StoredCart extends SyncableCart {
  updatedAt: string;
}

const cartKey = (userId: string): string => CART_KEY_PREFIX + userId;

/**
 * Валидация и нормализация корзины из PUT /api/my/cart.
 * Возвращает null, если payload не корзина (items не массив) —
 * остальные битые поля/позиции отбрасываются поштучно.
 */
function normalizeCartInput(raw: unknown): SyncableCart | null {
  if (!raw || typeof raw !== 'object') return null;
  return normalizeRemoteCart(raw);
}

export async function readUserCart(event: H3Event, userId: string): Promise<StoredCart | null> {
  const stored = await kvGetJSON<StoredCart>(event, cartKey(userId));
  if (!stored || !Array.isArray(stored.items)) return null;
  // На всякий случай прогоняем через санитизацию и при чтении:
  // записи могли пережить смену схемы
  const safe = normalizeRemoteCart(stored);
  if (!safe) return null;
  return { ...safe, updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : '' };
}

/**
 * Сохраняет корзину пользователя. Принимает unknown: payload клиента
 * проходит валидацию/белый список здесь, а не в роуте.
 * Пустая корзина (items: []) — легитимное состояние «очистил» →
 * ключ удаляется (не копим пустые записи в KV).
 */
export async function writeUserCart(
  event: H3Event,
  userId: string,
  cart: unknown,
): Promise<StoredCart | null> {
  const safe = normalizeCartInput(cart);
  if (!safe) throw new Error('Корзина не прошла валидацию');

  if (safe.items.length === 0) {
    await kvDelete(event, cartKey(userId));
    return null;
  }

  const stored: StoredCart = { ...safe, updatedAt: new Date().toISOString() };
  await kvPutJSON(event, cartKey(userId), stored, CART_TTL_SECONDS);
  return stored;
}
