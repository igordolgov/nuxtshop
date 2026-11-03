// app/utils/faqJsonLd.ts — FAQPage JSON-LD (schema.org) для блока «Частые
// вопросы». Google показывает расширенный сниппет только если размеченные
// вопрос-ответы ВИДНЫ пользователю на странице: функция вызывается тем же
// компонентом, который рендерит список, и размечает ровно его содержимое.
import type { FaqEntry } from '../../shared/siteContent';

export interface FaqJsonLd {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: { '@type': 'Answer'; text: string };
  }>;
}

/**
 * Собирает FAQPage-разметку из отрисованного списка FAQ. Записи без
 * вопроса или ответа пропускаются (админка валидирует длины, но пустые
 * значения могли остаться от старого контента). Пустой список → null:
 * useHead не регистрирует пустой скрипт.
 * Чистая функция — покрыта тестами.
 */
export function buildFaqJsonLd(items: FaqEntry[] | null | undefined): FaqJsonLd | null {
  const mainEntity = (items ?? [])
    .filter((f) => typeof f?.q === 'string' && f.q.trim() && typeof f?.a === 'string' && f.a.trim())
    .map((f) => ({
      '@type': 'Question' as const,
      name: f.q,
      acceptedAnswer: { '@type': 'Answer' as const, text: f.a },
    }));
  if (mainEntity.length === 0) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity };
}

/**
 * Сериализация JSON-LD в строку для innerHTML тега script: `<` экранируется,
 * иначе значение поля вида "</script>" закрыло бы тег script в head.
 */
export function serializeJsonLd(value: unknown): string {
  if (!value) return '';
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
