// tests/unit/spec-facets.test.ts
// Фасетные фильтры по характеристикам: buildSpecFacets (счётчики, сортировка,
// шумодав уникальных значений, восстановление выбранного) и filterBySpecSelection
// (И между лейблами, ИЛИ между значениями).
import { describe, expect, it } from 'vitest';
import {
  buildSpecFacets,
  countActiveSpecFilters,
  filterBySpecSelection,
} from '../../app/utils/specFacets';

const p = (
  id: string,
  characteristics?: Record<string, string> | null,
): { id: string; characteristics?: Record<string, string> | null } => ({ id, characteristics });

describe('buildSpecFacets', () => {
  it('пустой/битый вход — пустой результат', () => {
    expect(buildSpecFacets([])).toEqual([]);
    expect(buildSpecFacets(undefined as never)).toEqual([]);
    expect(buildSpecFacets([p('a'), p('b', null)])).toEqual([]);
  });

  it('считает значения по лейблам, игнорирует пустые и нестроковые', () => {
    const products = [
      p('1', { Бренд: 'Samsung', Вес: '200 г' }),
      p('2', { Бренд: 'Apple', Вес: '180 г' }),
      p('3', { Бренд: 'Samsung', Вес: '' }),
      p('4', { Бренд: 42 as unknown as string }),
    ];
    const facets = buildSpecFacets(products);
    expect(facets).toHaveLength(2);

    const brand = facets.find((g) => g.label === 'Бренд');
    expect(brand?.values).toEqual([
      { value: 'Samsung', count: 2 },
      { value: 'Apple', count: 1 },
    ]);
    expect(brand?.productCount).toBe(3);

    const weight = facets.find((g) => g.label === 'Вес');
    // при равных счётчиках — алфавитный порядок
    expect(weight?.values).toEqual([
      { value: '180 г', count: 1 },
      { value: '200 г', count: 1 },
    ]);
  });

  it('шумодав: >8 уникальных значений — остаются только count ≥ 2', () => {
    const products = Array.from({ length: 12 }, (_, i) =>
      p(`u${i}`, { Экран: `Модель экрана №${i}` }),
    );
    // + два товара с одинаковым значением
    products.push(p('s1', { Экран: 'AMOLED 120 Гц' }));
    products.push(p('s2', { Экран: 'AMOLED 120 Гц' }));
    const facets = buildSpecFacets(products);
    const screen = facets.find((g) => g.label === 'Экран');
    expect(screen?.values).toEqual([{ value: 'AMOLED 120 Гц', count: 2 }]);
  });

  it('группа без значений count ≥ 2 при >8 уникальных — отбрасывается', () => {
    const products = Array.from({ length: 10 }, (_, i) => p(`x${i}`, { Артикул: `SKU-${i}` }));
    expect(buildSpecFacets(products)).toEqual([]);
  });

  it('≤8 уникальных значений не обрезаются, даже если все count 1', () => {
    const products = Array.from({ length: 5 }, (_, i) => p(`y${i}`, { Цвет: `Цвет-${i}` }));
    const facets = buildSpecFacets(products);
    expect(facets).toHaveLength(1);
    expect(facets[0].values).toHaveLength(5);
  });

  it('выбранное значение из-за обрезки возвращается с count 0', () => {
    const products = Array.from({ length: 12 }, (_, i) =>
      p(`u${i}`, { Экран: `Модель экрана №${i}` }),
    );
    const facets = buildSpecFacets(products, { Экран: ['Модель экрана №3'] });
    expect(facets[0].values).toEqual([{ value: 'Модель экрана №3', count: 0 }]);
  });

  it('выбранный лейбл, исчезнувший из выборки, — пустая группа с count 0', () => {
    const facets = buildSpecFacets([p('1', { Бренд: 'Samsung' })], {
      Цвет: ['синий'],
      Бренд: [],
    });
    // Бренд с пустым выбором группу не создаёт
    expect(facets.some((g) => g.label === 'Бренд')).toBe(true);
    const color = facets.find((g) => g.label === 'Цвет');
    expect(color).toEqual({
      label: 'Цвет',
      productCount: 0,
      values: [{ value: 'синий', count: 0 }],
    });
  });

  it('сортировка групп — по охвату товаров, значения — по счётчику', () => {
    const products = [
      p('1', { Редкое: 'A', Частое: 'x' }),
      p('2', { Частое: 'x' }),
      p('3', { Частое: 'y' }),
    ];
    const facets = buildSpecFacets(products);
    expect(facets.map((g) => g.label)).toEqual(['Частое', 'Редкое']);
    expect(facets[0].values).toEqual([
      { value: 'x', count: 2 },
      { value: 'y', count: 1 },
    ]);
  });
});

describe('filterBySpecSelection', () => {
  const products = [
    p('1', { Бренд: 'Samsung', Цвет: 'синий' }),
    p('2', { Бренд: 'Samsung', Цвет: 'чёрный' }),
    p('3', { Бренд: 'Apple', Цвет: 'синий' }),
    p('4', { Бренд: 'Apple' }),
    p('5'),
  ];

  it('пустой/битый выбор — проходит всё', () => {
    expect(filterBySpecSelection(products)).toHaveLength(5);
    expect(filterBySpecSelection(products, {})).toHaveLength(5);
    expect(filterBySpecSelection(products, null as never)).toHaveLength(5);
  });

  it('ИЛИ внутри лейбла', () => {
    const result = filterBySpecSelection(products, { Цвет: ['синий', 'чёрный'] });
    expect(result.map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('И между лейблами', () => {
    const result = filterBySpecSelection(products, {
      Бренд: ['Samsung'],
      Цвет: ['синий'],
    });
    expect(result.map((item) => item.id)).toEqual(['1']);
  });

  it('товар без нужного лейбла не проходит', () => {
    const result = filterBySpecSelection(products, { Цвет: ['синий'] });
    expect(result.map((item) => item.id)).toEqual(['1', '3']);
  });

  it('товар без характеристик не проходит при непустом выборе', () => {
    expect(filterBySpecSelection(products, { Бренд: ['Samsung'] }).map((i) => i.id)).toEqual([
      '1',
      '2',
    ]);
  });
});

describe('countActiveSpecFilters', () => {
  it('считает лейблы с непустыми массивами', () => {
    expect(countActiveSpecFilters({})).toBe(0);
    expect(countActiveSpecFilters({ Цвет: ['синий'] })).toBe(1);
    expect(countActiveSpecFilters({ Цвет: ['синий'], Бренд: [], Вес: ['200 г', '180 г'] })).toBe(2);
    expect(countActiveSpecFilters(null as never)).toBe(0);
  });
});
