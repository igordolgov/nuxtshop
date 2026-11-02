// Тесты server/lib/storeReviewHelpers.ts — отзывы о магазине: валидация,
// витринная выборка, чтение/запись KV (мок, как в review-helpers.test.ts).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map<string, unknown>();

vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async (_event: unknown, key: string) => {
    const stored = kvStore.get(key);
    return stored === undefined ? null : (structuredClone(stored) as unknown);
  }),
  kvPutJSON: vi.fn(async (_event: unknown, key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  }),
  kvDelete: vi.fn(async (_event: unknown, key: string) => {
    kvStore.delete(key);
  }),
}));

import {
  STORE_REVIEWS_KEY,
  StoreReviewValidationError,
  approvedStoreReviews,
  nextStoreReviewId,
  normalizeStoreReviewInput,
  readStoreReviews,
  storeRatingSummary,
  writeStoreReviews,
} from '../../server/lib/storeReviewHelpers';

const EVENT = {} as never;

const validInput = {
  author: 'Мария',
  rating: 5,
  text: 'Магазин огонь: доставка за день, упаковка надёжная!',
};

describe('normalizeStoreReviewInput', () => {
  it('валидирует и триммит корректный отзыв', () => {
    const clean = normalizeStoreReviewInput({ ...validInput, author: '  Мария  ', text: '  Отличный магазин  ' });
    expect(clean).toEqual({ author: 'Мария', rating: 5, text: 'Отличный магазин' });
  });

  it('имя 2–40, рейтинг целое 1..5, текст 10–600', () => {
    expect(() => normalizeStoreReviewInput({ ...validInput, author: 'Я' })).toThrow(/Имя/);
    expect(() => normalizeStoreReviewInput({ ...validInput, rating: 0 })).toThrow(/Оценка/);
    expect(() => normalizeStoreReviewInput({ ...validInput, rating: 3.5 })).toThrow(/Оценка/);
    expect(() => normalizeStoreReviewInput({ ...validInput, text: 'коротко' })).toThrow(/Текст/);
  });

  it('ошибка — экземпляр ReviewValidationError-наследника (endpoint отдаст 400)', () => {
    expect(() => normalizeStoreReviewInput({ ...validInput, text: '' })).toThrow(
      StoreReviewValidationError,
    );
  });
});

describe('approvedStoreReviews / storeRatingSummary', () => {
  it('только approved, свежие сверху', () => {
    const items = [
      { id: '1', author: 'A', rating: 4, text: 'Первый отзыв', createdAt: '2026-01-01', approved: true },
      { id: '2', author: 'B', rating: 5, text: 'Второй отзыв', createdAt: '2026-02-01', approved: false },
      { id: '3', author: 'C', rating: 3, text: 'Третий отзыв', createdAt: '2026-03-01', approved: true },
    ];
    const visible = approvedStoreReviews(items);
    expect(visible.map((r) => r.id)).toEqual(['3', '1']);
    expect(storeRatingSummary(visible)).toEqual({ count: 2, average: 3.5 });
  });

  it('пустой список — нулевая сводка', () => {
    expect(storeRatingSummary([])).toEqual({ count: 0, average: 0 });
  });
});

describe('readStoreReviews / writeStoreReviews / nextStoreReviewId', () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it('пустое/битое хранилище → пустой список', async () => {
    expect(await readStoreReviews(EVENT)).toEqual([]);
    kvStore.set(STORE_REVIEWS_KEY, { мусор: true });
    expect(await readStoreReviews(EVENT)).toEqual([]);
  });

  it('запись-чтение по ключу data:store-reviews, id — максимум + 1', async () => {
    const items = [
      { id: '1', author: 'A', rating: 5, text: 'Отличный магазин', createdAt: '2026-01-01', approved: true },
    ];
    await writeStoreReviews(EVENT, items);
    expect(await readStoreReviews(EVENT)).toEqual(items);
    expect(nextStoreReviewId(items)).toBe('2');
  });

  it('writeStoreReviews не-массив кидает ошибку', async () => {
    await expect(writeStoreReviews(EVENT, 'мусор' as never)).rejects.toThrow(/array/i);
  });
});
