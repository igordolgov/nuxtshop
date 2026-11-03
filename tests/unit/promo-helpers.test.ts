// Тесты server/lib/promoHelpers.ts — валидация админского ввода,
// применимость, расчёт скидки. Чистые функции — без KV.
import { describe, expect, it } from 'vitest';

import {
  calcDiscount,
  findPromoByCode,
  isPromoUsable,
  nextPromoId,
  normalizePromoInput,
  PromoValidationError,
  promoIssue,
  promoValueLabel,
  sortPromosDesc,
  type PromoCode,
} from '../../server/lib/promoHelpers';

/** Фикстура: действующий процентный промокод */
function makePromo(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: '1',
    code: 'SUMMER15',
    type: 'percent',
    value: 15,
    active: true,
    expiresAt: null,
    usageLimit: null,
    usedCount: 0,
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── normalizePromoInput ─────────────────────────────────────────────────

describe('normalizePromoInput — код', () => {
  it('trim + uppercase; допустимые символы', () => {
    const promo = normalizePromoInput({ code: ' summer15 ', type: 'percent', value: 15 });
    expect(promo.code).toBe('SUMMER15');
  });

  it('кириллица, пробелы, спецсимволы, слишком короткий/длинный — 400-ошибка', () => {
    for (const bad of ['СКИДКА', 'SALE 10', 'SALE_10', 'A', 'X'.repeat(33), '']) {
      expect(() => normalizePromoInput({ code: bad, type: 'percent', value: 10 })).toThrow(
        PromoValidationError,
      );
    }
  });

  it('дефисы и цифры допустимы', () => {
    const promo = normalizePromoInput({ code: 'BLACK-FRIDAY-2026', type: 'percent', value: 20 });
    expect(promo.code).toBe('BLACK-FRIDAY-2026');
  });
});

describe('normalizePromoInput — скидка и тип', () => {
  it('percent: целое 1–90', () => {
    expect(normalizePromoInput({ code: 'A1', type: 'percent', value: 1 }).value).toBe(1);
    expect(normalizePromoInput({ code: 'A1', type: 'percent', value: 90 }).value).toBe(90);
    for (const bad of [0, 91, 15.5, 'много', NaN]) {
      expect(() =>
        normalizePromoInput({ code: 'A1', type: 'percent', value: bad as never }),
      ).toThrow(PromoValidationError);
    }
  });

  it('fixed: целое 1–10 000 000', () => {
    expect(normalizePromoInput({ code: 'A1', type: 'fixed', value: 500 }).value).toBe(500);
    expect(() => normalizePromoInput({ code: 'A1', type: 'fixed', value: 10_000_001 })).toThrow(
      PromoValidationError,
    );
  });

  it('неизвестный тип — ошибка', () => {
    expect(() => normalizePromoInput({ code: 'A1', type: 'рубли', value: 10 })).toThrow(
      PromoValidationError,
    );
  });
});

describe('normalizePromoInput — сроки, лимиты, прочее', () => {
  it('дата YYYY-MM-DD трактуется как конец этого дня', () => {
    const promo = normalizePromoInput({
      code: 'A1',
      type: 'percent',
      value: 10,
      expiresAt: '2026-12-31',
    });
    expect(promo.expiresAt).toBe('2026-12-31T23:59:59.999Z');
  });

  it('полный ISO и null/пустое — допустимы; мусор — ошибка', () => {
    const iso = normalizePromoInput({
      code: 'A1',
      type: 'percent',
      value: 10,
      expiresAt: '2026-12-31T10:00:00Z',
    });
    expect(iso.expiresAt).toBe('2026-12-31T10:00:00.000Z');
    expect(normalizePromoInput({ code: 'A1', type: 'percent', value: 10 }).expiresAt).toBeNull();
    expect(
      normalizePromoInput({ code: 'A1', type: 'percent', value: 10, expiresAt: '' }).expiresAt,
    ).toBeNull();
    expect(() =>
      normalizePromoInput({ code: 'A1', type: 'percent', value: 10, expiresAt: 'вчера' }),
    ).toThrow(PromoValidationError);
  });

  it('usageLimit: пусто → null; мусор — ошибка', () => {
    const promo = normalizePromoInput({ code: 'A1', type: 'percent', value: 10, usageLimit: '' });
    expect(promo.usageLimit).toBeNull();
    expect(
      normalizePromoInput({ code: 'A1', type: 'percent', value: 10, usageLimit: 100 }).usageLimit,
    ).toBe(100);
    expect(() =>
      normalizePromoInput({ code: 'A1', type: 'percent', value: 10, usageLimit: 0 }),
    ).toThrow(PromoValidationError);
  });

  it('описание обрезается до 200; active по умолчанию true', () => {
    const promo = normalizePromoInput({
      code: 'A1',
      type: 'percent',
      value: 10,
      description: 'x'.repeat(300),
    });
    expect(promo.description).toHaveLength(200);
    expect(promo.active).toBe(true);
  });

  it('при редактировании active=true сохраняется, если не передан', () => {
    const promo = normalizePromoInput(
      { code: 'A1', type: 'percent', value: 10 },
      makePromo({ active: true }),
    );
    expect(promo.active).toBe(true);
  });
});

// ─── Поиск / применимость ────────────────────────────────────────────────

describe('findPromoByCode', () => {
  it('регистронезависимый поиск', () => {
    const promo = findPromoByCode([makePromo()], 'summer15');
    expect(promo?.id).toBe('1');
    expect(findPromoByCode([makePromo()], 'SUMMER15')?.id).toBe('1');
  });

  it('не найден / пустой ввод → null', () => {
    expect(findPromoByCode([makePromo()], 'NOPE')).toBeNull();
    expect(findPromoByCode([makePromo()], '')).toBeNull();
    expect(findPromoByCode([], 'SUMMER15')).toBeNull();
  });
});

describe('promoIssue / isPromoUsable', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('действующий → null', () => {
    expect(promoIssue(makePromo(), now)).toBeNull();
    expect(isPromoUsable(makePromo(), now)).toBe(true);
  });

  it('выключенный → inactive', () => {
    expect(promoIssue(makePromo({ active: false }), now)).toBe('inactive');
  });

  it('истёкший → expired; момент окончания включительно ещё действует', () => {
    expect(promoIssue(makePromo({ expiresAt: '2026-06-15T11:59:59.999Z' }), now)).toBe('expired');
    // Ровно в момент expiresAt — ещё действует (граница включена)
    expect(isPromoUsable(makePromo({ expiresAt: '2026-06-15T12:00:00.000Z' }), now)).toBe(true);
  });

  it('лимит исчерпан → limit', () => {
    expect(promoIssue(makePromo({ usageLimit: 2, usedCount: 2 }), now)).toBe('limit');
    expect(isPromoUsable(makePromo({ usageLimit: 2, usedCount: 1 }), now)).toBe(true);
  });
});

// ─── Расчёт скидки ───────────────────────────────────────────────────────

describe('calcDiscount', () => {
  it('percent с округлением до рубля', () => {
    expect(calcDiscount({ type: 'percent', value: 10 }, 999)).toBe(100); // 99.9 → 100
    expect(calcDiscount({ type: 'percent', value: 15 }, 1000)).toBe(150);
    expect(calcDiscount({ type: 'percent', value: 33 }, 100)).toBe(33);
  });

  it('fixed не превышает сумму корзины', () => {
    expect(calcDiscount({ type: 'fixed', value: 500 }, 1000)).toBe(500);
    expect(calcDiscount({ type: 'fixed', value: 500 }, 300)).toBe(300); // кап
  });

  it('нулевой/отрицательный/битый subtotal → 0', () => {
    expect(calcDiscount({ type: 'percent', value: 10 }, 0)).toBe(0);
    expect(calcDiscount({ type: 'percent', value: 10 }, -5)).toBe(0);
    expect(calcDiscount({ type: 'percent', value: 10 }, NaN)).toBe(0);
  });
});

// ─── Прочее ──────────────────────────────────────────────────────────────

describe('sortPromosDesc / nextPromoId / promoValueLabel', () => {
  it('свежие сверху, при равной дате — больший id', () => {
    const sorted = sortPromosDesc([
      makePromo({ id: '1', createdAt: '2026-01-01T00:00:00.000Z' }),
      makePromo({ id: '3', createdAt: '2026-03-01T00:00:00.000Z' }),
      makePromo({ id: '2', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['3', '2', '1']);
  });

  it('nextPromoId продолжает нумерацию', () => {
    expect(nextPromoId([])).toBe('1');
    expect(nextPromoId([makePromo({ id: '7' })])).toBe('8');
  });

  it('человекочитаемое значение скидки', () => {
    expect(promoValueLabel({ type: 'percent', value: 15 })).toBe('15%');
    expect(promoValueLabel({ type: 'fixed', value: 500 })).toBe('500 ₽');
  });
});
