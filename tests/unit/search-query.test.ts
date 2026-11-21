// tests/unit/search-query.test.ts
// ── Поисковый матчер витрины (app/utils/searchQuery.ts) ──────────────────
//
// Регресс с кубинской витрины («поиск не ищет ничего»): прежний поиск
// сравнивал сырые подстроки — не находили «telefono» в «Teléfono»
// (диакритика), «galaxy samsung» в «…Samsung Galaxy…» (порядок слов),
// «Samsung  Galaxy » (двойной/концевой пробел), «wh1000xm4» в
// «WH-1000XM4» (склеенный номер модели). Плюс AND-семантика опустошала
// выдачу, когда один токен промахивался («телефон samsung»: «смартфон» =
// смарт+фон, буквы «е» там нет) — теперь есть частичный матч.

import { describe, expect, it } from 'vitest';
import {
  buildSearchHaystack,
  foldSearchText,
  searchFilter,
  tokenizeSearchQuery,
} from '../../app/utils/searchQuery';
import {
  buildSearchHaystack as buildSearchHaystackServer,
  foldSearchText as foldSearchTextServer,
  searchFilter as searchFilterServer,
  tokenizeSearchQuery as tokenizeSearchQueryServer,
} from '../../server/lib/searchQuery';

// ─── foldSearchText ──────────────────────────────────────────────────────

describe('foldSearchText', () => {
  it('режет диакритику: é→e, ñ→n, ü→u', () => {
    expect(foldSearchText('Teléfono')).toBe('telefono');
    expect(foldSearchText('Portátil')).toBe('portatil');
    expect(foldSearchText('AÑO')).toBe('ano');
    expect(foldSearchText('Díaspués')).toBe('diaspues');
  });

  it('ё → е (canonical decomposition), регистр не важен', () => {
    expect(foldSearchText('Ёлка ЁЖИК')).toBe('елка ежик');
    expect(foldSearchText('ЁЁ')).toBe('ее');
  });

  it('кириллица и латиница сохраняются, только регистр', () => {
    expect(foldSearchText('Смартфон Samsung')).toBe('смартфон samsung');
  });

  it('пунктуация не трогается (её режет separator-fold, не fold)', () => {
    expect(foldSearchText('WH-1000XM4')).toBe('wh-1000xm4');
  });
});

// ─── tokenizeSearchQuery ─────────────────────────────────────────────────

describe('tokenizeSearchQuery', () => {
  it('двойные и концевые пробелы не создают пустых токенов', () => {
    expect(tokenizeSearchQuery('Samsung  Galaxy ')).toEqual(['samsung', 'galaxy']);
    expect(tokenizeSearchQuery('  телефон   samsung  ')).toEqual(['телефон', 'samsung']);
  });

  it('пунктуация внутри запроса → разделители (номер модели с дефисом)', () => {
    expect(tokenizeSearchQuery('WH-1000XM4')).toEqual(['wh', '1000xm4']);
    expect(tokenizeSearchQuery('6,1" amoled')).toEqual(['6', '1', 'amoled']);
  });

  it('диакритика режется и в токенах', () => {
    expect(tokenizeSearchQuery('Teléfono')).toEqual(['telefono']);
  });

  it('пустой/пробельный запрос — пустой список токенов', () => {
    expect(tokenizeSearchQuery('')).toEqual([]);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });
});

// ─── buildSearchHaystack ─────────────────────────────────────────────────

describe('buildSearchHaystack', () => {
  it('складывает все поля в одну солому с fold и сепараторами', () => {
    expect(buildSearchHaystack(['Смартфон Samsung', 'Флагман', ['Электроника', 'Смартфоны']])).toBe(
      'смартфон samsung флагман электроника смартфоны',
    );
  });

  it('пустые и нестроковые элементы пропускаются', () => {
    expect(
      buildSearchHaystack(['', undefined, null, [], ['a', '', null] as string[], 'Samsung']),
    ).toBe('a samsung');
  });

  it('пустой набор полей — пустая солома', () => {
    expect(buildSearchHaystack([])).toBe('');
    expect(buildSearchHaystack([undefined, null])).toBe('');
  });

  it('дефис в номере модели → пробел', () => {
    expect(buildSearchHaystack(['Auriculares Sony WH-1000XM4'])).toBe(
      'auriculares sony wh 1000xm4',
    );
  });
});

// ─── searchFilter — витринные регрессы ───────────────────────────────────

describe('searchFilter', () => {
  const fieldsOf = (name: string, description?: string, categories?: string[]) => () => [
    name,
    description,
    categories,
  ];
  const catalog = [
    {
      id: '1',
      fields: fieldsOf(
        'Teléfono inteligente Samsung Galaxy S23',
        'Teléfono insignia con un potente procesador',
        ['Electrónica', 'Smartphones'],
      ),
    },
    {
      id: '2',
      fields: fieldsOf('Auriculares inalámbricos Sony WH-1000XM4', 'Cancelación de ruido', [
        'Audio',
      ]),
    },
    {
      id: '3',
      fields: fieldsOf('Portátil Apple MacBook Pro 16', 'Portátil profesional', [
        'Electrónica',
        'Laptops',
      ]),
    },
    { id: '4', fields: fieldsOf('Ёлочные игрушки', 'Набор шаров', ['Праздники']) },
  ];
  const run = (query: string | null | undefined) =>
    searchFilter(catalog, query, (item) => item.fields());

  it('простая подстрока', () => {
    expect(run('samsung').map((p) => p.id)).toEqual(['1']);
  });

  it('CU: «telefono» без ударения находит «Teléfono…»', () => {
    expect(run('telefono').map((p) => p.id)).toEqual(['1']);
    expect(run('Teléfono').map((p) => p.id)).toEqual(['1']);
  });

  it('CU: испанский запрос по описанию и категории', () => {
    expect(run('insignia procesador').map((p) => p.id)).toEqual(['1']);
    expect(run('electronica').map((p) => p.id)).toEqual(['1', '3']);
  });

  it('RU: порядок слов не важен', () => {
    expect(run('galaxy samsung').map((p) => p.id)).toEqual(['1']);
    expect(run('samsung galaxy').map((p) => p.id)).toEqual(['1']);
  });

  it('RU: двойные и концевые пробелы не ломают запрос', () => {
    expect(run('Samsung  Galaxy ').map((p) => p.id)).toEqual(['1']);
  });

  it('RU: ё = е в обе стороны', () => {
    expect(run('елочные').map((p) => p.id)).toEqual(['4']);
    expect(run('ёлочные').map((p) => p.id)).toEqual(['4']);
  });

  it('номер модели: с дефисом, с пробелом и склеенный', () => {
    expect(run('WH-1000XM4').map((p) => p.id)).toEqual(['2']);
    expect(run('wh 1000').map((p) => p.id)).toEqual(['2']);
    expect(run('wh1000xm4').map((p) => p.id)).toEqual(['2']);
    expect(run('sony auriculares').map((p) => p.id)).toEqual(['2']);
  });

  it('AND-семантика: строгости отдают первыми, порядок каталога сохраняется', () => {
    // оба токена у одного товара — строгий матч
    expect(run('macbook portatil').map((p) => p.id)).toEqual(['3']);
  });

  it('частичный матч: «телефон samsung» не опустошает выдачу («смартфон» = смарт+фон)', () => {
    // «телефон» в каталоге нет ни разу, «samsung» есть у товара 1 —
    // выдача НЕ пустая, а сам ближайший товар
    expect(run('телефон samsung').map((p) => p.id)).toEqual(['1']);
  });

  it('частичный матч отсортирован по числу совпавших токенов', () => {
    // «sony auriculares samsung»: строгого матча нет (у 2 нет «samsung»),
    // частичный: у 2 совпало 2 токена, у 1 — один → сначала 2, потом 1
    expect(run('sony auriculares samsung').map((p) => p.id)).toEqual(['2', '1']);
    // «audio auriculares galaxy»: у 2 — audio+auriculares (2 токена),
    // у 1 — galaxy (1 токен) → релевантный порядок [2, 1]
    expect(run('audio auriculares galaxy').map((p) => p.id)).toEqual(['2', '1']);
  });

  it('полностью промахнувшийся запрос — честная пустая выдача', () => {
    expect(run('iphone')).toEqual([]);
    expect(run('xperia').map((p) => p.id)).toEqual([]);
  });

  it('пустой запрос — весь список без фильтрации', () => {
    expect(run('')).toHaveLength(4);
    expect(run('   ')).toHaveLength(4);
    expect(run(null)).toHaveLength(4);
    expect(run(undefined)).toHaveLength(4);
  });

  it('не мутирует исходный список', () => {
    const original = [...catalog];
    run('samsung');
    expect(catalog).toEqual(original);
  });
});

// ─── server/app copies are in sync ───────────────────────────────────────

describe('searchQuery: server/app copies are in sync', () => {
  const texts = [
    'Teléfono inteligente Samsung Galaxy S23',
    'Смартфон Samsung Galaxy S23',
    'Auriculares Sony WH-1000XM4',
    'Ёлочные игрушки',
    '',
  ];
  const queries = [
    'telefono',
    'Teléfono',
    'телефон samsung',
    'Samsung  Galaxy ',
    'WH-1000XM4',
    'wh1000xm4',
    'ёлочные',
    '',
    '   ',
  ];
  const fieldSets = [
    ['Teléfono inteligente', undefined, ['Electrónica']],
    ['Смартфон Samsung', 'Описание', ['Электроника', 'Смартфоны']],
    [] as string[],
  ];
  const items = fieldSets.map((fields, id) => ({ id: String(id), fields }));

  it.each(texts.map((t) => [t]))('fold совпадает для %j', (text) => {
    expect(foldSearchTextServer(text)).toEqual(foldSearchText(text));
  });

  it.each(queries.map((q) => [q]))('токены совпадают для %j', (query) => {
    expect(tokenizeSearchQueryServer(query)).toEqual(tokenizeSearchQuery(query));
  });

  it.each(fieldSets.map((f) => [f]))('haystack совпадает для %j', (fields) => {
    expect(buildSearchHaystackServer(fields)).toEqual(buildSearchHaystack(fields));
  });

  it.each(queries.map((q) => [q]))('фильтр совпадает для запроса %j', (query) => {
    const fieldsOf = (item: { fields: unknown[] }) => item.fields;
    expect(searchFilterServer(items, query, fieldsOf)).toEqual(
      searchFilter(items, query, fieldsOf),
    );
  });
});
