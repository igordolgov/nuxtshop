// server/lib/sessions.ts
/**
 * Управление сессиями пользователя: массовая инвалидация «войти заново
 * на других устройствах». Используется сменой пароля (защита от
 * скомпрометированного пароля) и кнопкой «Выйти со всех устройств».
 */

import type { H3Event } from 'h3';
import { kvDelete, kvGetJSON, kvListKeys } from './storage';

const SESSION_PREFIX = 'session:';

export interface SessionRecord {
  userId: string;
  createdAt?: string;
}

/**
 * Чистая функция выбора ключей к инвалидинции: сессии пользователя,
 * кроме текущей (keepKey). Чужие сессии и битые записи не трогаем.
 */
export function sessionsToInvalidate(
  entries: { key: string; record: SessionRecord | null }[],
  userId: string,
  keepKey?: string,
): string[] {
  return entries
    .filter((e) => e.key !== keepKey && e.record?.userId === userId)
    .map((e) => e.key);
}

/**
 * Удаляет все сессии пользователя, кроме текущей (keepKey).
 * keepKey — значение куки user_session (голый токен); здесь он
 * нормализуется в полный ключ session:<token>.
 * Возвращает число завершённых сессий.
 */
export async function destroyOtherSessions(
  event: H3Event,
  userId: string,
  keepKey?: string,
): Promise<number> {
  const keep = keepKey
    ? keepKey.startsWith(SESSION_PREFIX)
      ? keepKey
      : SESSION_PREFIX + keepKey
    : undefined;
  const keys = await kvListKeys(event, SESSION_PREFIX);
  const entries = await Promise.all(
    keys.map(async (key) => ({ key, record: await kvGetJSON<SessionRecord>(event, key) })),
  );
  const stale = sessionsToInvalidate(entries, userId, keep);
  await Promise.all(stale.map((key) => kvDelete(event, key)));
  return stale.length;
}
