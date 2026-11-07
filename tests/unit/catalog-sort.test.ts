// tests/unit/catalog-sort.test.ts
// Сортировка каталога (app/utils/catalogSort.ts): регресс-тесты бага
// «id парсился как дата» — new Date('33') → 2033 год, '27'…'30' → Invalid
// Date → NaN в компараторе → новый товар с честным createdAt падал в конец
// списка при сортировке «сначала новые» (Teléfono на кубинской витрине).
import { describe, expect, it } from 'vitest';
import { sortProductsByConfig } from '../../app/utils/catalogSort';

const makeProduct = (
  id: string,
  createdAt?: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  name: `Товар ${id}`,
  price: 100,
  createdAt,
  ...extra,
});

describe('sortProductsByConfig — дата (createdAt/updatedAt)', () => {
  it('товар с реальным createdAt — первый при «сначала новые», даже если у остальных дат нет', () => {
    const list = [
      makeProduct('12'), // '12' раньше парсился как декабрь 2001
      makeProduct('33'), // '33' раньше парсился как 2033 год
      makeProduct('34', '2026-11-07T03:19:16.869Z'), // новый товар пользователя
      makeProduct('27'), // '27' → Invalid Date (NaN в старом компараторе)
    ];
    const sorted = sortProductsByConfig(list, { field: 'createdAt', order: 'desc' });
    expect(sorted[0]?.id).toBe('34');
  });

  it('id не парсится как дата: бездатные внизу, порядок среди них — по числовому id desc', () => {
    const list = [
      makeProduct('1'),
      makeProduct('33'),
      makeProduct('2'),
      makeProduct('34', '2026-11-07T03:19:16.869Z'),
    ];
    const sorted = sortProductsByConfig(list, { field: 'createdAt', order: 'desc' });
    expect(sorted.map((p) => p.id)).toEqual(['34', '33', '2', '1']);
  });

  it('мусорная строка даты считается «даты нет» (внизу списка)', () => {
    const list = [
      makeProduct('2', 'какой-то мусор'),
      makeProduct('1', '2026-01-01T00:00:00.000Z'),
      makeProduct('3'),
    ];
    const sorted = sortProductsByConfig(list, { field: 'createdAt', order: 'desc' });
    expect(sorted.map((p) => p.id)).toEqual(['1', '3', '2']);
  });

  it('asc: старые сверху, бездатные внизу', () => {
    const list = [
      makeProduct('5'),
      makeProduct('1', '2026-01-01T00:00:00.000Z'),
      makeProduct('2', '2020-01-01T00:00:00.000Z'),
    ];
    const sorted = sortProductsByConfig(list, { field: 'createdAt', order: 'asc' });
    expect(sorted.map((p) => p.id)).toEqual(['2', '1', '5']);
  });

  it('без конфига — дефолт «сначала новые» по createdAt', () => {
    const list = [
      makeProduct('9'),
      makeProduct('10'),
      makeProduct('34', '2026-11-07T03:19:16.869Z'),
    ];
    const sorted = sortProductsByConfig(list);
    expect(sorted[0]?.id).toBe('34');
    expect(sorted.map((p) => p.id)).toEqual(['34', '10', '9']);
  });

  it('равные даты — тайбрейк по числовому id (больший выше при desc)', () => {
    const date = '2026-05-01T00:00:00.000Z';
    const list = [makeProduct('7', date), makeProduct('10', date), makeProduct('9', date)];
    const sorted = sortProductsByConfig(list, { field: 'createdAt', order: 'desc' });
    expect(sorted.map((p) => p.id)).toEqual(['10', '9', '7']);
  });
});

describe('sortProductsByConfig — прочие поля', () => {
  it('id: числовое сравнение (9 < 10), а не строковое', () => {
    const list = [makeProduct('10'), makeProduct('9')];
    const asc = sortProductsByConfig(list, { field: 'id', order: 'asc' });
    expect(asc.map((p) => p.id)).toEqual(['9', '10']);
    const desc = sortProductsByConfig(list, { field: 'id', order: 'desc' });
    expect(desc.map((p) => p.id)).toEqual(['10', '9']);
  });

  it('price asc/desc', () => {
    const list = [
      makeProduct('1', undefined, { price: 300 }),
      makeProduct('2', undefined, { price: 100 }),
      makeProduct('3', undefined, { price: 200 }),
    ];
    const asc = sortProductsByConfig(list, { field: 'price', order: 'asc' });
    expect(asc.map((p) => p.id)).toEqual(['2', '3', '1']);
    const desc = sortProductsByConfig(list, { field: 'price', order: 'desc' });
    expect(desc.map((p) => p.id)).toEqual(['1', '3', '2']);
  });

  it('name asc/desc без регистра', () => {
    const list = [
      makeProduct('1', undefined, { name: 'банан' }),
      makeProduct('2', undefined, { name: 'Арбуз' }),
      makeProduct('3', undefined, { name: 'вишня' }),
    ];
    const asc = sortProductsByConfig(list, { field: 'name', order: 'asc' });
    expect(asc.map((p) => p.id)).toEqual(['2', '1', '3']);
    const desc = sortProductsByConfig(list, { field: 'name', order: 'desc' });
    expect(desc.map((p) => p.id)).toEqual(['3', '1', '2']);
  });

  it('исходный список не мутирует (возвращается копия)', () => {
    const list = [makeProduct('2'), makeProduct('1', '2026-01-01T00:00:00.000Z')];
    const snapshot = list.map((p) => p.id);
    sortProductsByConfig(list, { field: 'createdAt', order: 'desc' });
    expect(list.map((p) => p.id)).toEqual(snapshot);
  });
});
