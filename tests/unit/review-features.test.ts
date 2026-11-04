// Тесты «полезно» и ответа магазина на отзыве (server/lib/reviewHelpers):
// toggleHelpful (добавление/снятие/лимит/пустой id), normalizeShopReplyText
// (тримминг, лимиты, пустая строка = удалить), applyShopReply (set/update/
// delete), publicReviewView (helpfulBy не утекает, helpfulCount + likedByMe).
// Файл самодостаточный: свой мок KV — не зависит от других тест-файлов.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV (тот же паттерн, что в review-helpers.test.ts) ───────────────
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
  MAX_HELPFUL_MARKS,
  ReviewValidationError,
  applyShopReply,
  helpfulCountOf,
  normalizeShopReplyText,
  publicReviewView,
  toggleHelpful,
  type ReviewItem,
} from '../../server/lib/reviewHelpers';

const review = (overrides: Partial<ReviewItem> = {}): ReviewItem => ({
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

describe('toggleHelpful', () => {
  it('первый клик добавляет отметку и возвращает added', () => {
    const r = review();
    expect(toggleHelpful(r, 'u1')).toBe('added');
    expect(r.helpfulBy).toEqual(['u1']);
    expect(helpfulCountOf(r)).toBe(1);
  });

  it('повторный клик снимает отметку (removed)', () => {
    const r = review({ helpfulBy: ['u1', 'u2'] });
    expect(toggleHelpful(r, 'u1')).toBe('removed');
    expect(r.helpfulBy).toEqual(['u2']);
  });

  it('несколько пользователей считаются независимо', () => {
    const r = review();
    toggleHelpful(r, 'u1');
    toggleHelpful(r, 'u2');
    toggleHelpful(r, 'u3');
    expect(helpfulCountOf(r)).toBe(3);
    toggleHelpful(r, 'u2');
    expect(helpfulCountOf(r)).toBe(2);
  });

  it('пустой userId запрещён', () => {
    const r = review();
    expect(() => toggleHelpful(r, '')).toThrow(ReviewValidationError);
    expect(() => toggleHelpful(r, '   ')).toThrow(ReviewValidationError);
    expect(r.helpfulBy).toBeUndefined();
  });

  it('лимит MAX_HELPFUL_MARKS защищает KV-запись от раздутия', () => {
    const marks = Array.from({ length: MAX_HELPFUL_MARKS }, (_, i) => `u${i}`);
    const r = review({ helpfulBy: marks });
    expect(() => toggleHelpful(r, 'new-user')).toThrow(ReviewValidationError);
  });

  it('старый отзыв без helpfulBy считается с нулём отметок', () => {
    const r = review();
    expect(helpfulCountOf(r)).toBe(0);
    expect(toggleHelpful(r, 'u1')).toBe('added');
  });
});

describe('normalizeShopReplyText', () => {
  it('триммит и пропускает корректный текст', () => {
    expect(normalizeShopReplyText('  Спасибо за отзыв!  ')).toBe('Спасибо за отзыв!');
  });

  it('пустая/пробельная строка = «удалить ответ» (без ошибки)', () => {
    expect(normalizeShopReplyText('')).toBe('');
    expect(normalizeShopReplyText('   ')).toBe('');
    expect(normalizeShopReplyText(null)).toBe('');
    expect(normalizeShopReplyText(undefined)).toBe('');
  });

  it('не-строка трактуется как пустая (удаление), а не как 400', () => {
    expect(normalizeShopReplyText(42)).toBe('');
  });

  it('слишком короткий/длинный текст — ошибка валидации', () => {
    expect(() => normalizeShopReplyText('О')).toThrow(/Ответ магазина/);
    expect(() => normalizeShopReplyText('А'.repeat(601))).toThrow(/Ответ магазина/);
  });
});

describe('applyShopReply', () => {
  it('ставит ответ с серверным временем', () => {
    const r = review();
    const now = new Date('2026-11-05T12:00:00.000Z');
    applyShopReply(r, 'Благодарим за обратную связь!', now);
    expect(r.shopReply).toEqual({
      text: 'Благодарим за обратную связь!',
      at: '2026-11-05T12:00:00.000Z',
    });
  });

  it('повторный вызов обновляет текст и дату', () => {
    const r = review();
    applyShopReply(r, 'Первый ответ', new Date('2026-11-05T12:00:00.000Z'));
    applyShopReply(r, 'Обновлённый ответ', new Date('2026-11-06T12:00:00.000Z'));
    expect(r.shopReply?.text).toBe('Обновлённый ответ');
    expect(r.shopReply?.at).toBe('2026-11-06T12:00:00.000Z');
  });

  it('пустой текст удаляет существующий ответ (delete, не пустая строка)', () => {
    const r = review({ shopReply: { text: 'Ответ', at: '2026-11-05T12:00:00.000Z' } });
    applyShopReply(r, '');
    expect(r.shopReply).toBeUndefined();
  });
});

describe('publicReviewView', () => {
  it('helpfulBy не утекает наружу, отдаются счётчик и likedByMe', () => {
    const r = review({
      helpfulBy: ['u1', 'u2'],
      shopReply: { text: 'Ответ', at: '2026-11-05T12:00:00.000Z' },
    });
    const view = publicReviewView(r, 'u1');
    expect('helpfulBy' in view).toBe(false);
    expect(view.helpfulCount).toBe(2);
    expect(view.likedByMe).toBe(true);
    expect(view.shopReply).toEqual({ text: 'Ответ', at: '2026-11-05T12:00:00.000Z' });
    // Остальные поля сохранены
    expect(view.author).toBe('Иван');
    expect(view.rating).toBe(5);
  });

  it('гость (userId null) всегда видит likedByMe=false', () => {
    const r = review({ helpfulBy: ['u1'] });
    const view = publicReviewView(r, null);
    expect(view.likedByMe).toBe(false);
    expect(view.helpfulCount).toBe(1);
  });

  it('отзыв без отметок: счётчик 0, likedByMe false', () => {
    const view = publicReviewView(review());
    expect(view.helpfulCount).toBe(0);
    expect(view.likedByMe).toBe(false);
  });
});
