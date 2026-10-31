// Тесты server/lib/newsHelpers.ts — сид/самоисцеление KV, валидация
// sanitizeNewsItem (сообщения ошибок), normalizeNewsBody, сортировка, id,
// автоподбор товаров по рубрике (autopickProductIds) и фолбэк в джойне.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV (тот же паттерн, что в product-helpers.test.ts) ────────────
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
  MAX_NEWS_PRODUCTS,
  NEWS_CATEGORIES,
  NewsValidationError,
  attachProducts,
  autopickProductIds,
  newsSeed,
  nextNewsId,
  normalizeNewsBody,
  normalizeNewsProductIds,
  readNews,
  sanitizeNewsItem,
  sortNewsDesc,
  writeNews,
} from '../../server/lib/newsHelpers';

const EVENT = {} as never;
const KEY = 'data:news';

const validPayload = {
  title: 'Тестовая новость про доставку',
  category: 'Компания',
  date: '2026-11-01',
  excerpt: 'Краткое описание',
  body: 'Первый абзац\n\nВторой абзац',
  image: '/images/products/photo-1511707171634-5f897ff02aa9.webp',
};

beforeEach(() => {
  kvStore.clear();
});

describe('readNews / writeNews', () => {
  it('пустое KV → отдаёт сид и самоисцеляется записью в KV', async () => {
    const news = await readNews(EVENT);
    expect(news).toHaveLength(newsSeed.length);
    expect(kvStore.get(KEY)).toEqual(news);
    // запись сида — best-effort, сид в KV совпадает с выданным
    expect((kvStore.get(KEY) as unknown[])[0]).toHaveProperty('title');
  });

  it('хранящиеся данные приоритетнее сида', async () => {
    const custom = [{ ...newsSeed[0], id: '1', title: 'Кастомная новость' }];
    await writeNews(EVENT, custom);
    const news = await readNews(EVENT);
    expect(news).toHaveLength(1);
    expect(news[0].title).toBe('Кастомная новость');
  });

  it('writeNews отвергает не-массив', async () => {
    await expect(writeNews(EVENT, 'мусор' as never)).rejects.toThrow('array');
  });
});

describe('normalizeNewsBody', () => {
  it('строка → абзацы по переносам, пустые отбрасываются', () => {
    expect(normalizeNewsBody('А\n\n  \nБ\n')).toEqual(['А', 'Б']);
  });

  it('массив строк тоже принимается', () => {
    expect(normalizeNewsBody(['  А ', '', 'Б'])).toEqual(['А', 'Б']);
  });

  it('пустое тело — ошибка', () => {
    expect(() => normalizeNewsBody('   ')).toThrow(NewsValidationError);
    expect(() => normalizeNewsBody([])).toThrow(NewsValidationError);
  });

  it('абзац длиннее 2000 символов — ошибка', () => {
    expect(() => normalizeNewsBody('x'.repeat(2001))).toThrow(/2000/);
  });

  it('не больше 20 абзацев', () => {
    const many = Array.from({ length: 25 }, (_, i) => `Абзац ${i}`);
    expect(normalizeNewsBody(many.join('\n'))).toHaveLength(20);
  });
});

describe('sanitizeNewsItem', () => {
  it('валидная полезная нагрузка проходит и нормализует тело', () => {
    const clean = sanitizeNewsItem(validPayload);
    expect(clean.title).toBe('Тестовая новость про доставку');
    expect(clean.body).toEqual(['Первый абзац', 'Второй абзац']);
    expect(clean.updatedAt).toBeTruthy();
  });

  it('короткий заголовок — ошибка', () => {
    expect(() => sanitizeNewsItem({ ...validPayload, title: 'Хай' })).toThrow(/Заголовок/);
  });

  it('недопустимая рубрика — ошибка с перечнем', () => {
    expect(() => sanitizeNewsItem({ ...validPayload, category: 'Слухи' })).toThrow(
      new RegExp(NEWS_CATEGORIES.join(', '))
    );
  });

  it('битая дата — ошибка формата', () => {
    expect(() => sanitizeNewsItem({ ...validPayload, date: '31.11.2026' })).toThrow(/ГГГГ-ММ-ДД/);
    expect(() => sanitizeNewsItem({ ...validPayload, date: '2026-13-99' })).toThrow(/ГГГГ-ММ-ДД/);
  });

  it('пустое изображение допустимо, мусорное — нет', () => {
    expect(sanitizeNewsItem({ ...validPayload, image: '' }).image).toBe('');
    expect(() => sanitizeNewsItem({ ...validPayload, image: 'javascript:alert(1)' })).toThrow(
      /Изображение/
    );
    expect(sanitizeNewsItem({ ...validPayload, image: 'https://cdn.example.ru/x.webp' }).image).toBe(
      'https://cdn.example.ru/x.webp'
    );
  });

  it('excerpt длиннее 220 символов — ошибка', () => {
    expect(() => sanitizeNewsItem({ ...validPayload, excerpt: 'э'.repeat(221) })).toThrow(/220/);
  });

  it('productIds нормализуются мягко: без ошибок, дубли/пустые долой', () => {
    const clean = sanitizeNewsItem({
      ...validPayload,
      productIds: [' 3 ', '', '3', 5, null, '  4'],
    });
    expect(clean.productIds).toEqual(['3', '5', '4']);
  });

  it('productIds не массив → пустой список', () => {
    expect(sanitizeNewsItem({ ...validPayload, productIds: 'abc' }).productIds).toEqual([]);
    expect(sanitizeNewsItem(validPayload).productIds).toEqual([]);
  });
});

describe('normalizeNewsProductIds', () => {
  it('тримминг, пустые и дубли отбрасываются', () => {
    expect(normalizeNewsProductIds([' 2 ', '2', '', '1'])).toEqual(['2', '1']);
  });

  it('не больше MAX_NEWS_PRODUCTS, лишнее молча срезается', () => {
    const many = Array.from({ length: 10 }, (_, i) => String(i + 1));
    const out = normalizeNewsProductIds(many);
    expect(out).toHaveLength(MAX_NEWS_PRODUCTS);
    expect(out).toEqual(many.slice(0, MAX_NEWS_PRODUCTS));
  });

  it('не массив и null-элементы безопасны', () => {
    expect(normalizeNewsProductIds('nope')).toEqual([]);
    expect(normalizeNewsProductIds([null, undefined, '7'])).toEqual(['7']);
  });
});

describe('autopickProductIds — автоподбор по рубрике', () => {
  const pool = [
    { id: '1', price: 79990, inStock: true, stockQuantity: 15, gallery: ['a', 'b', 'c', 'd'] },
    { id: '2', price: 249990, inStock: false, stockQuantity: 8, gallery: ['a', 'b', 'c', 'd'] },
    { id: '3', price: 29990, inStock: true, stockQuantity: 25, gallery: ['a', 'b', 'c', 'd'] },
    { id: '4', price: 189990, inStock: false, stockQuantity: 0, gallery: ['a', 'b', 'c'] },
    { id: '5', price: 45990, inStock: true, stockQuantity: 12, gallery: ['a', 'b'] },
    { id: '6', price: 69990, inStock: true, stockQuantity: 5, gallery: ['a', 'b', 'c', 'd'] },
    { id: '7', price: 4990, inStock: true, stockQuantity: 30, gallery: ['a', 'b', 'c', 'd'] },
    { id: '8', price: 12990, inStock: true, stockQuantity: 18, gallery: ['a', 'b', 'c', 'd'] },
    { id: '9', price: 1990, inStock: true, stockQuantity: 45, gallery: ['a', 'b', 'c', 'd'] },
  ];

  it('Акции → в наличии, от самого доступного', () => {
    expect(autopickProductIds('Акции', pool)).toEqual(['9', '7', '8', '3', '5', '6']);
  });

  it('Новинки → свежие добавления каталога (id desc)', () => {
    expect(autopickProductIds('Новинки', pool)).toEqual(['9', '8', '7', '6', '5', '4']);
  });

  it('Обзоры → подробные карточки (галерея desc), при равенстве id desc', () => {
    expect(autopickProductIds('Обзоры', pool)).toEqual(['9', '8', '7', '6', '3', '2']);
  });

  it('Компания → хиты склада (запас desc), при равенстве id asc', () => {
    expect(autopickProductIds('Компания', pool)).toEqual(['9', '7', '3', '8', '1', '5']);
  });

  it('тай-брейки: равный запас → меньший id (Компания), равная галерея → больший id (Обзоры)', () => {
    const tie = [
      { id: '10', price: 100, inStock: true, stockQuantity: 5, gallery: ['a'] },
      { id: '11', price: 100, inStock: true, stockQuantity: 5, gallery: ['a'] },
    ];
    expect(autopickProductIds('Компания', tie)).toEqual(['10', '11']);
    expect(autopickProductIds('Обзоры', tie)).toEqual(['11', '10']);
  });

  it('неизвестная рубрика → пусто, пустой каталог → пусто', () => {
    expect(autopickProductIds('Слухи', pool)).toEqual([]);
    expect(autopickProductIds('Акции', [])).toEqual([]);
  });

  it('лимит MAX_NEWS_PRODUCTS', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      price: 100,
      inStock: true,
      stockQuantity: 1,
      gallery: [],
    }));
    expect(autopickProductIds('Новинки', many)).toHaveLength(MAX_NEWS_PRODUCTS);
  });

  it('не мутирует каталог', () => {
    const copy = structuredClone(pool);
    autopickProductIds('Обзоры', pool);
    autopickProductIds('Компания', pool);
    expect(pool).toEqual(copy);
  });
});

describe('attachProducts (перелинковка с каталогом)', () => {
  const products = [
    { id: '1', slug: 'samsung', name: 'Samsung S23', price: 79990, image: '/i/1.webp', inStock: true },
    { id: '2', slug: 'macbook', name: 'MacBook Pro 16', price: 249990, image: '/i/2.webp', inStock: false },
  ];

  it('порядок productIds сохраняется, поля — мини-карточка NewsProductCard', () => {
    const [item] = attachProducts(
      [{ ...newsSeed[0], id: '1', productIds: ['2', '1'] }],
      products,
    );
    expect(item.products.map((p) => p.id)).toEqual(['2', '1']);
    expect(item.products[0]).toEqual({
      id: '2',
      slug: 'macbook',
      name: 'MacBook Pro 16',
      price: 249990,
      image: '/i/2.webp',
      inStock: false,
    });
  });

  it('несуществующие/удалённые id пропускаются', () => {
    const [a] = attachProducts([{ ...newsSeed[0], id: '1', productIds: ['99', '1'] }], products);
    expect(a.products.map((p) => p.id)).toEqual(['1']);
  });

  it('пустой productIds → автоподбор по рубрике новости', () => {
    // newsSeed[0] — «Акции»: Samsung в наличии, MacBook нет; правило
    // «в наличии от доступного» оставляет единственного кандидата Samsung
    const [b] = attachProducts([{ ...newsSeed[0], id: '1', productIds: [] }], products);
    expect(b.products.map((p) => p.id)).toEqual(['1']);
    // сохранённые productIds в ответе не подменяются
    expect(b.productIds).toEqual([]);
  });

  it('ручной выбор приоритетнее автоподбора', () => {
    const [c] = attachProducts([{ ...newsSeed[0], id: '1', productIds: ['2'] }], products);
    expect(c.products.map((p) => p.id)).toEqual(['2']);
  });

  it('не мутирует новость и каталог', () => {
    const item = { ...newsSeed[0], id: '1', productIds: ['1'] };
    const itemCopy = { ...item };
    const out = attachProducts([item], products);
    expect(item).toEqual(itemCopy);
    expect(out[0].products).toHaveLength(1);
  });
});

describe('sortNewsDesc / nextNewsId', () => {
  const items = [
    { id: '1', date: '2026-10-01' },
    { id: '2', date: '2026-10-28' },
    { id: '3', date: '2026-10-01' },
  ];

  it('свежие сверху, при равных датах больший id первым', () => {
    expect(sortNewsDesc(items).map((n) => n.id)).toEqual(['2', '3', '1']);
  });

  it('не мутирует вход', () => {
    const copy = [...items];
    sortNewsDesc(items);
    expect(items).toEqual(copy);
  });

  it('nextNewsId: max+1, на пустом — «1»', () => {
    expect(nextNewsId(items)).toBe('4');
    expect(nextNewsId([])).toBe('1');
    expect(nextNewsId([{ id: '41', date: '2026-01-01' }])).toBe('42');
  });
});
