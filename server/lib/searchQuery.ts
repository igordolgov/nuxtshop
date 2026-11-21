// server/lib/searchQuery.ts
// ── Серверная копия app/utils/searchQuery.ts (токенизация, нормализация
//    и фильтр поиска для /api/products?search=). Копия нужна потому, что
//    vite-SSR выносит модули вне srcDir (app/) во внешние импорты —
//    серверный бандл оставался бы с сырым путём на .ts (см.
//    localizedProduct.ts). Дрейф копий ловит тест
//    «searchQuery: server/app copies are in sync».
//
// ЧИСТЫЕ функции без зависимостей от Vue/Nuxt: серверный потребитель —
// /api/products?search= (сырой каталог в базовых полях; локализованный
// поиск витрины идёт на клиенте по локализованным копиям).

const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;
/** Не-буквы/не-цифры (дефисы, запятые, кавычки, слэши…): сепаратор-fold. */
const NON_ALNUM_RE = /[^\p{L}\p{N}]+/gu;
/** Токен содержит хотя бы одну букву (номера моделей не стеммятся). */
const HAS_LETTER_RE = /\p{L}/u;

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
 * Токены запроса: fold + сепараторы → пробел + сплит + стемминг. Двойные и
 * концевые пробелы, дефисы и прочая пунктуация не ломают поиск; формы слов
 * («телефонов», «наушники», «portátiles», «phones») сводятся к стему:
 * «Samsung␣␣Galaxy␣» → ['samsung', 'galaxy'], «WH-1000» → ['wh', '1000'].
 */
export function tokenizeSearchQuery(query: string): string[] {
  return separatorFold(query).split(/\s+/).filter(Boolean).map(stemSearchToken);
}

// ── Морфология: лёгкий стеммер токенов запроса (зеркало app/utils) ──────
//
// Стем применяется ТОЛЬКО к токенам ЗАПРОСА: совпадение подстрочное,
// стем — всегда префикс исходного токена (отрезаем только конец), значит
// исходная форма в соломе матчится как раньше, а все формы каталога,
// начинающиеся с того же стема, находятся автоматически:
//   «телефонов» → «телефон», «наушники» → «наушник»,
//   «portátiles» → «portatil», «phones» → «phone».
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

/**
 * Лёгкий стеммер: отрезает ОДИН морфологический суффикс (самый длинный
 * подходящий, остаток ≥ 4 символов). Токены без букв («1000», «xm4»,
 * «wh1000xm4») и короткие слова не трогаются. Безопасность гарантирована
 * префиксной семантикой подстрочного матча: стем ⊂ токен, поэтому исходная
 * форма находится как раньше, ложные промахи исключены.
 */
export function stemSearchToken(token: string): string {
  if (!HAS_LETTER_RE.test(token)) return token;
  for (const suffix of STEM_SUFFIXES) {
    if (token.length > suffix.length && token.endsWith(suffix)) {
      const stem = token.slice(0, token.length - suffix.length);
      if (stem.length >= MIN_STEM_LENGTH) return stem;
    }
  }
  return token;
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

/**
 * Характеристики товара для соломы: «лейбл значение» построчно — поиск
 * находит бренд и значения spec-листа («Snapdragon», «AMOLED», «IP68»;
 * «De'Longhi» → плотный матч «delonghi» по tight-соломе). Пусто/не объект
 * → null (buildSearchHaystack пропускает).
 */
export function specHaystackFields(
  characteristics?: Record<string, string> | null,
): string[] | null {
  if (!characteristics || typeof characteristics !== 'object') return null;
  const fields = Object.keys(characteristics).map((label) => `${label} ${characteristics[label]}`);
  return fields.length > 0 ? fields : null;
}

// ── «Возможно, вы имели в виду» (подсказки-подобия) — зеркало app/utils ──
//
// Паттерн Amazon/Ozon/WB: запрос не нашёл НИЧЕГО → ближайшие слова
// каталога предлагаются исправлением запроса. Словарь строится из полей
// товаров (частота = скольким товарам слово встречается), промахнувшиеся
// токены заменяются ближайшим словом словаря (Дамерау–Левенштейн),
// мусорные короткие слова выбрасываются, а исправление проверяется
// обратным прогоном searchFilter: подсказка НИКОГДА не ведёт на новую
// пустую выдачу.

type CorrectionWord = { display: string; count: number };

/** Порог исправления: короткие слова — 1 правка, длинные — 2. */
function correctionCutoff(token: string): number {
  return token.length <= 5 ? 1 : 2;
}

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
 * без кандидата выбрасываются; совпавшие токены остаются в исходном виде
 * пользователя. Подсказка обязана давать НЕПУСТУЮ выдачу (проверка обратным
 * прогоном searchFilter).
 */
export function suggestSearchCorrection<T>(
  items: readonly T[],
  query: string | null | undefined,
  fieldsOf: (item: T) => ReadonlyArray<string | string[] | null | undefined>,
): string | null {
  const rawQuery = query ?? '';
  const tokens = tokenizeSearchQuery(rawQuery);
  if (tokens.length === 0) return null;

  const haylists: Array<{ haystack: string; tight: string }> = [];
  const vocab = new Map<string, CorrectionWord>();
  for (const item of items) {
    const fields = fieldsOf(item);
    const haystack = buildSearchHaystack(fields);
    haylists.push({ haystack, tight: haystack.replace(/\s+/g, '') });
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
    const matched = haylists.some((h) => tokenMatches(token, h.haystack, h.tight));
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
