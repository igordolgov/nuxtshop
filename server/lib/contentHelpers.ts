// server/lib/contentHelpers.ts — редактируемый контент сайта в KV.
// Зеркало паттерна newsHelpers, но проще: контент — один JSON-объект,
// запись идёт ЦЕЛИКОМ из админки (без read-modify-write на сервере),
// поэтому TTL-кэш не нужен и неопасен — читаем KV напрямую (как каталог).
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import { mergeSiteContent, type SiteContent } from '../../shared/siteContent';

export const CONTENT_KEY = 'data:content';

export {
  ContentValidationError,
  DEFAULT_SITE_CONTENT,
  CONTENT_LIMITS,
  mergeSiteContent,
  normalizePhoneHref,
  sanitizeSiteContent,
} from '../../shared/siteContent';

/**
 * Читает контент из KV; пустое/частичное хранилище достраивается до
 * полной формы дефолтами (mergeSiteContent не бросает никогда).
 */
export async function readContent(event: H3Event): Promise<SiteContent> {
  const stored = await kvGetJSON<unknown>(event, CONTENT_KEY);
  return mergeSiteContent(stored);
}

/** Единственная точка записи: объект ЦЕЛИКОМ (валидация типа). */
export async function writeContent(event: H3Event, content: SiteContent): Promise<void> {
  if (!content || typeof content !== 'object' || !content.contacts || !content.about) {
    throw new Error('Content must be a full SiteContent object');
  }
  await kvPutJSON(event, CONTENT_KEY, content);
}
