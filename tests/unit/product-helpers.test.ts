// Тесты server/lib/productHelpers.ts — slugify, уникальные слаги,
// чтение каталога напрямую из KV (без TTL-кеша), поиск по slug/id, похожие товары.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV (тот же паттерн, что в order-helpers.test.ts) ───────────
// kvGetJSON отдаёт structuredClone хранимого значения: реальный Workers KV
// каждый раз парсит JSON-строку заново, то есть каждое чтение возвращает
// НОВЫЕ объекты. Мок повторяет это поведение — тесты на мутации честные.
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
  generateUniqueSlug,
  getProductBySlug,
  getSimilarProducts,
  normalizeCategories,
  readProducts,
  slugify,
  writeProducts,
  type Product,
} from '../../server/lib/productHelpers';

const event = {} as never;

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    slug: 'tovar',
    name: 'Товар',
    description: '',
    price: 100,
    image: '/images/a.png',
    gallery: [],
    categories: ['cat1'],
    inStock: true,
    stockQuantity: 3,
    characteristics: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

let catalog: Product[];

beforeEach(() => {
  kvStore.clear();
  catalog = [
    makeProduct({ id: '1', slug: 'kruzhka', name: 'Кружка', categories: ['посуда'] }),
    makeProduct({ id: '2', slug: 'kastryulya', name: 'Кастрюля', categories: ['посуда'] }),
    makeProduct({ id: '3', slug: 'noski', name: 'Носки', categories: ['одежда'] }),
  ];
  kvStore.set('data:products', structuredClone(catalog));
});

describe('slugify — транслитерация', () => {
  it('кириллица транслитерируется, мусор вырезается, дефисы схлопываются', () => {
    expect(slugify('Ёж Жили-У Щуки!')).toBe('yozh-zhili-u-schuki');
  });

  it('регистр не важен', () => {
    expect(slugify('КРУЖКА')).toBe('kruzhka');
  });

  it('пустая строка — fallback product-<timestamp>', () => {
    expect(slugify('')).toMatch(/^product-\d+$/);
  });

  it('строка только из спецсимволов — fallback product-<timestamp>', () => {
    expect(slugify('!!! @@@ ###')).toMatch(/^product-\d+$/);
  });

  it('буква ё → yo, щ → sch, ц → ts', () => {
    expect(slugify('Ёлка-Щука-Цапля')).toBe('yolka-schuka-tsaplya');
  });
});

describe('generateUniqueSlug', () => {
  it('свободный слаг возвращается как есть', () => {
    expect(generateUniqueSlug('svobodnyy', catalog)).toBe('svobodnyy');
  });

  it('занятый слаг получает суффикс -1', () => {
    expect(generateUniqueSlug('kruzhka', catalog)).toBe('kruzhka-1');
  });

  it('заняты tovar и tovar-1 — берётся tovar-2', () => {
    const taken = [makeProduct({ id: '1', slug: 'tovar' }), makeProduct({ id: '2', slug: 'tovar-1' })];
    expect(generateUniqueSlug('tovar', taken)).toBe('tovar-2');
  });

  it('excludeId исключает собственный слаг из проверки', () => {
    expect(generateUniqueSlug('kruzhka', catalog, '1')).toBe('kruzhka');
  });
});

describe('readProducts / writeProducts — сид каталога', () => {
  it('пустое KV — сид заливается из products.json и возвращается', async () => {
    kvStore.clear();
    const products = await readProducts(event);
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    // Сид закрепился в KV — второй вызов уже читает из него
    expect(kvStore.has('data:products')).toBe(true);
    const second = await readProducts(event);
    expect(second).toEqual(products);
  });

  it('написанный каталог читается обратно', async () => {
    const custom = [makeProduct({ id: '42', slug: 'custom', name: 'Свой товар' })];
    await writeProducts(event, custom);
    expect(await readProducts(event)).toEqual(custom);
  });

  it('writeProducts отклоняет не-массив', async () => {
    await expect(writeProducts(event, null as never)).rejects.toThrow(/array/i);
  });
});

// TTL-кеш изолята удалён: readProducts всегда читает KV напрямую.
// Причина — разные изоляты Workers (вебхук/витрина/админка) держали свои
// копии каталога, и writeProducts одного изолята затирал списание склада,
// сделанное другим. Тесты ниже фиксируют новое поведение: видно всё сразу.
describe('readProducts — прямое чтение KV (TTL-кеш удалён)', () => {
  it('правка KV между вызовами видна сразу — кеша нет', async () => {
    const first = await readProducts(event);
    expect(first.some((p) => p.id === '50')).toBe(false);
    // Пишем в «KV» напрямую, мимо writeProducts — readProducts обязан это увидеть
    kvStore.set('data:products', [makeProduct({ id: '50', slug: 'tolko-v-kv' })]);
    const second = await readProducts(event);
    expect(second.some((p) => p.id === '50')).toBe(true);
    expect(second).toHaveLength(1);
  });

  it('мутация возвращённого массива не влияет на следующие чтения (каждое чтение — свежая копия)', async () => {
    const first = await readProducts(event);
    const ids = first.map((p) => p.id);
    first.length = 0; // «испортили» свою копию
    const second = await readProducts(event);
    expect(second.map((p) => p.id)).toEqual(ids);
  });

  it('writeProducts — следующее чтение видит новую запись', async () => {
    const base = await readProducts(event);
    await writeProducts(event, [...base, makeProduct({ id: '77', slug: 'novyy' })]);
    const fresh = await readProducts(event);
    expect(fresh.some((p) => p.id === '77')).toBe(true);
  });
});

describe('getProductBySlug', () => {
  it('находит по slug', async () => {
    expect((await getProductBySlug(event, 'kastryulya'))?.id).toBe('2');
  });

  it('находит по строковому id', async () => {
    expect((await getProductBySlug(event, '3'))?.slug).toBe('noski');
  });

  it('отсутствующий — null', async () => {
    expect(await getProductBySlug(event, 'chego-takogo-net')).toBeNull();
  });
});

describe('getSimilarProducts', () => {
  it('та же категория, без самого товара, ограничение лимитом', async () => {
    const current = catalog[0]!; // Кружка (посуда)
    const similar = await getSimilarProducts(event, current);
    expect(similar.map((p) => p.id)).toEqual(['2']); // Кастрюля, без Кружки

    const limited = await getSimilarProducts(event, current, 1);
    expect(limited).toHaveLength(1);
  });

  it('товар без категорий — пустой список (без чтения каталога)', async () => {
    const current = makeProduct({ id: '9', slug: 'no-cat', categories: [] });
    expect(await getSimilarProducts(event, current)).toEqual([]);
  });

  it('работает на каталоге из KV (не из сида)', async () => {
    kvStore.set('data:products', [
      makeProduct({ id: '10', slug: 'a', categories: ['тест'] }),
      makeProduct({ id: '11', slug: 'b', categories: ['тест'] }),
      makeProduct({ id: '12', slug: 'c', categories: ['тест'] }),
    ]);
    const similar = await getSimilarProducts(event, makeProduct({ id: '10', categories: ['тест'] }));
    expect(similar.map((p) => p.id)).toEqual(['11', '12']);
  });
});

describe('normalizeCategories — форматы поля категорий', () => {
  it('массив строк: срезает пробелы, отбрасывает пустые', () => {
    expect(normalizeCategories({ categories: ['  Электроника ', '', 'Книги'] })).toEqual([
      'Электроника',
      'Книги',
    ]);
  });

  it('массив объектов { name } (формат мультиселектов)', () => {
    expect(normalizeCategories({ categories: [{ name: 'Спорт' }, { name: ' Велосипеды ' }] })).toEqual(
      ['Спорт', 'Велосипеды'],
    );
  });

  it('смешанный массив: строки и объекты вперемешку', () => {
    expect(normalizeCategories({ categories: ['Книги', { name: 'Программирование' }] })).toEqual([
      'Книги',
      'Программирование',
    ]);
  });

  it('CSV-строка — старый формат поля админки', () => {
    expect(normalizeCategories({ categories: 'Электроника, Техника ,, Книги' })).toEqual([
      'Электроника',
      'Техника',
      'Книги',
    ]);
  });

  it('categoriesInput — алиас CSV, проигрывается при отсутствии categories', () => {
    expect(normalizeCategories({ categoriesInput: ' A , B ' })).toEqual(['A', 'B']);
  });

  it('categories имеет приоритет над categoriesInput', () => {
    expect(normalizeCategories({ categories: 'X', categoriesInput: 'Y' })).toEqual(['X']);
  });

  it('дубликаты схлопываются, порядок первого вхождения сохраняется', () => {
    expect(normalizeCategories({ categories: ['A', ' B', 'A ', 'B', 'C'] })).toEqual(['A', 'B', 'C']);
  });

  it('поле не пришло вовсе — null (для PUT: категории не трогаем)', () => {
    expect(normalizeCategories({ name: 'Товар' })).toBeNull();
    expect(normalizeCategories({})).toBeNull();
    expect(normalizeCategories(null)).toBeNull();
    expect(normalizeCategories(undefined)).toBeNull();
  });

  it('категории явные, но пустые — [] (для PUT: валидация 400)', () => {
    expect(normalizeCategories({ categories: [] })).toEqual([]);
    expect(normalizeCategories({ categories: '' })).toEqual([]);
    expect(normalizeCategories({ categories: ',,,' })).toEqual([]);
    expect(normalizeCategories({ categories: 42 })).toEqual([]); // мусор вместо массива
  });

  it('мусор внутри массива (null, числа, объекты без name) отбрасывается, не роняя нормализацию', () => {
    expect(normalizeCategories({ categories: ['A', null, 123, { nope: true }] })).toEqual(['A']);
  });
});