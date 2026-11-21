// app/utils/searchQuery.ts
// ── Токенизация и нормализация поисковых запросов витрины ────────────────
//
// ПРОБЛЕМА (отзыв с кубинской витрины: «поиск не ищет ничего»): прежний
// поиск сравнивал сырые подстроки — всё, что не совпало байт в байт,
// давало «Ничего не найдено»:
//   «telefono» ≠ «Teléfono…»  — испанская аудитория часто печатает без
//                               ударений (CU-витрина, es-локаль);
//   «galaxy samsung» ≠ «…Samsung Galaxy…» — порядок слов в запросе;
//   «Samsung␣␣Galaxy␣» ≠ «Samsung Galaxy» — двойной/концевой пробел;
//   «wh1000xm4» ≠ «WH-1000XM4» — склеенный номер модели.
//   «телефон samsung» — одно слово мимо («смартфон» = смарт+фон, «е» нет)
//   опустошало ВСЮ выдачу, хотя самсунги в каталоге есть.
//
// РЕШЕНИЕ (как у маркетплейсов): запрос токенизируется, поля товара
// складываются в одну «солому» (haystack), совпадение = КАЖДЫЙ токен
// найден в соломе; когда строгих совпадений нет — деградация до
// частичного (хоть один токен), отсортированного по релевантности:
// пустая выдача только если не нашлось НИ ОДНОГО токена.
//   1. fold: lowercase + NFD + срез combining-меток — «é→e», «ñ→n»,
//      «ё→е» (у ё есть canonical decomposition на е + U+0308);
//   2. separator-fold: не-буквы/не-цифры → один пробел — «wh-1000» →
//      «wh 1000», дефисы/запятые/слэши больше не рвут совпадение;
//   3. tight-вариант без пробелов: «wh1000xm4» находит «WH-1000XM4»;
//   4. морфология: лёгкий стеммер токенов запроса («телефонов» →
//      «телефон»), бренды-алиасы стеммером не режутся;
//   5. опечатки (fuzzy): токен, не найденный точно, матчится со словами
//      соломы с допуском Дамерау–Левенштейна — «samsng», «galaxi»,
//      «soni» находят товар напрямую. Допуск консервативный (1 правка,
//      для слов от 8 символов — 2), чтобы не заливать выдачу ложными
//      совпадениями; точные матчи всегда ранжируются выше fuzzy;
//   6. транслитерация: кириллический запрос разворачивается в латинские
//      варианты («самсунг» → «samsung», «телефон» → «telefon») — бренд,
//      набранный русскими буквами, находит латинское название; таблица
//      алиасов симметрична, поэтому и латинский запрос находит
//      кириллический текст каталога («yandex» → «Яндекс» из spec-листа).
//
// Тяжёлые опечатки (3+ правки), которые консервативный fuzzy сознательно
// не тащит в выдачу, остаются на слое «возможно, вы имели в виду» —
// suggestSearchCorrection с увеличенным допуском (2/3 правки).
//
// ЧИСТЫЕ функции без зависимостей от Vue/Nuxt: используются в
// useAppState (подсказки), useFilters (сетка каталога), catalogProduct
// (поиск по сырому каталогу), useSearchHighlight (токены для подсветки)
// и в юнит-тестах. Серверу нужна СВОЯ копия — server/lib/searchQuery.ts:
// vite-SSR выносит модули вне srcDir (app/) во внешние импорты, в
// серверном бандле оставался бы сырой путь на .ts (см. localizedProduct.ts).
// Дрейф копий ловит тест «searchQuery: server/app copies are in sync».

const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;
/** Не-буквы/не-цифры (дефисы, запятые, кавычки, слэши…): сепаратор-fold. */
const NON_ALNUM_RE = /[^\p{L}\p{N}]+/gu;
/** Токен содержит хотя бы одну букву (номера моделей не стеммятся). */
const HAS_LETTER_RE = /\p{L}/u;
/** Токен содержит кириллицу → нужны латинские варианты (транслитерация). */
const HAS_CYRILLIC_RE = /[\u0400-\u04FF]/u;

/**
 * Нормализация букв: lowercase + NFD + срез диакритики.
 * «Teléfono» → «telefono», «Año» → «ano», «Ёлка» → «елка».
 */
export function foldSearchText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS_RE, '');
}

/**
 * Сепаратор-нормализация: fold + не-буквы/не-цифры → один пробел + trim.
 * «WH-1000XM4» → «wh 1000xm4», «6,1" AMOLED» → «6 1 amoled».
 */
function separatorFold(text: string): string {
  return foldSearchText(text).replace(NON_ALNUM_RE, ' ').trim();
}

// ── Морфология: лёгкий стеммер токенов запроса ──────────────────────────
//
// Запрос «телефонов» должен находить «Телефон»/«Телефоны» (как у
// маркетплейсов). Полный Snowball не нужен: совпадение в searchFilter —
// ПОДСТРОЧНОЕ, поэтому стеммер применяется ТОЛЬКО к токенам ЗАПРОСА.
// Стем всегда префикс исходного токена (отрезаем только конец), значит
// исходная форма в соломе матчится как раньше, а все формы каталога,
// начинающиеся с того же стема, находятся автоматически:
//   «телефонов» → «телефон» ✓ (телефон/телефоны/телефоне),
//   «наушники» → «наушник» ✓, «portátiles» → «portatil» ✓, «phones» → «phone» ✓.
// Один слой суффикса, общий список ru/en/es (длинные — первыми).

const STEM_SUFFIXES = [
  // ru: косвенные падежи множественного («наушниками» → «наушник»)
  'ами',
  'ями',
  // ru: прилагательные, дательный/творительный («красивому» → «красив»)
  'ому',
  // ru: родительный/винительный множественного («телефонов» → «телефон»)
  'ов',
  'ев',
  'ей',
  // ru: прилагательные («беспроводные» → «беспроводн», «большой» → «больш»)
  'ий',
  'ый',
  'ой',
  'ая',
  'ое',
  'ые',
  'ым',
  'ых',
  // ru: предложный/дательный множественного («наушниках» → «наушник»)
  'ах',
  'ях',
  'ам',
  'ям',
  // ru: винительный прилагательных/мн. («интересную» → «интересн»)
  'ую',
  // en/es: множественное («accessories» → «accessor», «portátiles» → «portatil»)
  'ies',
  'es',
  'os',
  'as',
  // ru: падежи единственного числа («телефоне» → «телефон»)
  'а',
  'я',
  'ы',
  'и',
  'у',
  'ю',
  'е',
  'о',
  // en/es: множественное («phones» → «phone», «gafas» → «gafa»)
  's',
] as const;

/** Стем не короче 4 символов: короткие слова («часы», «для», «sony») не режем —
 *  агрессивная резка коротких даёт ложные совпадения («для» → «дл» = «длина»). */
const MIN_STEM_LENGTH = 4;

// ── Транслитерация: кириллический запрос → латинские варианты ────────────
//
// Пользователь набирает бренд русскими буквами: «самсунг» должен найти
// «Samsung». Два слоя:
//   1. Таблица алиасов для НЕСТАНДАРТНЫХ латинских написаний — бренды,
//     которые посимвольный транслит не восстанавливает: «сяоми» →
//     «xiaomi» (ся≠xi), «айфон» → «iphone» (фон≠phone), «сони» → «sony»
//     (и≠y). Список симметричный: латинский запрос находит и
//     кириллический текст каталога («yandex» → «Яндекс» из spec-листа).
//   2. Общий посимвольный транслит с альтернативами («х» → h, «в» → v/w —
//     «вифи» → «wifi», «й» → i/y) — покрывает регулярные случаи:
//     «самсунг» → «samsung», «телефон» → «telefon» ⊂ «Teléfono».
// Варианты ищутся в той же соломе (haystack.includes) — только ДОБАВЛЯЮТ
// совпадения, существующий матчинг не сужают.

const CYR_TRANSLIT: Readonly<Record<string, readonly string[]>> = {
  а: ['a'],
  б: ['b'],
  в: ['v', 'w'],
  г: ['g', 'h'],
  д: ['d'],
  е: ['e'],
  ж: ['zh', 'j'],
  з: ['z'],
  и: ['i'],
  й: ['i', 'y'],
  к: ['k'],
  л: ['l'],
  м: ['m'],
  н: ['n'],
  о: ['o'],
  п: ['p'],
  р: ['r'],
  с: ['s'],
  т: ['t'],
  у: ['u'],
  ф: ['f'],
  х: ['h'],
  ц: ['ts', 'c'],
  ч: ['ch'],
  ш: ['sh'],
  щ: ['shch', 'sch'],
  ъ: [''],
  ы: ['y', 'i'],
  ь: [''],
  э: ['e'],
  ю: ['yu', 'u'],
  я: ['ya', 'a'],
};

/** Лимит вариантов на токен: альтернативы ×2–3 на букву взрываются на
 *  длинных словах — за лимитом берём только первичный вариант буквы. */
const MAX_TOKEN_VARIANTS = 8;

/**
 * Бренд-алиасы [кириллица, латиница] — оба направления в ALIAS_MAP.
 * Каталог магазина (data/products.json): Samsung, Sony, Xiaomi, Apple,
 * De'Longhi, Garmin, JBL, Logitech, Nintendo, Razer, Seagate, Tefal,
 * Bosch, Braun, Canon, Dell + «Яндекс» кириллицей; плюс ходовые бренды
 * и продукты, которых нет сейчас, но запрос на них уже работает.
 */
const BRAND_ALIAS_PAIRS: ReadonlyArray<readonly [cyrillic: string, latin: string]> = [
  ['самсунг', 'samsung'],
  ['сони', 'sony'],
  ['сяоми', 'xiaomi'],
  ['ксиоми', 'xiaomi'],
  ['шаоми', 'xiaomi'],
  ['сиаоми', 'xiaomi'],
  ['редми', 'redmi'],
  ['поко', 'poco'],
  ['хуавей', 'huawei'],
  ['хонор', 'honor'],
  ['эпл', 'apple'],
  ['эппл', 'apple'],
  ['айфон', 'iphone'],
  ['айпад', 'ipad'],
  ['макбук', 'macbook'],
  ['аирподс', 'airpods'],
  ['эйрподс', 'airpods'],
  ['асус', 'asus'],
  ['асер', 'acer'],
  ['леново', 'lenovo'],
  ['делл', 'dell'],
  ['дэлл', 'dell'],
  ['мси', 'msi'],
  ['лджи', 'lg'],
  ['канон', 'canon'],
  ['бош', 'bosch'],
  ['браун', 'braun'],
  ['тефаль', 'tefal'],
  ['тефал', 'tefal'],
  ['гармин', 'garmin'],
  ['логитек', 'logitech'],
  ['лоджитек', 'logitech'],
  ['нинтендо', 'nintendo'],
  ['рейзер', 'razer'],
  ['разер', 'razer'],
  ['сигейт', 'seagate'],
  ['сиагейт', 'seagate'],
  ['сиигейт', 'seagate'],
  ['джбл', 'jbl'],
  ['делонги', 'delonghi'],
  ['дэлонги', 'delonghi'],
  ['делонхи', 'delonghi'],
  ['филипс', 'philips'],
  ['панасоник', 'panasonic'],
  ['тосиба', 'toshiba'],
  ['яндекс', 'yandex'],
];

/** Токен → варианты: ключи алиасов в ОБА направления (алиас-цель тоже
 *  может встретиться в каталоге своим написанием). Ключи фолдятся при
 *  построении: NFD-фолд превращает «й» → «и» (й = и + breve, как «ё» → «е»),
 *  поэтому ключ «айфон» в карте — «аифон»; токены в searchFilter приходят
 *  уже фолднутыми, а прямой вызов searchTokenVariants фолдит сам. */
const ALIAS_MAP: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  const push = (key: string, value: string) => {
    const list = map.get(key);
    if (list) {
      if (!list.includes(value)) list.push(value);
    } else {
      map.set(key, [value]);
    }
  };
  for (const [cyrillic, latin] of BRAND_ALIAS_PAIRS) {
    const folded = foldSearchText(cyrillic);
    push(folded, latin); // кириллический запрос → латинский бренд
    push(latin, folded); // латинский запрос → кириллический текст каталога
  }
  return map;
})();

/** Ключи алиасов стеммером не режутся: «сяоми» кончается на «и» и без
 *  защиты стеммер отрезал бы суффикс («сяоми» → «сяом»), потеряв алиас. */
const ALIAS_KEYS: ReadonlySet<string> = new Set(ALIAS_MAP.keys());

/**
 * Посимвольный транслит с альтернативами: декартово произведение
 * вариантов букв с лимитом MAX_TOKEN_VARIANTS — за лимитом только
 * первичные (самые частые) варианты. Не-кириллические символы
 * проходят как есть (смешанный ввод «сamsung» чинится тоже).
 */
function translitVariants(token: string): string[] {
  let acc: string[] = [''];
  for (const ch of token) {
    const options = CYR_TRANSLIT[ch];
    if (!options) {
      acc = acc.map((stem) => stem + ch);
      continue;
    }
    if (acc.length * options.length > MAX_TOKEN_VARIANTS) {
      acc = acc.map((stem) => stem + (options[0] ?? ''));
    } else {
      const next: string[] = [];
      for (const stem of acc) {
        for (const option of options) next.push(stem + option);
      }
      acc = next;
    }
  }
  return acc;
}

/**
 * Все варианты токена для матчинга: сам токен + алиасы + (для
 * кириллицы) посимвольный транслит. Первый элемент — исходный токен.
 * Используется поиском (searchFilter) и подсветкой подсказок
 * (useSearchHighlight — «самсунг» выделяет «Samsung» жирным).
 */
export function searchTokenVariants(token: string): string[] {
  const variants = [token];
  const push = (candidate: string) => {
    if (candidate && !variants.includes(candidate)) variants.push(candidate);
  };
  const aliases = ALIAS_MAP.get(foldSearchText(token));
  if (aliases) for (const alias of aliases) push(alias);
  if (HAS_CYRILLIC_RE.test(token)) {
    for (const variant of translitVariants(token)) push(variant);
  }
  return variants;
}

/**
 * Лёгкий стеммер: отрезает ОДИН морфологический суффикс (самый длинный
 * подходящий, остаток ≥ 4 символа). Токены без букв («1000», «xm4»,
 * «wh1000xm4»), короткие слова и ключи алиасов не трогаются.
 * Безопасность гарантирована префиксной семантикой подстрочного матча:
 * стем ⊂ токен, поэтому исходная форма находится как раньше, ложные
 * промахи исключены.
 */
export function stemSearchToken(token: string): string {
  if (!HAS_LETTER_RE.test(token) || ALIAS_KEYS.has(token)) return token;
  for (const suffix of STEM_SUFFIXES) {
    if (token.length > suffix.length && token.endsWith(suffix)) {
      const stem = token.slice(0, token.length - suffix.length);
      if (stem.length >= MIN_STEM_LENGTH) return stem;
    }
  }
  return token;
}

/**
 * Токены запроса: fold + сепараторы → пробел + сплит + стемминг. Двойные и
 * концевые пробелы, дефисы и прочая пунктуация не ломают поиск; формы слов
 * («телефонов», «наушники», «portátiles», «phones») сводятся к стему:
 * «Samsung␣␣Galaxy␣» → ['samsung', 'galaxy'], «WH-1000» → ['wh', '1000'].
 */
export function tokenizeSearchQuery(query: string): string[] {
  return separatorFold(query).split(/\s+/).filter(Boolean).map(stemSearchToken);
}

/**
 * «Солома» для поиска: все поля одного товара (название, описание,
 * категории…) в одной нормализованной строке. Массивы (категории,
 * переводы) разворачиваются с тем же весом, пустые поля пропускаются.
 */
export function buildSearchHaystack(
  fields: ReadonlyArray<string | string[] | null | undefined>,
): string {
  const parts: string[] = [];
  for (const field of fields) {
    if (Array.isArray(field)) {
      for (const item of field) {
        if (typeof item === 'string' && item) parts.push(item);
      }
    } else if (typeof field === 'string' && field) {
      parts.push(field);
    }
  }
  return separatorFold(parts.join(' '));
}

// ── Опечатки: fuzzy-матчинг токена со словами соломы ─────────────────────

/**
 * Расстояние Дамерау–Левенштейна (оптимальное выравнивание строк,
 * с транспозицией соседних символов: «смартфно» → «смартфон») с ранним
 * отсечением: если расстояние заведомо больше cutoff, возвращается
 * cutoff + 1. Слова словаря короткие — полный DP дёшев.
 */
function damerauLevenshtein(a: string, b: string, cutoff: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cutoff) return cutoff + 1;

  const blen = b.length;
  const emptyRow = () => new Array<number>(blen + 1).fill(0);
  let prev2 = emptyRow(); // строка i-2
  let prev = emptyRow(); // строка i-1
  let cur = emptyRow(); // строка i
  for (let j = 0; j <= blen; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= blen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      // Ячейки заполняются всегда; «??» — только для noUncheckedIndexedAccess
      let d = Math.min(
        (prev[j] ?? cutoff + 1) + 1,
        (cur[j - 1] ?? cutoff + 1) + 1,
        (prev[j - 1] ?? cutoff + 1) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, (prev2[j - 2] ?? cutoff + 1) + 1); // транспозиция
      }
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > cutoff) return cutoff + 1;
    // Ротация буферов: prev2 ← i-1, prev ← i; cur переиспользуется на i+1
    // (заполняется целиком на каждой строке — содержимое можно не чистить;
    // у обычного Array нет TypedArray.set — только перестановка ссылок)
    const tmp = prev2;
    prev2 = prev;
    prev = cur;
    cur = tmp;
  }
  // noUncheckedIndexedAccess: финальная ячейка заполнена всегда — фолбэк
  // оставлен для типов (не влияет на поведение)
  return prev[blen] ?? cutoff + 1;
}

/**
 * Допуск fuzzy в ВЫДАЧЕ — консервативный, чтобы не заливать результаты
 * ложными совпадениями: 1 правка для токенов 3–7 символов, 2 правки для
 * длинных (от 8), коротышам (< 3) fuzzy не положен вовсе (двухбуквенный
 * «hp» с одной правкой матчится с половиной каталога). Тяжёлые опечатки
 * (3+ правок) берёт на себя suggestSearchCorrection с допуском 2/3.
 */
function fuzzyCutoff(token: string): number {
  if (token.length >= 8) return 2;
  if (token.length >= 3) return 1;
  return 0;
}

/** Уникальные слова соломы длиной ≥ 3: словарь для fuzzy-матчинга
 *  (дедуп — бренд в названии и характеристиках считается один раз). */
function haystackWords(haystack: string): string[] {
  const words = haystack.split(' ');
  return [...new Set(words.filter((word) => word.length >= 3))];
}

/** Качество матча токена: 2 — точный (подстрока/плотный), 1 — fuzzy
 *  (Дамерау–Левенштейн со словом соломы в допуске), 0 — мимо. */
type TokenMatch = { quality: 0 | 1 | 2; distance: number };

function tokenMatchQuality(
  variants: readonly string[],
  haystack: string,
  tight: string,
  words: readonly string[],
  cutoff: number,
): TokenMatch {
  // Точный матч: любой вариант — подстрока соломы (или плотной соломы)
  for (const variant of variants) {
    if (haystack.includes(variant)) return { quality: 2, distance: 0 };
    if (variant && tight.includes(variant)) return { quality: 2, distance: 0 };
  }
  // Fuzzy: токен/вариант против слов соломы. Минимальная дистанция 1 —
  // дистанция 0 означала бы точный матч, найденный выше.
  let best: TokenMatch = { quality: 0, distance: Number.MAX_SAFE_INTEGER };
  if (cutoff > 0) {
    for (const variant of variants) {
      for (const word of words) {
        if (Math.abs(variant.length - word.length) > cutoff) continue;
        const distance = damerauLevenshtein(variant, word, cutoff);
        if (distance <= cutoff && distance < best.distance) {
          best = { quality: 1, distance };
          if (best.distance === 1) return best; // лучше не бывает в fuzzy
        }
      }
    }
  }
  return best;
}

/**
 * Поиск по списку: сперва матч ВСЕХ токенов запроса (точных и fuzzy —
 * полный охват запроса важнее способа совпадения), при пустом —
 * ЧАСТИЧНЫЙ (хоть один токен). Ранжирование внутри группы: больше точных
 * токенов → больше всего совпавших → ближе суммарная дистанция опечаток
 * (V8 sort стабилен — при равном счёте порядок каталога сохраняется).
 *
 * Один механизм для панели подсказок и сетки каталога: счётчик
 * «Показать все результаты (N)» всегда совпадает с числом карточек,
 * а подсказки показывают самые близкие товары, вместо «Ничего не найдено»
 * при одном промахнувшемся слове («телефон samsung» находит самсунги).
 */
export function searchFilter<T>(
  items: readonly T[],
  query: string | null | undefined,
  fieldsOf: (item: T) => ReadonlyArray<string | string[] | null | undefined>,
): T[] {
  const tokens = tokenizeSearchQuery(query ?? '');
  if (tokens.length === 0) return [...items];

  // Варианты и допуски токенов одинаковы для всех товаров — считаем раз
  const variantLists = tokens.map(searchTokenVariants);
  const cutoffs = tokens.map(fuzzyCutoff);

  const scored: Array<{ item: T; exact: number; matched: number; distance: number; all: boolean }> =
    [];

  for (const item of items) {
    const haystack = buildSearchHaystack(fieldsOf(item));
    const tight = haystack.replace(/\s+/g, '');
    const words = haystackWords(haystack);
    let exact = 0;
    let matched = 0;
    let distance = 0;
    for (const [i, variants] of variantLists.entries()) {
      const quality = tokenMatchQuality(variants, haystack, tight, words, cutoffs[i] ?? 0);
      if (quality.quality === 2) {
        exact++;
        matched++;
      } else if (quality.quality === 1) {
        matched++;
        distance += quality.distance;
      }
    }
    if (matched === tokens.length) scored.push({ item, exact, matched, distance, all: true });
    else if (matched > 0) scored.push({ item, exact, matched, distance, all: false });
  }

  const full = scored.filter((entry) => entry.all);
  const pool = full.length > 0 ? full : scored;
  return pool
    .sort((a, b) => b.exact - a.exact || b.matched - a.matched || a.distance - b.distance)
    .map((entry) => entry.item);
}

/**
 * Характеристики товара для соломы: «лейбл значение» построчно — поиск
 * находит бренд и значения spec-листа («Snapdragon», «AMOLED», «IP68»;
 * «De'Longhi» → плотный матч «delonghi» по tight-соломе). Пусто/не объект
 * → null (buildSearchHaystack пропускает). Локализация уже внутри: на
 * en/es localizedProduct подменяет characteristics переводом.
 */
export function specHaystackFields(
  characteristics?: Record<string, string> | null,
): string[] | null {
  if (!characteristics || typeof characteristics !== 'object') return null;
  const fields = Object.keys(characteristics).map((label) => `${label} ${characteristics[label]}`);
  return fields.length > 0 ? fields : null;
}

// ── «Возможно, вы имели в виду» (подсказки-подобия) ──────────────────────
//
// Паттерн Amazon/Ozon/WB: запрос не нашёл НИЧЕГО → ближайшие слова
// каталога предлагаются исправлением запроса. Словарь строится из полей
// товаров (частота = скольким товарам слово встречается), промахнувшиеся
// токены заменяются ближайшим словом словаря (Дамерау–Левенштейн),
// мусорные короткие слова выбрасываются, а исправление проверяется
// обратным прогоном searchFilter: подсказка НИКОГДА не ведёт на новую
// пустую выдачу.
//
// После появления fuzzy в выдаче у слоя осталась СВОЯ роль: допуск
// исправления (2/3 правки) больше допуска выдачи (1/2) — тяжёлые
// опечатки, сознательно не тащащие ложные совпадения в результаты,
// всё равно приводят пользователя к товару через подсказку.

type CorrectionWord = { display: string; count: number };

/** Порог исправления: короткие слова — 2 правки, длинные — 3
 *  (щедрее выдачи: подсказка не заливает результаты ложными матчами). */
function correctionCutoff(token: string): number {
  return token.length <= 5 ? 2 : 3;
}

/** Лучший кандидат словаря для токена: меньше дистанция → чаще в каталоге. */
function bestVocabMatch(token: string, vocab: Map<string, CorrectionWord>): string | null {
  const cutoff = correctionCutoff(token);
  let best: CorrectionWord | null = null;
  let bestDistance = cutoff;
  for (const [folded, word] of vocab) {
    // Отсечение по рекорду: дистанция выше лучшей не считается до конца
    const distance = damerauLevenshtein(
      token,
      folded,
      bestDistance < cutoff ? bestDistance : cutoff,
    );
    if (distance > cutoff || distance > bestDistance) continue;
    // Равная дистанция — редкое слово каталога не перебивает частое
    if (distance === bestDistance && best && word.count <= best.count) continue;
    best = word;
    bestDistance = distance;
    if (distance === 0) break; // точное совпадение со словарём — единственно
  }
  return best ? best.display : null;
}

/**
 * Исправленный запрос для пустой выдачи (или null). Промахнувшиеся токены
 * заменяются ближайшим словом каталога, короткий мусор (< 3 симв.) и слова
 * без кандидата выбрасываются; совпавшие токены (включая fuzzy — с ним
 * выдача уже не пуста и слой подсказок не вызывается) остаются в исходном
 * виде пользователя. Подсказка обязана давать НЕПУСТУЮ выдачу (проверка
 * обратным прогоном searchFilter).
 */
export function suggestSearchCorrection<T>(
  items: readonly T[],
  query: string | null | undefined,
  fieldsOf: (item: T) => ReadonlyArray<string | string[] | null | undefined>,
): string | null {
  const rawQuery = query ?? '';
  const tokens = tokenizeSearchQuery(rawQuery);
  if (tokens.length === 0) return null;

  const variantLists = tokens.map(searchTokenVariants);
  const fuzzyCutoffs = tokens.map(fuzzyCutoff);

  const haylists: Array<{ haystack: string; tight: string; words: string[] }> = [];
  const vocab = new Map<string, CorrectionWord>();
  for (const item of items) {
    const fields = fieldsOf(item);
    const haystack = buildSearchHaystack(fields);
    haylists.push({
      haystack,
      tight: haystack.replace(/\s+/g, ''),
      words: haystackWords(haystack),
    });
    // Словарь: слова полей каталога (частота — по числу товаров, не
    // повторов внутри одного описания)
    const seen = new Set<string>();
    for (const field of fields) {
      const texts = Array.isArray(field) ? field : [field];
      for (const text of texts) {
        if (typeof text !== 'string' || !text) continue;
        for (const word of text.split(NON_ALNUM_RE)) {
          if (!word || word.length < 3) continue;
          const folded = foldSearchText(word);
          if (folded.length < 3 || seen.has(folded)) continue;
          seen.add(folded);
          const entry = vocab.get(folded);
          if (entry) entry.count++;
          else vocab.set(folded, { display: word, count: 1 });
        }
      }
    }
  }

  // Сырые слова запроса 1:1 с токенами (separatorFold гонит каждую цепочку
  // вне букв/цифр в один токен): исправление собирается в исходном виде
  const rawWords = rawQuery.split(NON_ALNUM_RE).filter(Boolean);

  const corrected: string[] = [];
  let hasReplacement = false;
  for (const [i, token] of tokens.entries()) {
    const matched = haylists.some(
      (h) =>
        tokenMatchQuality(
          variantLists[i] ?? [token],
          h.haystack,
          h.tight,
          h.words,
          fuzzyCutoffs[i] ?? 0,
        ).quality > 0,
    );
    if (matched) {
      corrected.push(rawWords[i] ?? token);
      continue;
    }
    hasReplacement = true;
    if (token.length < 3) continue; // мусорное короткое слово — выбрасываем
    const candidate = bestVocabMatch(token, vocab);
    if (candidate) corrected.push(candidate);
    // кандидата нет — слово выбрасывается, как у маркетплейсов
  }

  if (!hasReplacement) return null; // все токены и так совпали
  const result = corrected.join(' ').trim();
  if (!result || foldSearchText(result) === foldSearchText(rawQuery)) return null;
  // Гарантия маркетплейсов: подсказка не ведёт на новую пустую выдачу
  if (searchFilter(items, result, fieldsOf).length === 0) return null;
  return result;
}
