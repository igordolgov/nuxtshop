// Тесты истории изменений товара (server/lib/productHistory.ts):
//  - diffProduct — построчный дифф полей до/после (основной вход записи
//    «изменён» в PUT / bulk.patch);
//  - shortenValue — санитизация значений для компактных KV-записей;
//  - recordProductHistory/readProductHistory — KV-журнал (новые первыми,
//    лимит 30). В тестах биндингов KV нет — storage.ts отдаёт in-memory
//    fallback (как в cart-sync.test.ts / recently-viewed-sync.test.ts).
import { describe, expect, it } from 'vitest';
import type { H3Event } from 'h3';
import {
  diffProduct,
  readProductHistory,
  recordProductHistory,
  shortenValue,
  PRODUCT_HISTORY_MAX,
  type ProductHistoryEntry,
} from '../../server/lib/productHistory';
import type { Product, ProductVariant } from '../../server/lib/productHelpers';

const bareEvent = {} as H3Event;

const baseProduct = (overrides: Partial<Product> = {}): Product => ({
  id: '1',
  slug: 'test',
  name: 'Тест',
  description: 'Описание',
  price: 1000,
  image: '/images/test.jpg',
  gallery: ['/images/test.jpg'],
  categories: ['Электроника'],
  inStock: true,
  stockQuantity: 5,
  characteristics: { Бренд: 'TestCo' },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('diffProduct: построчный дифф полей', () => {
  it('изменение цены даёт запись price from→to', () => {
    const changes = diffProduct(baseProduct(), baseProduct({ price: 1500 }));
    expect(changes).toEqual([{ field: 'price', from: 1000, to: 1500 }]);
  });

  it('идентичные товары — пустой дифф', () => {
    expect(diffProduct(baseProduct(), baseProduct())).toEqual([]);
  });

  it('изменение имени и остатка — две записи', () => {
    const changes = diffProduct(baseProduct(), baseProduct({ name: 'Тест 2', stockQuantity: 0 }));
    expect(changes.map((c) => c.field)).toEqual(['name', 'stockQuantity']);
    expect(changes[1].to).toBe(0);
  });

  it("'' и отсутствующее поле — одно и то же («пусто»): шума нет", () => {
    // Старые записи могли хранить nameEn: '', нормализатор удаляет поле —
    // для витрины разницы нет, в дифф её тоже не должно быть
    expect(diffProduct(baseProduct({ nameEn: '' }), baseProduct({ nameEn: undefined }))).toEqual(
      [],
    );
    expect(diffProduct(baseProduct({ nameEn: '' }), baseProduct())).toEqual([]);
  });

  it('удаление скидки: oldPrice уходит в null', () => {
    const changes = diffProduct(baseProduct({ oldPrice: 1500 }), baseProduct());
    expect(changes).toEqual([{ field: 'oldPrice', from: 1500, to: null }]);
  });

  it('характеристики: перестановка ключей — не изменение', () => {
    // Одинаковые пары в разном порядке вставки: canonValue сортирует ключи
    expect(
      diffProduct(
        baseProduct({ characteristics: { Бренд: 'TestCo', Гарантия: '12 мес.' } }),
        baseProduct({ characteristics: { Гарантия: '12 мес.', Бренд: 'TestCo' } }),
      ),
    ).toEqual([]);
  });

  it('характеристики: изменение значения — запись с компактным JSON', () => {
    const changes = diffProduct(
      baseProduct(),
      baseProduct({ characteristics: { Бренд: 'Other' } }),
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('characteristics');
    expect(String(changes[0].to)).toContain('Other');
  });

  it('варианты: порядок важен (variants[0] — базовый), перестановка — изменение', () => {
    const v = (id: string): ProductVariant => ({ id, name: `V${id}` });
    const changes = diffProduct(
      baseProduct({ variants: [v('a'), v('b')] }),
      baseProduct({ variants: [v('b'), v('a')] }),
    );
    expect(changes).toEqual([{ field: 'variants', from: 2, to: 2 }]);
  });

  it('категории: сравнение как массива (порядок важен для переводов)', () => {
    expect(diffProduct(baseProduct(), baseProduct({ categories: ['Электроника'] }))).toEqual([]);
    const changes = diffProduct(baseProduct(), baseProduct({ categories: ['Техника'] }));
    expect(changes).toEqual([{ field: 'categories', from: ['Электроника'], to: ['Техника'] }]);
  });
});

describe('shortenValue: компактные значения для KV', () => {
  it('пустое значение → null', () => {
    expect(shortenValue(undefined)).toBeNull();
    expect(shortenValue(null)).toBeNull();
    expect(shortenValue('')).toBeNull();
  });

  it('длинная строка обрезается до 120 с многоточием', () => {
    const out = shortenValue('x'.repeat(300)) as string;
    expect(out).toHaveLength(121);
    expect(out.endsWith('…')).toBe(true);
  });

  it('массив: максимум 6 элементов + счётчик «+N»', () => {
    const out = shortenValue([1, 2, 3, 4, 5, 6, 7, 8]) as unknown[];
    expect(out).toHaveLength(7);
    expect(out[6]).toBe('+2');
  });

  it('объект — компактный JSON-строкой', () => {
    expect(shortenValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('recordProductHistory / readProductHistory: KV-журнал', () => {
  it('у товара без истории — пустой список', async () => {
    expect(await readProductHistory(bareEvent, 'no-such-history-1')).toEqual([]);
  });

  it('записи складываются новыми первыми, созданная запись без диффа', async () => {
    const actor = { id: 1, email: 'admin@example.com', role: 'admin' };
    await recordProductHistory(bareEvent, {
      id: 'hist-1',
      actor,
      action: 'created',
      productName: 'Товар',
      changes: [],
    });
    await recordProductHistory(bareEvent, {
      id: 'hist-1',
      actor,
      action: 'updated',
      productName: 'Товар',
      changes: [{ field: 'price', from: 1, to: 2 }],
    });

    const list = await readProductHistory(bareEvent, 'hist-1');
    expect(list).toHaveLength(2);
    expect(list[0].action).toBe('updated');
    expect(list[0].changes).toEqual([{ field: 'price', from: 1, to: 2 }]);
    expect(list[1].action).toBe('created');
    expect(new Date(list[0].ts).toString()).not.toBe('Invalid Date');
    expect(list[0].actor).toEqual(actor);
  });

  it('лимит журнала: старые записи вытесняются', async () => {
    const actor = { id: 1, email: 'admin@example.com', role: 'admin' };
    for (let i = 0; i < PRODUCT_HISTORY_MAX + 2; i++) {
      await recordProductHistory(bareEvent, {
        id: 'hist-cap',
        actor,
        action: 'updated',
        changes: [{ field: 'stockQuantity', from: i, to: i + 1 }],
      });
    }
    const list = await readProductHistory(bareEvent, 'hist-cap');
    expect(list).toHaveLength(PRODUCT_HISTORY_MAX);
    // Последняя запись — самая свежая (from: 31 → 32)
    expect(list[0].changes[0]).toEqual({
      field: 'stockQuantity',
      from: PRODUCT_HISTORY_MAX + 1,
      to: PRODUCT_HISTORY_MAX + 2,
    });
  });

  it('битое содержимое ключа → пустой список (не бросает)', async () => {
    await recordProductHistory(bareEvent, {
      id: 'hist-garbage',
      actor: { id: 1, email: 'a@b.c', role: 'admin' },
      action: 'updated',
      changes: [],
    });
    // Пишем мусор напрямую в fallback-KV через тот же интерфейс
    const { kvPutJSON } = await import('../../server/lib/storage');
    await kvPutJSON(bareEvent, 'product-history:hist-garbage2', 'строка вместо списка');
    expect(await readProductHistory(bareEvent, 'hist-garbage2')).toEqual([]);
    expect((await readProductHistory(bareEvent, 'hist-garbage')).length).toBeGreaterThan(0);
  });

  it('чужие объекты в списке отбрасываются, валидные проходят', async () => {
    const entry: ProductHistoryEntry = {
      ts: '2024-01-02T00:00:00.000Z',
      actor: { id: 2, email: 'm@b.c', role: 'manager' },
      action: 'deleted',
      productName: 'Старый товар',
      changes: [],
    };
    const { kvPutJSON } = await import('../../server/lib/storage');
    await kvPutJSON(bareEvent, 'product-history:hist-mixed', [
      entry,
      'мусор',
      42,
      { action: 'без ts' },
    ]);
    const list = await readProductHistory(bareEvent, 'hist-mixed');
    expect(list).toEqual([entry]);
  });
});
