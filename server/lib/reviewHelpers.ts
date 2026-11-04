// server/lib/reviewHelpers.ts
// Отзывы о товарах: KV-хранилище + валидация. Зеркало паттерна newsHelpers:
// live-данные в KV `data:reviews`; пустое хранилище — просто пустой список
// (сидеть на фейковых отзывах не хотим — отзывы только настоящие).
//
// Модерация: покупатель отправляет отзыв → approved:false → админ публикует
// в /admin/reviews (или скрывает/удаляет). Публично отдаются только approved.
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';

export const REVIEWS_KEY = 'data:reviews';

export interface ReviewItem {
  id: string;
  /** id товара из data:products (строкой). */
  productId: string;
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
  /** Фото покупателя: пути /api/images/reviews/… (или data-URI в dev). */
  photos?: string[];
  /** Кто отметил отзыв «полезно» (id пользователей). Наружу НЕ отдаётся —
   *  только счётчик и факт отметки текущего пользователя (publicReviewView). */
  helpfulBy?: string[];
  /** Ответ магазина на отзыв; пусто — ответа нет (или удалён). */
  shopReply?: { text: string; at: string };
}

/** Сводка по товару для карточки и Schema.org aggregateRating. */
export interface RatingSummary {
  count: number;
  /** Средняя оценка, 1 знак после запятой; 0 при пустом списке. */
  average: number;
}

// ─── Чтение / запись ─────────────────────────────────────────────────────

/** Читает отзывы из KV; пустое/битое хранилище → пустой список. */
export async function readReviews(event: H3Event): Promise<ReviewItem[]> {
  const stored = await kvGetJSON<ReviewItem[]>(event, REVIEWS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((r) => r && typeof r === 'object' && r.id != null);
}

/** Единственная точка записи: массив ЦЕЛИКОМ в KV (валидация типа). */
export async function writeReviews(event: H3Event, items: ReviewItem[]): Promise<void> {
  if (!Array.isArray(items)) throw new Error('Reviews must be an array');
  await kvPutJSON(event, REVIEWS_KEY, items);
}

/** Следующий свободный числовой id (как у новостей/товаров). */
export function nextReviewId(items: ReviewItem[]): string {
  return items.length > 0 ? String(Math.max(...items.map((r) => Number(r.id) || 0)) + 1) : '1';
}

// ─── Валидация / нормализация (чистые функции — покрыты тестами) ─────────

const MAX_AUTHOR_LEN = 40;
const MAX_TEXT_LEN = 600;

export const REVIEW_AUTHOR_MAX = MAX_AUTHOR_LEN;
export const REVIEW_TEXT_MAX = MAX_TEXT_LEN;

export class ReviewValidationError extends Error {}

/**
 * Приводит полезную нагрузку публичной формы к полям отзыва. Кидает
 * ReviewValidationError с сообщением на русском → endpoint отдаёт 400.
 * approved/createdAt/id выставляет endpoint (не пользователь).
 */
export function normalizeReviewInput(raw: Record<string, unknown>): {
  productId: string;
  author: string;
  rating: number;
  text: string;
} {
  const productId =
    typeof raw?.productId === 'string' ? raw.productId.trim() : String(raw?.productId ?? '').trim();
  if (!productId || productId.length > 64) {
    throw new ReviewValidationError('Не указан товар для отзыва');
  }

  const author = typeof raw?.author === 'string' ? raw.author.trim() : '';
  if (author.length < 2 || author.length > MAX_AUTHOR_LEN) {
    throw new ReviewValidationError(`Имя — от 2 до ${MAX_AUTHOR_LEN} символов`);
  }

  const rating = Number(raw?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewValidationError('Оценка — целое число от 1 до 5');
  }

  const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
  if (text.length < 10 || text.length > MAX_TEXT_LEN) {
    throw new ReviewValidationError(`Текст отзыва — от 10 до ${MAX_TEXT_LEN} символов`);
  }

  return { productId, author, rating, text, photos: normalizeReviewPhotos(raw?.photos) };
}

// ─── Фото отзыва (чистые функции — покрыты тестами) ──────────────────────

/** Сколько фото можно приложить к одному отзыву. */
export const MAX_REVIEW_PHOTOS = 3;

/** Лимит РАЗЖАТОГО размера одного фото (клиент жмёт в webp ~50–150 КБ). */
export const MAX_REVIEW_PHOTO_BYTES = 300 * 1024;

const REVIEW_PHOTO_RE = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Валидирует массив фото из формы отзыва: только data-URI изображений
 * (webp/jpeg/png — то, что выдаёт useImageResize), не больше
 * MAX_REVIEW_PHOTOS и не больше MAX_REVIEW_PHOTO_BYTES на каждое.
 * Пустой/отсутствующий photos → [] (фото необязательны).
 */
export function normalizeReviewPhotos(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new ReviewValidationError('Некорректный список фото');
  }
  if (raw.length > MAX_REVIEW_PHOTOS) {
    throw new ReviewValidationError(`К отзыву можно приложить не более ${MAX_REVIEW_PHOTOS} фото`);
  }

  const photos: string[] = [];
  for (const entry of raw) {
    const uri = typeof entry === 'string' ? entry.trim() : '';
    if (!uri) {
      // Пустая строка — просто пропуск; не-строка — битая полезная нагрузка
      if (typeof entry !== 'string' && entry != null) {
        throw new ReviewValidationError('Фото должно быть изображением webp, jpeg или png');
      }
      continue;
    }

    const match = REVIEW_PHOTO_RE.exec(uri);
    if (!match) {
      throw new ReviewValidationError('Фото должно быть изображением webp, jpeg или png');
    }
    // Размер ПОСЛЕ base64-декодирования: 4 символа base64 → 3 байта.
    const bytes = Math.floor(match[2].length * 0.75);
    if (bytes > MAX_REVIEW_PHOTO_BYTES) {
      throw new ReviewValidationError('Фото слишком большое (макс. 300 КБ после сжатия)');
    }
    if (!photos.includes(uri)) photos.push(uri);
  }
  return photos;
}

// ─── «Полезно» и ответ магазина ──────────────────────────────────────────

/** Защита от раздутия KV-записи: максимум отметок «полезно» на отзыв. */
export const MAX_HELPFUL_MARKS = 1000;

/** Лимит ответа магазина (символов после тримминга). */
export const SHOP_REPLY_MAX = 600;

/** Число отметок «полезно» (helpfulBy может отсутствовать у старых отзывов). */
export function helpfulCountOf(review: ReviewItem): number {
  return Array.isArray(review.helpfulBy) ? review.helpfulBy.length : 0;
}

/**
 * Переключает отметку «полезно»: возвращает 'added' | 'removed'.
 * Мутирует review на месте (как updateOrderStatus мутирует order) —
 * endpoint читает/пишет массив целиком, отдельной записи на отметку нет.
 * Чистая логика — покрыта тестами.
 */
export function toggleHelpful(review: ReviewItem, userId: string): 'added' | 'removed' {
  const id = String(userId ?? '').trim();
  if (!id) throw new ReviewValidationError('Не указан пользователь');
  const marks = Array.isArray(review.helpfulBy) ? review.helpfulBy : [];
  if (marks.includes(id)) {
    review.helpfulBy = marks.filter((m) => m !== id);
    return 'removed';
  }
  if (marks.length >= MAX_HELPFUL_MARKS) {
    throw new ReviewValidationError('У отзыва слишком много отметок');
  }
  review.helpfulBy = [...marks, id];
  return 'added';
}

/**
 * Валидирует текст ответа магазина: тримминг, 2..SHOP_REPLY_MAX символов.
 * Пустая/пробельная строка — легитимное «удалить ответ», возвращается ''.
 * Кидает ReviewValidationError → endpoint отдаёт 400.
 */
export function normalizeShopReplyText(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return '';
  if (text.length < 2 || text.length > SHOP_REPLY_MAX) {
    throw new ReviewValidationError(`Ответ магазина — от 2 до ${SHOP_REPLY_MAX} символов`);
  }
  return text;
}

/**
 * Ставит/обновляет ответ магазина; text '' — удаляет существующий.
 * Мутация на месте; момент выставляет сервер (не админ-клиент).
 */
export function applyShopReply(review: ReviewItem, text: string, now = new Date()): void {
  if (!text) {
    delete review.shopReply;
    return;
  }
  review.shopReply = { text, at: now.toISOString() };
}

/**
 * Витринный вид отзыва: helpfulBy (id пользователей) наружу не уходит —
 * вместо него helpfulCount и likedByMe текущего пользователя (null → false).
 * shopReply проходят как есть, персональных данных не содержат.
 */
export function publicReviewView(
  review: ReviewItem,
  userId?: string | null,
): Omit<ReviewItem, 'helpfulBy'> & { helpfulCount: number; likedByMe: boolean } {
  const { helpfulBy, ...rest } = review;
  void helpfulBy;
  return {
    ...rest,
    helpfulCount: helpfulCountOf(review),
    likedByMe: Boolean(
      userId && Array.isArray(review.helpfulBy) && review.helpfulBy.includes(String(userId)),
    ),
  };
}

// ─── Витринные выборки (чистые функции — покрыты тестами) ────────────────

/**
 * Свежие сверху; при равных createdAt — больший id (стабильно).
 * Обобщённая: работает и с отзывами о товарах, и с отзывами о магазине
 * (StoreReviewItem) — один и тот же порядок сортировки.
 */
export function sortReviewsDesc<T extends { id: string | number; createdAt?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const d = String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    if (d !== 0) return d;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

/** Одобренные отзывы товара, свежие сверху. */
export function approvedReviews(items: ReviewItem[], productId: string): ReviewItem[] {
  return sortReviewsDesc(
    items.filter((r) => r.approved && String(r.productId) === String(productId)),
  );
}

/**
 * Сводка по списку: количество и средняя оценка (1 знак).
 * Обобщённая: любой { rating: number } (товарные и магазинные отзывы).
 */
export function ratingSummary<T extends { rating: number }>(items: T[]): RatingSummary {
  if (items.length === 0) return { count: 0, average: 0 };
  const sum = items.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return { count: items.length, average: Math.round((sum / items.length) * 10) / 10 };
}

/**
 * Сводки рейтинга по ВСЕМ товарам одним проходом: одобренные отзывы
 * группируются по productId → { count, average }. Товары без отзывов
 * в карте отсутствуют (attachRatings подставит им нулевую сводку).
 * Чистая функция — покрыта тестами.
 */
export function ratingsByProduct(items: ReviewItem[]): Map<string, RatingSummary> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of items) {
    if (!r?.approved) continue;
    const key = String(r.productId);
    const agg = acc.get(key) ?? { sum: 0, count: 0 };
    agg.sum += Number(r.rating) || 0;
    agg.count += 1;
    acc.set(key, agg);
  }
  const result = new Map<string, RatingSummary>();
  for (const [key, { sum, count }] of acc) {
    result.set(key, { count, average: Math.round((sum / count) * 10) / 10 });
  }
  return result;
}

/**
 * Прикрепляет к каждому товару витринную сводку rating { count, average }
 * (нулевой рейтинг — когда одобренных отзывов нет). Один обмен с KV на весь
 * список: карточкам каталога звёзды достаются без дополнительных запросов.
 */
export async function attachRatings<T extends { id: string | number }>(
  event: H3Event,
  products: T[],
): Promise<(T & { rating: RatingSummary })[]> {
  const summaries = ratingsByProduct(await readReviews(event));
  return products.map((p) => ({
    ...p,
    rating: summaries.get(String(p.id)) ?? { count: 0, average: 0 },
  }));
}
