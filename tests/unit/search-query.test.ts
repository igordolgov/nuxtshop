// tests/unit/search-query.test.ts
// ── Поисковый матчер витрины (app/utils/searchQuery.ts) ──────────────────
//
// Регрессы:
// 1. Кубинская витрина («поиск не ищет ничего»): диакритика, порядок слов,
//    двойные пробелы, склеенные номера моделей, AND-семантика.
// 2. Опечатки (fuzzy): «samsng», «galaxi», «soni» находят товар напрямую —
//    консервативный допуск (1 правка, от 8 символов — 2), точные матчи
//    ранжируются выше fuzzy.
// 3. Транслитерация: «самсунг» → «samsung», «сяоми»/«ксиоми» → «xiaomi»,
//    «айфон» → «iphone», «yandex» → «Яндекс» (обратный алиас).
// 4. «Возможно, вы имели в виду» — слой ТЯЖЁЛЫХ опечаток (допуск 2/3 правки,
//    шире допуска выдачи 1/2): лёгкие опечатки теперь находит сам поиск,
//    подсказка остаётся для случаев, когда ничего не нашлось вовсе.

import { describe, expect, it } from 'vitest';
import {
  buildSearchHaystack,
  foldSearchText,
  searchFilter,
  searchTokenVariants,
  specHaystackFields,
  stemSearchToken,
  suggestSearchCorrection,
  tokenizeSearchQuery,
} from '../../app/utils/searchQuery';
import {
  buildSearchHaystack as buildSearchHaystackServer,
  foldSearchText as foldSearchTextServer,
  searchFilter as searchFilterServer,
  searchTokenVariants as searchTokenVariantsServer,
  specHaystackFields as specHaystackFieldsServer,
  stemSearchToken as stemSearchTokenServer,
  suggestSearchCorrection as suggestSearchCorrectionServer,
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

// ─── stemSearchToken — морфология запроса ────────────────────────────────

describe('stemSearchToken', () => {
  it('ru: «телефонов» → «телефон» (родительный множ.)', () => {
    expect(stemSearchToken('телефонов')).toBe('телефон');
    expect(stemSearchToken('телефонах')).toBe('телефон');
    expect(stemSearchToken('телефоне')).toBe('телефон');
    expect(stemSearchToken('наушники')).toBe('наушник');
    expect(stemSearchToken('наушниками')).toBe('наушник');
    expect(stemSearchToken('смартфонах')).toBe('смартфон');
  });

  it('en/es: множественное число', () => {
    // es-приоритет: «es» режется раньше «s», иначе «portatiles» → «portatile»
    // перестаёт быть префиксом единственного числа «portatil» в каталоге.
    // Побочный эффект для английских «-es»-слов: «phones» → «phon» —
    // префикс и «phone», и «smartphone» — выдача только расширяется
    expect(stemSearchToken('portatiles')).toBe('portatil');
    expect(stemSearchToken('telefonos')).toBe('telefon');
    expect(stemSearchToken('auriculares')).toBe('auricular');
    expect(stemSearchToken('accessories')).toBe('accessor');
    expect(stemSearchToken('phones')).toBe('phon');
  });

  it('номера моделей и цифры не стеммятся', () => {
    expect(stemSearchToken('wh1000xm4')).toBe('wh1000xm4');
    expect(stemSearchToken('1000')).toBe('1000');
    expect(stemSearchToken('s23')).toBe('s23');
    expect(stemSearchToken('xm4')).toBe('xm4');
  });

  it('короткие слова и бренды не трогаются (остаток ≥ 4)', () => {
    expect(stemSearchToken('samsung')).toBe('samsung');
    expect(stemSearchToken('sony')).toBe('sony');
    expect(stemSearchToken('galaxy')).toBe('galaxy');
    expect(stemSearchToken('для')).toBe('для');
    expect(stemSearchToken('часы')).toBe('часы');
    expect(stemSearchToken('iphone')).toBe('iphone');
  });

  it('базовая форма с «пустым» суффиксом остаётся префиксом себя (поиск не ломается)', () => {
    // «видео» → «виде» — префикс «видео», товар по-прежнему находится
    expect(stemSearchToken('видео')).toBe('виде');
    expect(stemSearchToken('радио')).toBe('ради');
  });

  it('ключи алиасов не стеммятся (иначе суффикс отрежет алиас)', () => {
    // «сяоми» кончается на «и» — без защиты стеммер отрезал бы «и» → «сяом»
    expect(stemSearchToken('сяоми')).toBe('сяоми');
    expect(stemSearchToken('ксиоми')).toBe('ксиоми');
    expect(stemSearchToken('нинтендо')).toBe('нинтендо');
    expect(stemSearchToken('самсунг')).toBe('самсунг');
  });
});

// ─── searchTokenVariants — транслитерация и алиасы ───────────────────────

describe('searchTokenVariants', () => {
  it('исходный токен всегда первый', () => {
    expect(searchTokenVariants('samsung')[0]).toBe('samsung');
    expect(searchTokenVariants('самсунг')[0]).toBe('самсунг');
  });

  it('кириллический бренд → латинский алиас', () => {
    expect(searchTokenVariants('самсунг')).toContain('samsung');
    expect(searchTokenVariants('сони')).toContain('sony');
    expect(searchTokenVariants('сяоми')).toContain('xiaomi');
    expect(searchTokenVariants('ксиоми')).toContain('xiaomi');
    expect(searchTokenVariants('айфон')).toContain('iphone');
    expect(searchTokenVariants('делонги')).toContain('delonghi');
  });

  it('латинский запрос → кириллический алиас (обратное направление)', () => {
    expect(searchTokenVariants('yandex')).toContain('яндекс');
    expect(searchTokenVariants('xiaomi')).toContain('сяоми');
  });

  it('посимвольный транслит: «самсунг» → «samsung» без алиаса тоже покрыт', () => {
    expect(searchTokenVariants('самсунг')).toContain('samsung');
    expect(searchTokenVariants('телефон')).toContain('telefon');
    // «в» → v/w: «вифи» → «wifi» (в каталоге «Wi-Fi» через дефис)
    expect(searchTokenVariants('вифи')).toContain('wifi');
  });

  it('латинский токен без кириллицы не получает транслит', () => {
    expect(searchTokenVariants('samsung')).not.toContain('samsungs');
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

  it('диакритика режется и в токенах, форма сводится к стему', () => {
    // латинская «o» не суффикс (в списке кириллическая «о»): базовая форма
    // остаётся как есть — префиксная семантика всё равно найдёт товар
    expect(tokenizeSearchQuery('Teléfono')).toEqual(['telefono']);
    expect(tokenizeSearchQuery('Portátiles')).toEqual(['portatil']);
    expect(tokenizeSearchQuery('Телефонов')).toEqual(['телефон']);
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

// ─── specHaystackFields — характеристики в соломе ────────────────────────

describe('specHaystackFields', () => {
  it('лейбл значение построчно', () => {
    expect(specHaystackFields({ Бренд: 'Samsung', Экран: 'AMOLED 120 Гц' })).toEqual([
      'Бренд Samsung',
      'Экран AMOLED 120 Гц',
    ]);
  });

  it('пусто/не объект/пустой объект → null (пропускается)', () => {
    expect(specHaystackFields(null)).toBe(null);
    expect(specHaystackFields(undefined)).toBe(null);
    expect(specHaystackFields({})).toBe(null);
  });

  it('searchFilter находит бренд из spec-листа (в т.ч. склеенный De’Longhi)', () => {
    const items = [
      {
        id: '1',
        fields: ['Смартфон Samsung Galaxy S23', specHaystackFields({ Бренд: 'Samsung' })],
      },
      {
        id: '2',
        fields: ['Кофемашина De’Longhi ECAM', specHaystackFields({ Бренд: 'De’Longhi' })],
      },
      { id: '3', fields: ['Ноутбук Apple', specHaystackFields({ Процессор: 'Apple M2 Pro' })] },
    ];
    const fieldsOf = (item: { fields: unknown[] }) => item.fields;
    expect(searchFilter(items, 'samsung', fieldsOf).map((p) => p.id)).toEqual(['1']);
    // Де’Longhi: апостроф → сепаратор; плотный запрос находит по tight-соломе
    expect(searchFilter(items, 'delonghi', fieldsOf).map((p) => p.id)).toEqual(['2']);
    // Значение характеристики («Snapdragon»-тип: только в spec-листе)
    expect(searchFilter(items, 'm2 pro', fieldsOf).map((p) => p.id)).toEqual(['3']);
  });
});

// ─── searchFilter — морфология (формы слов находят товар) ────────────────

describe('searchFilter: морфология', () => {
  const catalog = [
    {
      id: '1',
      fields: ['Мобильный телефон Samsung Galaxy S23', ['Электроника', 'Смартфоны']],
    },
    {
      id: '2',
      fields: ['Беспроводные наушники Sony WH-1000XM4', ['Электроника']],
    },
  ];
  const run = (query: string) =>
    searchFilter(catalog, query, (item) => item.fields).map((p) => p.id);

  it('ru: «телефонов samsung» — строгий матч через стеммер', () => {
    expect(run('телефонов samsung')).toEqual(['1']);
    expect(run('телефонах samsung')).toEqual(['1']);
  });

  it('ru: «наушников» находит «наушники»', () => {
    expect(run('наушников')).toEqual(['2']);
    expect(run('беспроводных наушниках')).toEqual(['2']);
  });

  it('es: «telefonos» находит «Teléfono» (мн. число)', () => {
    // es-каталог на кубинской витрине: множественное число в запросе —
    // единственное число в каталоге
    const esCatalog = [
      { id: '1', fields: ['Teléfono inteligente Samsung Galaxy S23', ['Electrónica']] },
      { id: '2', fields: ['Auriculares inalámbricos Sony WH-1000XM4', ['Electrónica']] },
    ];
    const runEs = (query: string) =>
      searchFilter(esCatalog, query, (item) => item.fields).map((p) => p.id);
    expect(runEs('telefonos')).toEqual(['1']);
    expect(runEs('auriculares')).toEqual(['2']);
  });

  it('частичный матч сохраняется при промахе формы', () => {
    // «телефонов» в каталоге №2 нет — «наушников sony» не опустошает выдачу
    expect(run('наушников sony')).toEqual(['2']);
  });
});

// ─── searchFilter — опечатки (fuzzy-матчинг со словами соломы) ───────────

describe('searchFilter: опечатки (fuzzy)', () => {
  const catalog = [
    { id: '1', fields: ['Смартфон Samsung Galaxy S23', ['Электроника', 'Смартфоны']] },
    { id: '2', fields: ['Беспроводные наушники Sony WH-1000XM4', ['Электроника']] },
    { id: '3', fields: ['Ноутбук Apple MacBook Pro 16', ['Электроника', 'Ноутбуки']] },
  ];
  const run = (query: string) =>
    searchFilter(catalog, query, (item) => item.fields).map((p) => p.id);

  it('одна опечатка в бренде: «samsng» находит Samsung', () => {
    expect(run('samsng')).toEqual(['1']);
  });

  it('опечатка в слове: «galaxi» и «soni» находят товар', () => {
    expect(run('galaxi')).toEqual(['1']);
    expect(run('soni')).toEqual(['2']);
  });

  it('опечатка в номере модели (лишний символ): «wh1000xm4s» находит WH-1000XM4', () => {
    // 10 символов → допуск 2 правки; точной подстроки нет, fuzzy матчит слово «1000xm4»
    expect(run('wh1000xm4s')).toEqual(['2']);
  });

  it('все токены с опечатками — полный охват запроса ранится выше частичного', () => {
    // «samsng galaxi»: оба токена fuzzy у товара 1; у остальных нет и двух совпадений
    expect(run('samsng galaxi')).toEqual(['1']);
  });

  it('точные матчи не ниже fuzzy, при равном счёте порядок каталога сохраняется', () => {
    // «soni samsng»: у 2 — «soni» fuzzy (dist 1), у 1 — «samsng» fuzzy (dist 1);
    // ровный счёт (0 точных, 1 fuzzy, dist 1 у обоих) — стабильная сортировка
    // сохраняет порядок каталога
    expect(run('soni samsng')).toEqual(['1', '2']);
    // «soni 1000xm4»: у 2 оба токена (soni fuzzy + точный номер) — полный охват
    expect(run('soni 1000xm4')).toEqual(['2']);
  });

  it('короткие токены (2 символа) fuzzy не получают — только точный матч', () => {
    expect(run('hp')).toEqual([]);
    expect(run('16')).toEqual(['3']);
  });

  it('две правки в коротком слове не матчатся (защита от ложных совпадений)', () => {
    // «gtxy» — 2 правки от «galaxy», но токен 4 символов → допуск 1
    expect(run('gtxy')).toEqual([]);
  });
});

// ─── searchFilter — транслитерация (бренд кириллицей) ────────────────────

describe('searchFilter: транслитерация', () => {
  const catalog = [
    { id: '1', fields: ['Смартфон Samsung Galaxy S23', ['Электроника', 'Смартфоны']] },
    { id: '2', fields: ['Смартфон Xiaomi Redmi Note 12', ['Электроника', 'Смартфоны']] },
    { id: '3', fields: ['Смартфон Apple iPhone 15 Pro', ['Электроника', 'Смартфоны']] },
    {
      id: '4',
      fields: ['Умная колонка Яндекс Станция', specHaystackFields({ Бренд: 'Яндекс' })],
    },
    { id: '5', fields: ['Кофеварка De’Longhi ECAM', specHaystackFields({ Бренд: 'De’Longhi' })] },
  ];
  const fieldsOf = (item: { fields: unknown[] }) => item.fields;
  const run = (query: string) => searchFilter(catalog, query, fieldsOf).map((p) => p.id);

  it('«самсунг» находит Samsung (алиас + транслит)', () => {
    expect(run('самсунг')).toEqual(['1']);
  });

  it('нестандартные написания через алиасы: «сяоми», «ксиоми», «айфон», «делонги»', () => {
    expect(run('сяоми')).toEqual(['2']);
    expect(run('ксиоми')).toEqual(['2']);
    expect(run('айфон')).toEqual(['3']);
    // De’Longhi: апостроф → сепаратор, алиас «делонги» → «delonghi»
    // находит по плотной соломе
    expect(run('делонги')).toEqual(['5']);
  });

  it('латинский «yandex» находит кириллический «Яндекс» из spec-листа', () => {
    expect(run('yandex')).toEqual(['4']);
  });

  it('RU-запрос по es-каталогу: «телефон samsung» через транслит «telefon»', () => {
    const esCatalog = [
      { id: '1', fields: ['Teléfono inteligente Samsung Galaxy S23', ['Electrónica']] },
      { id: '2', fields: ['Auriculares Sony WH-1000XM4', ['Electrónica']] },
    ];
    const runEs = (query: string) =>
      searchFilter(esCatalog, query, (item) => item.fields).map((p) => p.id);
    // «телефон» → транслит «telefon» ⊂ «telefono» — строгий матч по обоим токенам
    expect(runEs('телефон samsung')).toEqual(['1']);
    expect(runEs('сони')).toEqual(['2']);
  });

  it('опечатка в кириллическом бренде: «сансунг» находит Samsung (транслит + fuzzy)', () => {
    // «сансунг» → транслит «sansung», дистанция 1 от «samsung»
    expect(run('сансунг')).toEqual(['1']);
  });

  it('смесь сценариев: «сони вх 1000» находит Sony WH-1000XM4', () => {
    const sonyCatalog = [
      { id: '2', fields: ['Беспроводные наушники Sony WH-1000XM4', ['Электроника']] },
    ];
    const fields = (item: { fields: unknown[] }) => item.fields;
    expect(searchFilter(sonyCatalog, 'сони вх 1000', fields).map((p) => p.id)).toEqual(['2']);
  });
});

// ─── suggestSearchCorrection — «возможно, вы имели в виду» ───────────────

describe('suggestSearchCorrection', () => {
  const catalog = [
    {
      id: '1',
      fields: ['Смартфон Samsung Galaxy S23', ['Электроника', 'Смартфоны']],
    },
    {
      id: '2',
      fields: ['Беспроводные наушники Sony WH-1000XM4', ['Электроника']],
    },
    {
      id: '3',
      fields: ['Ноутбук Apple MacBook Pro 16', ['Электроника', 'Ноутбуки']],
    },
  ];
  const fieldsOf = (item: { fields: unknown[] }) => item.fields;
  const suggest = (query: string) => suggestSearchCorrection(catalog, query, fieldsOf);

  it('лёгкие опечатки (1 правка) теперь находит сам поиск — подсказка не нужна', () => {
    // «samsuna» — dist 1 от «samsung»: fuzzy-матч в выдаче → исправление не требуется
    expect(suggest('samsuna galaxy')).toBe(null);
    // «наушнки» → стем «наушнк» (суффикс «и» отрезан), dist 2 от «наушники» —
    // выше допуска выдачи (1) → подсказка ведёт на полное слово
    expect(suggest('наушнки')).toBe('наушники');
  });

  it('опечатка за пределами fuzzy-допуска исправляется словом каталога', () => {
    // «samsumk» — dist 2 от «samsung» (fuzzy-допуск для 7 символов — 1,
    // в выдачу не попадает), допуск подсказки — 3; «galaxy» совпал
    // и остался как набрано
    expect(suggest('samsumk galaxy')).toBe('Samsung galaxy');
    // «наушникаааа» — dist 3 от «наушники» (стем «наушникааа»)
    expect(suggest('наушникаааа')).toBe('наушники');
  });

  it('всё совпало → null (подсказка не нужна)', () => {
    expect(suggest('samsung galaxy')).toBe(null);
    expect(suggest('sony')).toBe(null);
  });

  it('нет кандидата в словаре → null', () => {
    expect(suggest('ииииии')).toBe(null);
    expect(suggest('xperia zzzz')).toBe(null);
  });

  it('короткий мусор выбрасывается, остальное исправляется (как у маркетплейсов)', () => {
    // «sony zq» — «zq» короткое и не подстрока каталога (в отличие от «xy»,
    // которая находится внутри «galaXY»), выбрасывается → подсказка «sony»
    expect(suggest('sony zq')).toBe('sony');
  });

  it('исправление гарантирует непустую выдачу (тяжёлые опечатки в двух словах)', () => {
    const correction = suggest('наушникаааа sonyii');
    expect(correction).toBe('наушники Sony');
    // обратный прогон: исправленный запрос реально находит товары
    expect(searchFilter(catalog, correction ?? '', fieldsOf).length).toBeGreaterThan(0);
  });

  it('пустой/короткий запрос → null', () => {
    expect(suggestSearchCorrection(catalog, '', fieldsOf)).toBe(null);
    expect(suggestSearchCorrection(catalog, 'sa', fieldsOf)).toBe(null);
  });

  it('подсказка не теряет вид пользователя для совпавших слов', () => {
    // совпавший токен остаётся как набран (регистр сохраняется),
    // исправленное слово — в виде каталога
    expect(suggest('GALAXY samsumk')).toBe('GALAXY Samsung');
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
    'телефонов samsung',
    'portátiles',
    'наушнки',
    // транслитерация и алиасы
    'самсунг',
    'сяоми',
    'ксиоми',
    'айфон',
    'делонги',
    'сони вх 1000',
    'yandex',
    // fuzzy-опечатки
    'samsng',
    'soni',
    'сансунг',
    'wh1000xm4s',
    '',
    '   ',
  ];
  const fieldSets = [
    ['Teléfono inteligente', undefined, ['Electrónica']],
    ['Смартфон Samsung', 'Описание', ['Электроника', 'Смартфоны']],
    [] as string[],
  ];
  const items = fieldSets.map((fields, id) => ({ id: String(id), fields }));
  const specSets = [
    { Бренд: 'Samsung', Экран: '6,1" AMOLED' } as Record<string, string>,
    { Бренд: 'De’Longhi' } as Record<string, string>,
    {},
  ];

  it.each(texts.map((t) => [t]))('fold совпадает для %j', (text) => {
    expect(foldSearchTextServer(text)).toEqual(foldSearchText(text));
  });

  it.each(queries.map((q) => [q]))('токены совпадают для %j', (query) => {
    expect(tokenizeSearchQueryServer(query)).toEqual(tokenizeSearchQuery(query));
  });

  it.each(queries.map((q) => [q]))('варианты токенов совпадают для %j', (query) => {
    for (const token of tokenizeSearchQuery(query)) {
      expect(searchTokenVariantsServer(token)).toEqual(searchTokenVariants(token));
    }
  });

  it.each(texts.map((t) => [t]))('стеммер совпадает для %j', (text) => {
    const token = tokenizeSearchQuery(text)[0] ?? '';
    expect(stemSearchTokenServer(token)).toEqual(stemSearchToken(token));
  });

  it.each(texts.map((t) => [t]))('стеммер совпадает для слова %j', (text) => {
    const word = text.split(' ')[0] ?? '';
    expect(stemSearchTokenServer(word)).toEqual(stemSearchToken(word));
  });

  it.each(fieldSets.map((f) => [f]))('haystack совпадает для %j', (fields) => {
    expect(buildSearchHaystackServer(fields)).toEqual(buildSearchHaystack(fields));
  });

  it.each(specSets.map((s) => [s]))('spec-поля совпадают для %j', (specs) => {
    expect(specHaystackFieldsServer(specs)).toEqual(specHaystackFields(specs));
  });

  it.each(queries.map((q) => [q]))('фильтр совпадает для запроса %j', (query) => {
    const fieldsOf = (item: { fields: unknown[] }) => item.fields;
    expect(searchFilterServer(items, query, fieldsOf)).toEqual(
      searchFilter(items, query, fieldsOf),
    );
  });

  it.each(queries.map((q) => [q]))('исправление совпадает для запроса %j', (query) => {
    const fieldsOf = (item: { fields: unknown[] }) => item.fields;
    expect(suggestSearchCorrectionServer(items, query, fieldsOf)).toEqual(
      suggestSearchCorrection(items, query, fieldsOf),
    );
  });
});
