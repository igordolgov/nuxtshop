// Тесты характеристик товара: sanitizeCharacteristics (недоверенный ввод
// админ-запросов → чистый Record) и migrateSeedCharacteristics (доливка
// сидового spec-листа товарам без них — только в памяти, без записи KV).
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV (тот же паттерн, что в product-helpers.test.ts) ─────────
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
  hasCharacteristics,
  migrateSeedCharacteristics,
  readProducts,
  sanitizeCharacteristics,
  type Product,
} from '../../server/lib/productHelpers';
import { presetLabelsForCategories } from '../../app/utils/characteristicPresets';

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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  kvStore.clear();
});

describe('sanitizeCharacteristics — форматы входа', () => {
  it('массив пар → Record с сохранением порядка', () => {
    const out = sanitizeCharacteristics([
      { label: 'Экран', value: '6,1" AMOLED' },
      { label: 'Вес', value: '168 г' },
    ]);
    expect(out).toEqual({ Экран: '6,1" AMOLED', Вес: '168 г' });
    expect(Object.keys(out)).toEqual(['Экран', 'Вес']);
  });

  it('Record-вход (старые клиенты) нормализуется так же', () => {
    const out = sanitizeCharacteristics({ Цвет: 'Чёрный', Вес: '168 г' });
    expect(out).toEqual({ Цвет: 'Чёрный', Вес: '168 г' });
  });

  it('мусорный вход (строка/число/null) → пустой Record, не исключение', () => {
    expect(sanitizeCharacteristics('мусор')).toEqual({});
    expect(sanitizeCharacteristics(42)).toEqual({});
    expect(sanitizeCharacteristics(null)).toEqual({});
    expect(sanitizeCharacteristics(undefined)).toEqual({});
  });
});

describe('sanitizeCharacteristics — гигиена ввода', () => {
  it('пустые названия и значения отбрасываются (пара без значения — баг листа)', () => {
    const out = sanitizeCharacteristics([
      { label: '  ', value: 'x' },
      { label: 'Цвет', value: '   ' },
      { label: 'Цвет', value: 'Чёрный' },
    ]);
    expect(out).toEqual({ Цвет: 'Чёрный' });
  });

  it('пробелы по краям срезаются', () => {
    const out = sanitizeCharacteristics([{ label: ' Цвет ', value: ' Чёрный ' }]);
    expect(out).toEqual({ Цвет: 'Чёрный' });
  });

  it('дубликаты названий схлопываются — первое вхождение', () => {
    const out = sanitizeCharacteristics([
      { label: 'Цвет', value: 'Чёрный' },
      { label: 'Цвет', value: 'Белый' },
    ]);
    expect(out).toEqual({ Цвет: 'Чёрный' });
  });

  it('не-строковые поля отбрасываются, а не ломают сохранение', () => {
    const out = sanitizeCharacteristics([
      null,
      42,
      { label: 123, value: 'x' },
      { label: 'Ок', value: { nested: true } },
      { label: 'Цвет', value: 'Чёрный' },
    ]);
    expect(out).toEqual({ Цвет: 'Чёрный' });
  });

  it('лимит 40 пар: лишнее отбрасывается', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      label: `Характеристика ${i + 1}`,
      value: String(i + 1),
    }));
    const out = sanitizeCharacteristics(many);
    expect(Object.keys(out)).toHaveLength(40);
    expect(out['Характеристика 40']).toBe('40');
    expect(out['Характеристика 41']).toBeUndefined();
  });
});

describe('hasCharacteristics', () => {
  it('пустой Record/отсутствие поля → false, заполненный → true', () => {
    expect(hasCharacteristics(makeProduct({ characteristics: {} }))).toBe(false);
    expect(hasCharacteristics(makeProduct({}))).toBe(false);
    expect(hasCharacteristics(null)).toBe(false);
    expect(hasCharacteristics(makeProduct({ characteristics: { Цвет: 'Чёрный' } }))).toBe(true);
  });
});

describe('migrateSeedCharacteristics — доливка сидового spec-листа', () => {
  it('товар с непустыми характеристиками не трогается (админские правки главнее)', () => {
    const adminSpecs = { Цвет: 'Красный' };
    const product = makeProduct({
      slug: 'smartfon-samsung-galaxy-s23',
      characteristics: adminSpecs,
    });
    migrateSeedCharacteristics([product]);
    expect(product.characteristics).toEqual(adminSpecs);
  });

  it('товар без spec-листа, но с сидом по slug → получает сидовые характеристики', () => {
    // Реальный сид: у S23 характеристики есть после обновления сида
    const product = makeProduct({ slug: 'smartfon-samsung-galaxy-s23', characteristics: {} });
    migrateSeedCharacteristics([product]);
    expect(Object.keys(product.characteristics ?? {}).length).toBeGreaterThan(5);
    expect(product.characteristics?.['Бренд']).toBe('Samsung');
  });

  it('копия, а не общая ссылка на сид-объект', () => {
    const product = makeProduct({ slug: 'smartfon-samsung-galaxy-s23', characteristics: {} });
    migrateSeedCharacteristics([product]);
    const reference = product.characteristics;
    product.characteristics['Вес'] = 'изменено';
    expect(reference).toEqual(product.characteristics);
    // Сид при повторной миграции восстанавливает значения
    product.characteristics = {};
    migrateSeedCharacteristics([product]);
    expect(product.characteristics?.['Вес']).toBe('168 г');
  });

  it('readProducts после чтения KV доливает сидовые характеристики (самоисцеление)', async () => {
    // KV содержит товар БЕЗ характеристик (старая запись до обновления сида)
    kvStore.set('data:products', [
      makeProduct({ slug: 'smartfon-samsung-galaxy-s23', characteristics: {} }),
    ]);
    const products = await readProducts(event);
    expect(products[0]?.characteristics?.['Бренд']).toBe('Samsung');
    // KV не перезаписывался (гонка read-modify-write)
    const stored = kvStore.get('data:products') as Product[];
    expect(stored[0]?.characteristics ?? {}).toEqual({});
  });
});

describe('presetLabelsForCategories — чипы-пресеты редактора', () => {
  it('категорийные пресеты идут первыми, универсальные добираются без дубликатов', () => {
    const labels = presetLabelsForCategories(['Смартфоны']);
    expect(labels[0]).toBe('Бренд');
    expect(labels).toContain('Экран');
    // «Цвет» есть и в смартфонном, и в универсальном наборе — без дублей
    expect(labels.filter((l) => l === 'Цвет')).toHaveLength(1);
  });

  it('несколько категорий сливаются (порядок совпадений сохраняется)', () => {
    const labels = presetLabelsForCategories(['Смартфоны', 'Электроника']);
    expect(labels.indexOf('Экран')).toBeLessThan(labels.indexOf('Питание'));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('без категорий — только универсальный набор; неизвестная категория не падает', () => {
    const labels = presetLabelsForCategories([]);
    expect(labels.length).toBeGreaterThan(5);
    expect(() => presetLabelsForCategories(['Несуществующая категория'])).not.toThrow();
    expect(presetLabelsForCategories(null).length).toBeGreaterThan(0);
  });
});
