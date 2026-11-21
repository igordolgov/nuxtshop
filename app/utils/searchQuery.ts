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
//   «wh1000xm4» vs «WH-1000XM4» — склеенный номер модели.
//   «телефон samsung» — одно слово мимо («смартфон» = смарт+фон, «е» нет)
//   опустошало ВСЮ выдачу, хотя самсунги в каталоге есть.
//
// РЕШЕНИЕ (как у маркетплейсов): запрос токенизируется, поля товара
// складываются в одну «солому» (haystack), совпадение = КАЖДЫЙ токен
// найден в соломе; когда строгих совпадений нет — деградация до
// частичного (хоть один токен), отсортированного по числу совпавших
// токенов: пустая выдача только если не нашлось НИ ОДНОГО токена.
//   1. fold: lowercase + NFD + срез combining-меток — «é→e», «ñ→n»,
//      «ё→е» (у ё есть canonical decomposition на е + U+0308);
//   2. separator-fold: не-буквы/не-цифры → один пробел — «wh-1000» →
//      «wh 1000», дефисы/запятые/слэши больше не рвут совпадение;
//   3. tight-вариант без пробелов: «wh1000xm4» находит «WH-1000XM4».
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

/**
 * Токены запроса: fold + сепараторы → пробел + сплит. Двойные и концевые
 * пробелы, дефисы и прочая пунктуация больше не ломают поиск:
 * «Samsung␣␣Galaxy␣» → ['samsung', 'galaxy'], «WH-1000» → ['wh', '1000'].
 */
export function tokenizeSearchQuery(query: string): string[] {
  return separatorFold(query).split(/\s+/).filter(Boolean);
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

/** Токен найден в соломе: точный подстрочный или плотный (без пробелов). */
function tokenMatches(token: string, haystack: string, tight: string): boolean {
  if (haystack.includes(token)) return true;
  const tightToken = token.replace(/\s+/g, '');
  return tightToken.length > 0 && tight.includes(tightToken);
}

/**
 * Поиск по списку: сперва СТРОГИЙ матч (каждый токен запроса найден),
 * при пустом строгом — ЧАСТИЧНЫЙ (хоть один токен), отсортированный по
 * числу совпавших токенов (V8 sort стабилен — при равном счёте порядок
 * каталога сохраняется). Пустой запрос — весь список без фильтрации.
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

  const strict: T[] = [];
  const partial: Array<{ item: T; matched: number }> = [];

  for (const item of items) {
    const haystack = buildSearchHaystack(fieldsOf(item));
    const tight = haystack.replace(/\s+/g, '');
    let matched = 0;
    for (const token of tokens) {
      if (tokenMatches(token, haystack, tight)) matched++;
    }
    if (matched === tokens.length) strict.push(item);
    else if (matched > 0) partial.push({ item, matched });
  }

  if (strict.length > 0) return strict;
  return partial.sort((a, b) => b.matched - a.matched).map((entry) => entry.item);
}
