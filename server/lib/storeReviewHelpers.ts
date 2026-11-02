// server/lib/storeReviewHelpers.ts
// Отзывы О МАГАЗИНЕ (не о товарах): KV `data:store-reviews`, паттерн
// reviewHelpers — отправка с витрины → approved:false → модерация в админке.
// Витрина — блок на странице «О магазине» (/about).
//
// От общих хелперов переиспользуем сортировку, сводку и лимиты текстов
// (sortReviewsDesc/ratingSummary обобщены — принимают любой { id, createdAt }
// и { rating }); productId и фото у магазинного отзыва отсутствуют.
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import {
  REVIEW_AUTHOR_MAX,
  REVIEW_TEXT_MAX,
  ReviewValidationError,
  ratingSummary,
  sortReviewsDesc,
} from './reviewHelpers';

export const STORE_REVIEWS_KEY = 'data:store-reviews';

export interface StoreReviewItem {
  id: string;
  /** Имя автора (2–40 символов). */
  author: string;
  /** Оценка 1..5 (целая). */
  rating: number;
  /** Текст отзыва (10–600 символов). */
  text: string;
  /** ISO-момент создания. */
  createdAt: string;
  /** Прошёл модерацию? Публично отдаются только approved. */
  approved: boolean;
}

// ─── Чтение / запись ─────────────────────────────────────────────────────

export async function readStoreReviews(event: H3Event): Promise<StoreReviewItem[]> {
  const stored = await kvGetJSON<StoreReviewItem[]>(event, STORE_REVIEWS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((r) => r && typeof r === 'object' && r.id != null);
}

export async function writeStoreReviews(event: H3Event, items: StoreReviewItem[]): Promise<void> {
  if (!Array.isArray(items)) throw new Error('Store reviews must be an array');
  await kvPutJSON(event, STORE_REVIEWS_KEY, items);
}

export function nextStoreReviewId(items: StoreReviewItem[]): string {
  return items.length > 0 ? String(Math.max(...items.map((r) => Number(r.id) || 0)) + 1) : '1';
}

// ─── Валидация (чистая функция — покрыта тестами) ────────────────────────

/**
 * Приводит payload публичной формы к полям отзыва о магазине. Лимиты и
 * сообщения ошибок — те же, что у товарных отзывов. approved/createdAt/id
 * выставляет endpoint (не пользователь).
 */
export function normalizeStoreReviewInput(raw: Record<string, unknown>): {
  author: string;
  rating: number;
  text: string;
} {
  const author = typeof raw?.author === 'string' ? raw.author.trim() : '';
  if (author.length < 2 || author.length > REVIEW_AUTHOR_MAX) {
    throw new ReviewValidationError(`Имя — от 2 до ${REVIEW_AUTHOR_MAX} символов`);
  }

  const rating = Number(raw?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewValidationError('Оценка — целое число от 1 до 5');
  }

  const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
  if (text.length < 10 || text.length > REVIEW_TEXT_MAX) {
    throw new ReviewValidationError(`Текст отзыва — от 10 до ${REVIEW_TEXT_MAX} символов`);
  }

  return { author, rating, text };
}

// ─── Витринная выборка (чистая функция — покрыта тестами) ────────────────

/** Одобренные отзывы о магазине, свежие сверху. */
export function approvedStoreReviews(items: StoreReviewItem[]): StoreReviewItem[] {
  return sortReviewsDesc(items.filter((r) => r.approved));
}

// Реэкспорт: витрине и админке нужна та же сводка { count, average }
export { ratingSummary as storeRatingSummary };
// Ошибка валидации под собственным именем — endpoints различают её тип
export { ReviewValidationError as StoreReviewValidationError };
