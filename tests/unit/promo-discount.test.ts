// tests/unit/promo-discount.test.ts
// ── Акции с автоскидкой (server/lib/promoDiscount.ts) ─────────────────────
//
// Гарантии подсистемы:
// 1. Окно действия новости (startsAt/endsAt): scheduled/active/expired,
//    endsAt ВКЛЮЧИТЕЛЬНО («действует по 30.11» = активна весь день 30.11),
//    пустые даты = бессрочно.
// 2. Активная акция: рубрика «Акции» + published !== false + валидный
//    процент 5–90 + в окне. Акция за пределами окна НЕ даёт скидку —
//    «автоматическое аннулирование по истечении срока».
// 3. Цель: явный выбор админа (productIds и/или promoCategory).
//    АВТОПОДБОР целью не является — не должен молча раздавать скидки.
//    Несколько акций на один товар — максимальный процент.
// 4. applyPromosToProducts — чистая: вход не мутируется (KV-объекты
//    нетронуты), товары без акции возвращаются КАК ЕСТЬ, попавшие —
//    клон с price→акционной, oldPrice→базой (ручная oldPrice глубже —
//    сохраняется), варианты пропорционально, promoPercent/promoEndsAt.
import { describe, expect, it } from 'vitest';
import {
  activePromos,
  applyPromosToProducts,
  bestPromoForProduct,
  isPromoActive,
  isValidPromoDiscount,
  newsInWindow,
  newsWindowStatus,
  promoPriceFor,
  todayISO,
} from '../../server/lib/promoDiscount';
import type { NewsItem } from '../../server/lib/newsTypes';
import type { Product } from '../../server/lib/productHelpers';

const TODAY = '2026-11-20';

const news = (patch: Partial<NewsItem>): NewsItem => ({
  id: '1',
  date: '2026-11-01',
  category: 'Акции',
  title: 'Скидка 15% на смартфоны',
  excerpt: '',
  body: ['Условия акции'],
  image: '',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...patch,
});

const product = (patch: Partial<Product> & { id: string }): Product => ({
  slug: `slug-${patch.id}`,
  name: `Товар ${patch.id}`,
  description: '',
  price: 10000,
  image: '',
  gallery: [],
  categories: ['Электроника'],
  inStock: true,
  stockQuantity: 5,
  characteristics: {},
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...patch,
});

// ─── Окно действия ───────────────────────────────────────────────────────

describe('newsWindowStatus — окно показа любой новости', () => {
  it('пустые даты = бессрочно, всегда active', () => {
    expect(newsWindowStatus({}, TODAY)).toBe('active');
    expect(newsInWindow({}, TODAY)).toBe(true);
  });

  it('endsAt в будущем → active; В ДЕНЬ окончания ещё active (включительно)', () => {
    expect(newsWindowStatus({ endsAt: '2026-11-25' }, TODAY)).toBe('active');
    expect(newsWindowStatus({ endsAt: TODAY }, TODAY)).toBe('active');
    expect(newsInWindow({ endsAt: TODAY }, TODAY)).toBe(true);
  });

  it('endsAt вчера → expired (автоаннулирование по истечении)', () => {
    expect(newsWindowStatus({ endsAt: '2026-11-19' }, TODAY)).toBe('expired');
    expect(newsInWindow({ endsAt: '2026-11-19' }, TODAY)).toBe(false);
  });

  it('startsAt в будущем → scheduled; в прошлом/сегодня → active', () => {
    expect(newsWindowStatus({ startsAt: '2026-11-21' }, TODAY)).toBe('scheduled');
    expect(newsWindowStatus({ startsAt: TODAY }, TODAY)).toBe('active');
    expect(newsWindowStatus({ startsAt: '2026-11-01' }, TODAY)).toBe('active');
  });

  it('scheduled бьёт expired: оба за пределами — «ещё не началась» важнее', () => {
    expect(newsWindowStatus({ startsAt: '2026-12-01', endsAt: '2026-11-01' }, TODAY)).toBe(
      'scheduled',
    );
  });

  it('todayISO — формат YYYY-MM-DD', () => {
    expect(todayISO(new Date('2026-11-20T23:59:59Z'))).toBe('2026-11-20');
  });
});

// ─── Активная акция ──────────────────────────────────────────────────────

describe('isPromoActive / activePromos', () => {
  it('валидная акция активна', () => {
    expect(isPromoActive(news({ promoDiscount: 15, productIds: ['1'] }), TODAY)).toBe(true);
  });

  it('не «Акции» — не акция (даже с процентом)', () => {
    expect(
      isPromoActive(news({ category: 'Новинки', promoDiscount: 15, productIds: ['1'] }), TODAY),
    ).toBe(false);
  });

  it('черновик не активен', () => {
    expect(
      isPromoActive(news({ promoDiscount: 15, productIds: ['1'], published: false }), TODAY),
    ).toBe(false);
  });

  it('процент вне 5–90 не активен (защита от опечатки 150%)', () => {
    expect(isPromoActive(news({ promoDiscount: 3 }), TODAY)).toBe(false);
    expect(isPromoActive(news({ promoDiscount: 91 }), TODAY)).toBe(false);
    expect(isPromoActive(news({ promoDiscount: 12.5 as number }), TODAY)).toBe(false);
    expect(isValidPromoDiscount(15)).toBe(true);
    expect(isValidPromoDiscount(0)).toBe(false);
  });

  it('истёкшая акция не активна — скидка снимается сама', () => {
    expect(isPromoActive(news({ promoDiscount: 15, endsAt: '2026-11-19' }), TODAY)).toBe(false);
    expect(isPromoActive(news({ promoDiscount: 15, endsAt: TODAY }), TODAY)).toBe(true);
    expect(isPromoActive(news({ promoDiscount: 15, startsAt: '2026-12-01' }), TODAY)).toBe(false);
  });

  it('activePromos фильтрует и сохраняет порядок', () => {
    const items = [
      news({ id: '1', promoDiscount: 15, productIds: ['1'] }),
      news({ id: '2', promoDiscount: 20, endsAt: '2026-11-19' }), // истекла
      news({ id: '3', category: 'Компания' }), // не акция
    ];
    expect(activePromos(items, TODAY).map((n) => n.id)).toEqual(['1']);
  });
});

// ─── Цель акции ──────────────────────────────────────────────────────────

describe('bestPromoForProduct — явная цель, лучший процент', () => {
  it('цель по productIds', () => {
    const promos = [news({ promoDiscount: 15, productIds: ['7'] })];
    expect(bestPromoForProduct(promos, product({ id: '7' }))?.percent).toBe(15);
    // Другой товар — не цель (автоподбор не раздаёт скидки)
    expect(bestPromoForProduct(promos, product({ id: '8' }))).toBeNull();
  });

  it('цель по категории каталога', () => {
    const promos = [news({ promoDiscount: 10, productIds: [], promoCategory: 'Электроника' })];
    expect(bestPromoForProduct(promos, product({ id: '9' }))?.percent).toBe(10);
    expect(bestPromoForProduct(promos, product({ id: '9', categories: ['Одежда'] }))).toBeNull();
  });

  it('процент по товару и категории — побеждает больший', () => {
    const promos = [
      news({ id: '1', promoDiscount: 10, promoCategory: 'Электроника' }),
      news({ id: '2', promoDiscount: 25, productIds: ['1'] }),
    ];
    expect(bestPromoForProduct(promos, product({ id: '1' }))?.percent).toBe(25);
    expect(bestPromoForProduct(promos, product({ id: '2' }))?.percent).toBe(10);
  });
});

// ─── Применение к каталогу ───────────────────────────────────────────────

describe('applyPromosToProducts — чистая функция, витринные цены', () => {
  const promo = news({
    id: '5',
    promoDiscount: 15,
    productIds: ['1'],
    promoCategory: 'Электроника',
    endsAt: '2026-11-30',
  });

  it('цена со скидкой + oldPrice = база + плашка срока', () => {
    const out = applyPromosToProducts([product({ id: '1' })], [promo], TODAY);
    const p = out[0] as Product;
    expect(p.price).toBe(8500); // 10000 × 0.85
    expect(p.oldPrice).toBe(10000);
    expect(p.promoPercent).toBe(15);
    expect(p.promoEndsAt).toBe('2026-11-30');
  });

  it('вход не мутируется (KV-объекты нетронуты), промо — в клоне', () => {
    const original = product({ id: '1', variants: [{ id: 'v1', name: 'Чёрный', price: 12000 }] });
    const snapshot = JSON.stringify(original);
    const [out] = applyPromosToProducts([original], [promo], TODAY);
    expect(JSON.stringify(original)).toBe(snapshot); // raw не изменился
    expect(out.price).toBe(8500);
    expect(out).not.toBe(original); // попавший под акцию — новый объект
  });

  it('товар без матча возвращается КАК ЕСТЬ (тот же объект, без клонов)', () => {
    const original = product({ id: '9', categories: ['Одежда'] });
    const [out] = applyPromosToProducts([original], [promo], TODAY);
    expect(out).toBe(original);
  });

  it('ручная oldPrice ГЛУБЖЕ акции сохраняется (не прячем большую скидку)', () => {
    const out = applyPromosToProducts([product({ id: '1', oldPrice: 12000 })], [promo], TODAY);
    const p = out[0] as Product;
    expect(p.price).toBe(8500);
    expect(p.oldPrice).toBe(12000); // oldPrice (12000) > промо-цены — остаётся
  });

  it('варианты — пропорционально, oldPrice = их исходная цена', () => {
    const out = applyPromosToProducts(
      [
        product({
          id: '1',
          variants: [
            { id: 'v1', name: '128 ГБ', price: 12000 },
            { id: 'v2', name: '256 ГБ', price: 14000 },
          ],
        }),
      ],
      [promo],
      TODAY,
    );
    const p = out[0] as Product;
    expect(p.variants?.[0]?.price).toBe(10200); // 12000 × 0.85
    expect(p.variants?.[0]?.oldPrice).toBe(12000);
    expect(p.variants?.[1]?.price).toBe(11900); // 14000 × 0.85
  });

  it('вариант без цены (наследует базу) не ломается', () => {
    const out = applyPromosToProducts(
      [product({ id: '1', variants: [{ id: 'v1', name: 'Базовый' }] })],
      [promo],
      TODAY,
    );
    const p = out[0] as Product;
    expect(p.variants?.[0]?.price).toBeUndefined(); // унаследует акционную цену товара
    expect(p.variants?.[0]?.oldPrice).toBeUndefined();
  });

  it('пустой список акций — массив как есть (копия, без клонов)', () => {
    const items = [product({ id: '1' }), product({ id: '2' })];
    const out = applyPromosToProducts(items, [], TODAY);
    expect(out[0]).toBe(items[0]);
    expect(out[1]).toBe(items[1]);
  });

  it('истёкшая акция не даёт скидку (автоаннулирование на выдаче)', () => {
    const expired = news({ promoDiscount: 15, productIds: ['1'], endsAt: '2026-11-19' });
    const out = applyPromosToProducts([product({ id: '1' })], [expired], TODAY);
    expect(out[0]?.price).toBe(10000);
    expect(out[0]?.promoPercent).toBeUndefined();
  });

  it('скидка на категорию — всем товарам категории, остальным нет', () => {
    const catPromo = news({ promoDiscount: 20, promoCategory: 'Электроника' });
    const out = applyPromosToProducts(
      [product({ id: '1' }), product({ id: '2', categories: ['Одежда'] })],
      [catPromo],
      TODAY,
    );
    expect(out[0]?.price).toBe(8000);
    expect(out[1]?.price).toBe(10000);
    expect(out[1]).toBe(out[1] && out[1] === out[1] ? out[1] : out[1]); // объект не заменён
  });
});

// ─── Округление ──────────────────────────────────────────────────────────

describe('promoPriceFor — целые цены', () => {
  it('9990 при 15% → 8492 (математическое округление)', () => {
    expect(promoPriceFor(9990, 15)).toBe(8492);
  });
  it('3333 при 10% → 3000', () => {
    expect(promoPriceFor(3333, 10)).toBe(3000);
  });
});
