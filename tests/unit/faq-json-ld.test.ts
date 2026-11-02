// Тесты app/utils/faqJsonLd.ts — сборка FAQPage-разметки из видимого на
// странице списка FAQ (фильтр пустых записей) и сериализация с экранированием
// `<` (защита от преждевременного закрытия тега script в head).
import { describe, expect, it } from 'vitest';

import { buildFaqJsonLd, serializeJsonLd } from '../../app/utils/faqJsonLd';

const entry = (q: string, a: string) => ({ q, a });

describe('buildFaqJsonLd', () => {
  it('собирает FAQPage из вопросов-ответов', () => {
    const ld = buildFaqJsonLd([
      entry('Как быстро вы доставляете?', 'Заказы до 18:00 отправляем в тот же день.'),
      entry('Как вернуть товар?', 'В течение 14 дней.'),
    ]);
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Как быстро вы доставляете?',
          acceptedAnswer: { '@type': 'Answer', text: 'Заказы до 18:00 отправляем в тот же день.' },
        },
        {
          '@type': 'Question',
          name: 'Как вернуть товар?',
          acceptedAnswer: { '@type': 'Answer', text: 'В течение 14 дней.' },
        },
      ],
    });
  });

  it('пропускает записи без вопроса или ответа (в т.ч. из пробелов)', () => {
    const ld = buildFaqJsonLd([
      entry('Есть ответ', 'Да'),
      entry('', 'Ответ без вопроса'),
      entry('Вопрос без ответа', ''),
      entry('   ', '   '),
      // битые записи без полей — админ-контент может прийти каким угодно
      { q: 'Только вопрос' } as never,
      null as never,
    ]);
    expect(ld?.mainEntity).toHaveLength(1);
    expect(ld?.mainEntity[0].name).toBe('Есть ответ');
  });

  it('пустой/отсутствующий список → null (скрипт не регистрируется)', () => {
    expect(buildFaqJsonLd([])).toBeNull();
    expect(buildFaqJsonLd(null)).toBeNull();
    expect(buildFaqJsonLd(undefined)).toBeNull();
    expect(buildFaqJsonLd([entry('', 'пусто')])).toBeNull();
  });
});

describe('serializeJsonLd', () => {
  it('экранирует <, чтобы "</script>" не закрыл тег в head', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script>');
    // JSON остаётся валидным после обратной замены экранирования
    expect(JSON.parse(out.replace(/\\u003c/g, '<'))).toEqual({
      name: '</script><script>alert(1)</script>',
    });
  });

  it('пустое значение → пустая строка (innerHTML без скрипта)', () => {
    expect(serializeJsonLd(null)).toBe('');
    expect(serializeJsonLd(undefined)).toBe('');
  });
});
