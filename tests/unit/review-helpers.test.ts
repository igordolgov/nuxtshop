// Тесты server/lib/reviewHelpers.ts — валидация normalizeReviewInput
// (сообщения ошибок), витринные выборки approvedReviews/sortReviewsDesc,
// сводка ratingSummary, nextReviewId, чтение пустого/битого хранилища.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV (тот же паттерн, что в news-helpers.test.ts) ────────────────
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
  REVIEWS_KEY,
  ReviewValidationError,
  approvedReviews,
  attachRatings,
  MAX_REVIEW_PHOTOS,
  MAX_REVIEW_PHOTO_BYTES,
  nextReviewId,
  normalizeReviewInput,
  normalizeReviewPhotos,
  ratingSummary,
  ratingsByProduct,
  readReviews,
  sortReviewsDesc,
  writeReviews,
} from '../../server/lib/reviewHelpers';

const EVENT = {} as never;

const validInput = {
  productId: '7',
  author: 'Иван',
  rating: 5,
  text: 'Отличная кружка, доехала целой!',
};

const review = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '1',
  productId: '7',
  author: 'Иван',
  rating: 5,
  text: 'Хороший товар',
  createdAt: '2026-11-01T10:00:00.000Z',
  approved: true,
  ...overrides,
});

beforeEach(() => {
  kvStore.clear();
});

describe('normalizeReviewInput', () => {
  it('валидирует и триммит корректный отзыв', () => {
    const clean = normalizeReviewInput({
      ...validInput,
      author: '  Иван  ',
      text: '  Отличная кружка  ',
    });
    expect(clean).toEqual({
      productId: '7',
      author: 'Иван',
      rating: 5,
      text: 'Отличная кружка',
      photos: [],
    });
  });

  it('productId обязателен', () => {
    expect(() => normalizeReviewInput({ ...validInput, productId: '' })).toThrow(/Не указан товар/);
    expect(() => normalizeReviewInput({ ...validInput, productId: undefined })).toThrow(
      /Не указан товар/,
    );
  });

  it('имя: от 2 до 40 символов', () => {
    expect(() => normalizeReviewInput({ ...validInput, author: 'Я' })).toThrow(/Имя/);
    expect(() => normalizeReviewInput({ ...validInput, author: 'А'.repeat(41) })).toThrow(/Имя/);
  });

  it('оценка: целое 1..5', () => {
    expect(() => normalizeReviewInput({ ...validInput, rating: 0 })).toThrow(/Оценка/);
    expect(() => normalizeReviewInput({ ...validInput, rating: 6 })).toThrow(/Оценка/);
    expect(() => normalizeReviewInput({ ...validInput, rating: 4.5 })).toThrow(/Оценка/);
    // числовые строки приводятся: Number('5') = 5 → валидно
    expect(normalizeReviewInput({ ...validInput, rating: '5' as never }).rating).toBe(5);
  });

  it('текст: от 10 до 600 символов', () => {
    expect(() => normalizeReviewInput({ ...validInput, text: 'коротко' })).toThrow(/Текст отзыва/);
    expect(() => normalizeReviewInput({ ...validInput, text: 'Б'.repeat(601) })).toThrow(
      /Текст отзыва/,
    );
  });

  it('ошибка — экземпляр ReviewValidationError (endpoint отдаст 400)', () => {
    expect(() => normalizeReviewInput({})).toThrow(ReviewValidationError);
  });
});

describe('approvedReviews / sortReviewsDesc / ratingSummary', () => {
  const items = [
    review({ id: '1', productId: '7', createdAt: '2026-11-03T10:00:00.000Z' }),
    review({ id: '2', productId: '7', createdAt: '2026-11-01T10:00:00.000Z', approved: false }),
    review({ id: '3', productId: '7', createdAt: '2026-11-02T10:00:00.000Z', rating: 4 }),
    review({ id: '4', productId: '9', createdAt: '2026-11-02T10:00:00.000Z' }),
  ];

  it('approvedReviews: только approved товара, свежие сверху', () => {
    const list = approvedReviews(items, '7');
    expect(list.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('productId сравнивается строкой (число/строка — одно и то же)', () => {
    expect(approvedReviews(items, 9 as never).map((r) => r.id)).toEqual(['4']);
  });

  it('ratingSummary: средняя с 1 знаком, 0 на пустом', () => {
    expect(ratingSummary(approvedReviews(items, '7'))).toEqual({ count: 2, average: 4.5 });
    expect(ratingSummary([])).toEqual({ count: 0, average: 0 });
  });

  it('sortReviewsDesc стабилен при равных createdAt (больший id выше)', () => {
    const tied = [
      review({ id: '5', createdAt: '2026-11-01T10:00:00.000Z' }),
      review({ id: '6', createdAt: '2026-11-01T10:00:00.000Z' }),
    ];
    expect(sortReviewsDesc(tied).map((r) => r.id)).toEqual(['6', '5']);
  });
});

describe('ratingsByProduct / attachRatings (рейтинг в каталоге)', () => {
  const items = [
    review({ id: '1', productId: '7', rating: 5, createdAt: '2026-11-03T10:00:00.000Z' }),
    review({ id: '2', productId: '7', rating: 4, createdAt: '2026-11-01T10:00:00.000Z' }),
    // не прошедший модерацию — в сводку не попадает
    review({ id: '3', productId: '7', rating: 1, approved: false }),
    // числовой productId — сводка по строковому ключу
    review({ id: '4', productId: 9, rating: 3 }),
    // битный рейтинг (0) считается как 0, а не выкидывается
    review({ id: '5', productId: '9', rating: 0 }),
  ];

  it('группирует только approved, средняя — с 1 знаком', () => {
    const map = ratingsByProduct(items);
    expect(map.get('7')).toEqual({ count: 2, average: 4.5 });
    // (3 + 0) / 2 = 1.5
    expect(map.get('9')).toEqual({ count: 2, average: 1.5 });
  });

  it('товар без отзывов в карте отсутствует', () => {
    expect(ratingsByProduct(items).has('42')).toBe(false);
    expect(ratingsByProduct([]).size).toBe(0);
  });

  it('attachRatings: rating есть у ВСЕХ товаров (нулевая сводка — без отзывов)', async () => {
    kvStore.set(REVIEWS_KEY, items);
    const products = [
      { id: 7, name: 'Кружка' },
      { id: '9', name: 'Тарелка' },
      { id: '42', name: 'Ложка' },
    ];
    const rated = await attachRatings(EVENT, products);
    expect(rated.map((p) => p.rating)).toEqual([
      { count: 2, average: 4.5 },
      { count: 2, average: 1.5 },
      { count: 0, average: 0 },
    ]);
    // исходные поля сохранены
    expect(rated[0].name).toBe('Кружка');
    // исходный массив не мутирован
    expect(products[0].rating).toBeUndefined();
  });
});

describe('readReviews / writeReviews / nextReviewId', () => {
  it('пустое и битое хранилище → пустой список', async () => {
    expect(await readReviews(EVENT)).toEqual([]);
    kvStore.set(REVIEWS_KEY, 'не массив');
    expect(await readReviews(EVENT)).toEqual([]);
  });

  it('мусорные элементы отфильтровываются, валидные остаются', async () => {
    kvStore.set(REVIEWS_KEY, [review({ id: '1' }), null, 'мусор']);
    const items = await readReviews(EVENT);
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('1');
  });

  it('writeReviews пишет массив ЦЕЛИКОМ, nextReviewId — max+1', async () => {
    await writeReviews(EVENT, [review({ id: '11' }), review({ id: '12' })]);
    const items = await readReviews(EVENT);
    expect(items.length).toBe(2);
    expect(nextReviewId(items)).toBe('13');
    expect(nextReviewId([])).toBe('1');
  });

  it('writeReviews не-массив кидает ошибку', async () => {
    await expect(writeReviews(EVENT, 'мусор' as never)).rejects.toThrow(/array/i);
  });
});

// ─── normalizeReviewPhotos — фото из формы отзыва ────────────────────────

const photo = (bytes: number, mime = 'webp') => {
  // base64: 4 символа → 3 байта; столько символов, чтобы вышло bytes байт
  const body = 'A'.repeat(Math.ceil((bytes * 4) / 3));
  return `data:image/${mime};base64,${body}`;
};

describe('normalizeReviewPhotos', () => {
  it('отсутствие/пустота → []', () => {
    expect(normalizeReviewPhotos(undefined)).toEqual([]);
    expect(normalizeReviewPhotos(null)).toEqual([]);
    expect(normalizeReviewPhotos([])).toEqual([]);
    expect(normalizeReviewPhotos([''])).toEqual([]); // пустые строки отбрасываются
  });

  it('валидные data-URI проходят (webp/jpeg/png), лимит 3', () => {
    const three = [photo(10), photo(10, 'jpeg'), photo(10, 'png')];
    expect(normalizeReviewPhotos(three)).toEqual(three);
    expect(MAX_REVIEW_PHOTOS).toBe(3);
  });

  it('больше лимита — ошибка', () => {
    const four = [photo(1), photo(2), photo(3), photo(4)];
    expect(() => normalizeReviewPhotos(four)).toThrow(/не более 3/);
  });

  it('не-картинка/не data-URI — ошибка с понятным текстом', () => {
    expect(() => normalizeReviewPhotos(['https://example.com/a.webp'])).toThrow(
      /webp, jpeg или png/,
    );
    expect(() => normalizeReviewPhotos([photo(10, 'gif')])).toThrow(/webp, jpeg или png/);
    expect(() => normalizeReviewPhotos(['мусор'])).toThrow(/webp, jpeg или png/);
    expect(() => normalizeReviewPhotos([42])).toThrow(/Некорректный список|webp/);
  });

  it('не-массив — ошибка', () => {
    expect(() => normalizeReviewPhotos('data:image/webp;base64,AAAA' as never)).toThrow(
      /Некорректный список/,
    );
  });

  it('фото больше MAX_REVIEW_PHOTO_BYTES — ошибка', () => {
    expect(() => normalizeReviewPhotos([photo(MAX_REVIEW_PHOTO_BYTES + 1)])).toThrow(/больш/);
    expect(normalizeReviewPhotos([photo(MAX_REVIEW_PHOTO_BYTES)])).toHaveLength(1);
  });

  it('дубликаты схлопываются', () => {
    const uri = photo(10);
    expect(normalizeReviewPhotos([uri, uri])).toEqual([uri]);
  });

  it('normalizeReviewInput прокидывает photos', () => {
    const uri = photo(10);
    expect(normalizeReviewInput({ ...validInput, photos: [uri] }).photos).toEqual([uri]);
    expect(normalizeReviewInput(validInput).photos).toEqual([]);
  });
});
