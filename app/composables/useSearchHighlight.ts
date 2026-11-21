// composables/useSearchHighlight.ts
// Подсветка совпадений в панели подсказок: токены запроса (та же
// нормализация, что в поиске — utils/searchQuery.ts) выделяются жирным
// (.search-highlight), без заливки (см. SmartSearchInput).
//
// Подсветка ДИАКРИТИКО-НЕЗАВИСИМАЯ: запрос «telefono» выделяет
// «Teléfono» — иначе товар найден, а жирным не выделено ничего и
// подсказка выглядит как «поиск нашёл, но не то». Совпадения ищутся в
// ПОСИМВОЛЬНОМ fold-слепке текста с обратной картой индексов (folded[i]
// ↔ символ text[map[i]]): вывод собирается из ИСХОДНЫХ символов —
// оригинальный текст сохраняется байт в байт (é остаётся precomposed,
// NFD-нормализация вывода не нужна), а combining-метки в исходном NFD-
// тексте корректно попадают в выделенный диапазон.
//
// Куски токенов (алф.-цифр. цепочки) матчатся независимо: «wh 1000»
// выделит и «WH», и «1000» в «WH-1000XM4», как у маркетплейсов.
//
// Стем-куски (токенизация стеммит запрос: «телефонов» → «телефон»)
// расширяются до конца слова: совпадение найдено по префиксу — выделяется
// ВСЁ слово («Телефоны», «Teléfono»), как у маркетплейсов, а не голый стем.
// Расширение только ВПРАВО по буквам/цифрам fold-слепка (сепаратор
// останавливает), назад не тянется: «phone» внутри «Smartphone» не
// расширяется до целого слова.
//
// Мёртвые экспорты (containsQuery/highlightBadge/isQueryValidForHighlight)
// удалены: использовались только внутри composable.

import { tokenizeSearchQuery } from '../utils/searchQuery';

const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;
/** Алф.-цифр. куски токена: «wh 1000» → ['wh', '1000']. */
const CHUNK_SPLIT_RE = /[^\p{L}\p{N}]+/u;
/** Буква/цифра для расширения совпадения до конца слова. */
const ALNUM_RE = /[\p{L}\p{N}]/u;

/** Посимвольный fold той же семантики, что foldSearchText в searchQuery.ts. */
const foldChar = (ch: string): string =>
  ch.toLowerCase().normalize('NFD').replace(COMBINING_MARKS_RE, '');

export const useSearchHighlight = () => {
  // Экранирование HTML (клиент; вне браузера — ручная замена, витест в node)
  const escapeHtml = (text?: unknown): string => {
    if (!text) return '';
    const str = String(text);
    if (typeof document === 'undefined') {
      return str.replace(
        /[&<>"']/g,
        (ch) =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
      );
    }
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const highlightText = (
    text?: unknown,
    query?: string | null,
    highlightClass = 'search-highlight',
  ): string => {
    if (!text || typeof text !== 'string') return escapeHtml(text);

    // Куски токенов запроса (≥2 символов — как раньше у запроса целиком):
    // «samsung galaxy» → ['samsung', 'galaxy'], «wh 1000» → ['wh', '1000']
    const chunks = tokenizeSearchQuery(query ?? '')
      .flatMap((token) => token.split(CHUNK_SPLIT_RE))
      .filter((chunk) => chunk.length >= 2);
    if (!chunks.length) return escapeHtml(text);

    // Посимвольный fold-слепок с картой индексов: folded[i] ↔ map[i]-й
    // символ оригинала. Пустой fold (combining-метка) — символ пропускается.
    const chars = [...text];
    const foldedChars: string[] = [];
    const map: number[] = [];
    chars.forEach((ch, idx) => {
      // for…of по строке итерирует кодпойнты (не UTF-16-юниты) —
      // сурогатные пары и диакритика обрабатываются корректно
      for (const folded of foldChar(ch)) {
        foldedChars.push(folded);
        map.push(idx);
      }
    });
    const folded = foldedChars.join('');

    // Диапазоны совпадений в координатах кодпойнтов оригинала
    const ranges: Array<{ start: number; end: number }> = [];
    for (const chunk of chunks) {
      let from = 0;
      for (;;) {
        const at = folded.indexOf(chunk, from);
        if (at === -1) break;
        let last = at + chunk.length - 1;
        // Стем-кусок — префикс слова: тянем совпадение до конца слова
        // (по буквам/цифрам в fold-слепке, сепараторы останавливают):
        // «телефон» выделяет «Телефоны» целиком, а не «Телефон» без «ы»
        while (last + 1 < folded.length && ALNUM_RE.test(folded[last + 1])) last++;
        ranges.push({
          start: map[at],
          end: (last < map.length ? map[last] : map[map.length - 1]) + 1,
        });
        from = at + chunk.length;
      }
    }
    if (!ranges.length) return escapeHtml(text);

    // Слить пересекающиеся/смежные диапазоны (куски могут наложиться)
    ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: Array<{ start: number; end: number }> = [];
    for (const range of ranges) {
      const prev = merged[merged.length - 1];
      if (prev && range.start <= prev.end) prev.end = Math.max(prev.end, range.end);
      else merged.push({ ...range });
    }

    // Сборка из оригинальных символов: текст вне совпадений сохраняется как есть
    let result = '';
    let cursor = 0;
    for (const { start, end } of merged) {
      result += escapeHtml(chars.slice(cursor, start).join(''));
      result += `<span class="${highlightClass}">${escapeHtml(chars.slice(start, end).join(''))}</span>`;
      cursor = end;
    }
    result += escapeHtml(chars.slice(cursor).join(''));
    return result;
  };

  return { highlightText };
};
