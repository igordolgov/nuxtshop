// tests/unit/search-highlight.test.ts
// ── Подсветка совпадений в панели подсказок (useSearchHighlight) ─────────
//
// Ключевые регрессы:
// 1. Диакритика: запрос «telefono» выделяет «Teléfono» — подсветка работает
//    той же нормализацией, что и поиск (раньше товар находился только при
//    точном подстрочном совпадении, а подсветка «молчала» бы);
// 2. Оригинальный текст сохраняется байт в байт (é остаётся precomposed);
// 3. Токены и куски подсвечиваются по отдельности («samsung galaxy»,
//    «wh 1000» в «WH-1000XM4»);
// 4. HTML-экранирование текста вне совпадений.

import { describe, expect, it } from 'vitest';
import { useSearchHighlight } from '../../app/composables/useSearchHighlight';

const { highlightText } = useSearchHighlight();

describe('useSearchHighlight.highlightText', () => {
  it('точное совпадение: регистр и текст сохраняются', () => {
    expect(highlightText('Смартфон Samsung Galaxy S23', 'samsung')).toBe(
      'Смартфон <span class="search-highlight">Samsung</span> Galaxy S23',
    );
  });

  it('диакритика: «telefono» выделяет «Teléfono» целиком', () => {
    expect(highlightText('Teléfono inteligente', 'telefono')).toBe(
      '<span class="search-highlight">Teléfono</span> inteligente',
    );
  });

  it('ё → е: «елочные» выделяет «Ёлочные»', () => {
    expect(highlightText('Ёлочные игрушки', 'елочные')).toBe(
      '<span class="search-highlight">Ёлочные</span> игрушки',
    );
  });

  it('токены запроса выделяются по отдельности', () => {
    expect(highlightText('Смартфон Samsung Galaxy S23', 'samsung galaxy')).toBe(
      'Смартфон <span class="search-highlight">Samsung</span> <span class="search-highlight">Galaxy</span> S23',
    );
  });

  it('двойные пробелы в запросе не ломают подсветку', () => {
    expect(highlightText('Samsung Galaxy S23', 'Samsung  Galaxy ')).toBe(
      '<span class="search-highlight">Samsung</span> <span class="search-highlight">Galaxy</span> S23',
    );
  });

  it('куски токена: «wh 1000» выделяет «WH» и «1000XM4» в «WH-1000XM4»', () => {
    expect(highlightText('Auriculares Sony WH-1000XM4', 'wh 1000')).toBe(
      'Auriculares Sony <span class="search-highlight">WH</span>-<span class="search-highlight">1000XM4</span>',
    );
  });

  it('стем запроса выделяет слово ЦЕЛИКОМ (маркетплейс-паттерн)', () => {
    // «телефонов» → стем «телефон» — префикс «Телефоны»: выделяется всё слово
    expect(highlightText('Телефоны и смартфоны', 'телефонов')).toBe(
      '<span class="search-highlight">Телефоны</span> и смартфоны',
    );
    // расширение вправо останавливается на сепараторе/конце слова
    expect(highlightText('Телевизор, телефон в комплекте', 'телефонов')).toBe(
      'Телевизор, <span class="search-highlight">телефон</span> в комплекте',
    );
  });

  it('внутри слова расширения нет: «phones» выделяет «phone» в «Smartphone» (стем+окончание)', () => {
    // стем «phon» матчится внутри «Smartphone», расширение вправо добавляет
    // «e» — выделяется «phone»-часть целиком; «phones» во втором слове — целиком
    expect(highlightText('Smartphone и phones', 'phones')).toBe(
      'Smart<span class="search-highlight">phone</span> и <span class="search-highlight">phones</span>',
    );
  });

  it('все вхождения токена выделяются', () => {
    expect(highlightText('Samsung Galaxy — Samsung', 'samsung')).toBe(
      '<span class="search-highlight">Samsung</span> Galaxy — <span class="search-highlight">Samsung</span>',
    );
  });

  it('HTML вне совпадений экранируется, внутри — тоже', () => {
    expect(highlightText('a <b> & samsung', 'samsung')).toBe(
      'a &lt;b&gt; &amp; <span class="search-highlight">samsung</span>',
    );
  });

  it('без совпадений — экранированный текст без вставок', () => {
    expect(highlightText('Смартфон <b>', 'iphone')).toBe('Смартфон &lt;b&gt;');
  });

  it('короткий запрос (<2 символов после токенизации) — без подсветки', () => {
    expect(highlightText('Смартфон Samsung', 's')).toBe('Смартфон Samsung');
    expect(highlightText('Смартфон Samsung', '')).toBe('Смартфон Samsung');
    expect(highlightText('Смартфон Samsung', null)).toBe('Смартфон Samsung');
  });

  it('пустой/нестроковый текст — пустая строка', () => {
    expect(highlightText('', 'samsung')).toBe('');
    expect(highlightText(null, 'samsung')).toBe('');
    expect(highlightText(undefined, 'samsung')).toBe('');
  });

  it('кастомный класс подсветки передаётся в спан', () => {
    expect(highlightText('Samsung Galaxy', 'samsung', 'badge-highlight')).toBe(
      '<span class="badge-highlight">Samsung</span> Galaxy',
    );
  });

  it('NFD-исходный текст: combining-метка попадает в выделенный диапазон', () => {
    const nfd = 'Telfono'.replace('Telf', 'Tel\u00e9f'); // Teléfono в NFD: e + U+0301
    const nfdText = 'Tel\u00e9fono inteligente';
    expect(highlightText(nfdText, 'telefono')).toBe(
      '<span class="search-highlight">Teléfono</span> inteligente',
    );
    expect(nfd).toBe('Teléfono');
  });
});
