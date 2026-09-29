// server/utils/auth.ts
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON, kvDelete } from '../lib/storage';
import { readUsers, type User } from '../lib/userHelpers';

const SESSION_COOKIE = 'user_session';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 дней

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(event: H3Event, userId: string) {
  const token = randomToken();
  await kvPutJSON(
    event,
    `session:${token}`,
    { userId, createdAt: new Date().toISOString() },
    SESSION_TTL,
  );
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    // secure-куки браузер не ставит по http — проверяем протокол
    // (workers.dev — https, wrangler dev — http, кука поставится)
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  });
}

/** Полная запись пользователя из KV или null. Неактивные теряют доступ мгновенно. */
export async function getSessionUser(event: H3Event): Promise<User | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const session = await kvGetJSON<{ userId: string }>(event, `session:${token}`);
  if (!session) return null;
  const users = await readUsers(event);
  return users.find((u) => u.id === session.userId && u.isActive !== false) ?? null;
}

export async function destroySession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE);
  if (token) await kvDelete(event, `session:${token}`);
  deleteCookie(event, SESSION_COOKIE, { path: '/' });
}

export async function requireUser(event: H3Event) {
  const user = await getSessionUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' });
  return user;
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event);
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Доступ запрещён. Требуются права администратора',
    });
  }
  return user;
}
