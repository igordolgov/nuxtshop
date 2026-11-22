// Тесты server/lib/promoHelpers.ts — валидация админского ввода,
// применимость, расчёт скидки. Чистые функции — без KV.
import { describe, expect, it } from 'vitest';

// Символ валюты для фиксированных промокодов — из конфига витрины
import { formatMoney } from '../../store.config';

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
    startsAt: null,
    minSubtotal: null,
    usageLimit: null,
    usageLimitPerUser: null,
    usedCount: 0,
    usedByUsers: {},
    stackableWithPromos: true,
    productIds: null,
    category: null,
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
    // Валюта — из конфига витрины (₽ на main, $ на кубинской копии)
    expect(promoValueLabel({ type: 'fixed', value: 500 })).toBe(formatMoney(500));
  });
});

// ─── evaluatePromo: окно, лимиты на покупателя, порог, цели, акции ───────

import {
  evaluatePromo,
  promoIssueForUser,
  promoLineMatches,
  promoUserCount,
  promoUserKey,
  type PromoCartLine,
} from '../../server/lib/promoHelpers';

const NOW = new Date('2026-11-15T12:00:00.000Z');

/** Строка корзины: товар за 1000, без акции. */
const line = (overrides: Partial<PromoCartLine> = {}): PromoCartLine => ({
  productId: '1',
  quantity: 1,
  price: 1000,
  category: 'Электроника',
  ...overrides,
});

const ctx = (overrides: Partial<Parameters<typeof evaluatePromo>[1]> = {}) => ({
  lines: [line()],
  subtotal: 1000,
  now: NOW,
  ...overrides,
});

describe('evaluatePromo — окно действия (с…по)', () => {
  it('промокод ещё не начался → scheduled', () => {
    const promo = makePromo({ startsAt: '2026-11-16T00:00:00.000Z' });
    expect(evaluatePromo(promo, ctx())).toEqual({ ok: false, reason: 'scheduled' });
  });

  it('в день старта (начало суток) уже действует', () => {
    const promo = makePromo({ startsAt: '2026-11-15T00:00:00.000Z' });
    expect(evaluatePromo(promo, ctx())).toMatchObject({ ok: true });
  });

  it('истёкший промокод: expired до расчёта скидки', () => {
    const promo = makePromo({ expiresAt: '2026-11-14T23:59:59.999Z' });
    expect(evaluatePromo(promo, ctx())).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('evaluatePromo — лимит на покупателя', () => {
  const u1 = promoUserKey('user-1');
  const u2 = promoUserKey('user-2');

  it('ключ покупателя: userId приоритетнее email, email → lowercase', () => {
    expect(promoUserKey('user-1', 'a@b.c')).toBe('u:user-1');
    expect(promoUserKey(null, ' A@B.C ')).toBe('e:a@b.c');
    expect(promoUserKey(null, null)).toBeNull();
  });

  it('usageLimitPerUser=1: повторное применение этому покупателю — user_limit', () => {
    const promo = makePromo({
      usageLimitPerUser: 1,
      usedByUsers: { [u1]: 1 },
    });
    expect(promoIssueForUser(promo, u1, NOW)).toBe('user_limit');
    expect(evaluatePromo(promo, ctx({ userKey: u1 }))).toEqual({
      ok: false,
      reason: 'user_limit',
    });
    // другой покупатель — свободно
    expect(evaluatePromo(promo, ctx({ userKey: u2 }))).toMatchObject({ ok: true });
  });

  it('учёт по email работает отдельно от userId', () => {
    const promo = makePromo({
      usageLimitPerUser: 1,
      usedByUsers: { 'e:guest@test.io': 1 },
    });
    expect(evaluatePromo(promo, ctx({ userKey: 'e:guest@test.io' }))).toEqual({
      ok: false,
      reason: 'user_limit',
    });
    expect(promoUserCount(promo, 'e:other@test.io')).toBe(0);
  });

  it('без userKey (гость в превью) per-user лимит не блокирует', () => {
    const promo = makePromo({ usageLimitPerUser: 1, usedByUsers: { 'u:user-1': 2 } });
    expect(evaluatePromo(promo, ctx({ userKey: null }))).toMatchObject({ ok: true });
  });
});

describe('evaluatePromo — порог минимальной суммы', () => {
  it('корзина ниже порога → min_subtotal (порог от ПОЛНОЙ суммы)', () => {
    const promo = makePromo({ minSubtotal: 1500 });
    expect(evaluatePromo(promo, ctx({ subtotal: 1000 }))).toEqual({
      ok: false,
      reason: 'min_subtotal',
    });
    expect(evaluatePromo(promo, ctx({ subtotal: 1500 }))).toMatchObject({
      ok: true,
      discount: 150,
    });
  });
});

describe('evaluatePromo — цели: товары и категория', () => {
  it('цель-товары: матчится по id, нецелевые товары не дают скидки', () => {
    const promo = makePromo({ productIds: ['2'] });
    const lines = [line({ productId: '1', price: 1000 }), line({ productId: '2', price: 500 })];
    expect(evaluatePromo(promo, ctx({ lines, subtotal: 1500 }))).toMatchObject({
      ok: true,
      base: 500,
      discount: 75,
    });
  });

  it('цель-категория: матчится по первой категории товара', () => {
    const promo = makePromo({ category: 'Электроника' });
    const lines = [
      line({ productId: '1', price: 800, category: 'Электроника' }),
      line({ productId: '3', price: 200, category: 'Одежда' }),
    ];
    expect(evaluatePromo(promo, ctx({ lines, subtotal: 1000 }))).toMatchObject({
      ok: true,
      base: 800,
      discount: 120,
    });
  });

  it('цель задана, но в корзине её нет → no_targets', () => {
    const promo = makePromo({ productIds: ['99'] });
    expect(evaluatePromo(promo, ctx())).toEqual({ ok: false, reason: 'no_targets' });
  });

  it('promoLineMatches: без целей весь заказ', () => {
    expect(promoLineMatches(makePromo(), line())).toBe(true);
    expect(promoLineMatches(makePromo({ productIds: ['1'] }), line())).toBe(true);
    expect(promoLineMatches(makePromo({ productIds: ['1'] }), line({ productId: '9' }))).toBe(
      false,
    );
  });
});

describe('evaluatePromo — суммирование с акциями (построчное)', () => {
  it('обе стороны разрешили: скидка от акционной цены', () => {
    const promo = makePromo({ value: 10 });
    const lines = [line({ price: 900, promoPercent: 10, promoAllowsPromocodes: true })];
    expect(evaluatePromo(promo, ctx({ lines, subtotal: 900 }))).toMatchObject({
      ok: true,
      base: 900,
      discount: 90,
    });
  });

  it('промокод запретил суммирование: считается по не-акционной части', () => {
    const promo = makePromo({ value: 10, stackableWithPromos: false });
    const lines = [
      line({ productId: '1', price: 900, promoPercent: 10, promoAllowsPromocodes: true }),
      line({ productId: '2', price: 300 }),
    ];
    expect(evaluatePromo(promo, ctx({ lines, subtotal: 1200 }))).toMatchObject({
      ok: true,
      base: 300,
      discount: 30,
    });
  });

  it('акция запретила промокоды (allowPromocodes=false): та же строка вне базы', () => {
    const promo = makePromo({ value: 10, stackableWithPromos: true });
    const lines = [line({ price: 900, promoPercent: 10, promoAllowsPromocodes: false })];
    expect(evaluatePromo(promo, ctx({ lines, subtotal: 900 }))).toEqual({
      ok: false,
      reason: 'promo_overlap',
    });
  });

  it('запрет действует построчно: другая акция с разрешением — в базе', () => {
    const promo = makePromo({ value: 10 });
    const lines = [
      line({ productId: '1', price: 900, promoPercent: 10, promoAllowsPromocodes: false }),
      line({ productId: '2', price: 200, promoPercent: 25, promoAllowsPromocodes: true }),
    ];
    expect(evaluatePromo(promo, ctx({ lines, subtotal: 1100 }))).toMatchObject({
      ok: true,
      base: 200,
      discount: 20,
    });
  });

  it('fixed не превышает базу после отсечения акционных строк', () => {
    const promo = makePromo({ type: 'fixed', value: 5000, stackableWithPromos: false });
    const lines = [line({ price: 900, promoPercent: 10, promoAllowsPromocodes: true })];
    expect(evaluatePromo(promo, ctx({ lines, subtotal: 900 }))).toEqual({
      ok: false,
      reason: 'promo_overlap',
    });
  });

  it('пустая корзина → no_targets (не «скидка 0»)', () => {
    expect(evaluatePromo(makePromo(), ctx({ lines: [], subtotal: 0 }))).toEqual({
      ok: false,
      reason: 'no_targets',
    });
  });
});
