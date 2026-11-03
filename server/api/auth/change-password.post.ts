// server/api/auth/change-password.post.ts
// Смена пароля из «Настроек» (/settings): проверяем текущий пароль,
// хэшируем новый, гасим все другие сессии пользователя (защита от
// скомпрометированного пароля — текущая сессия остаётся активной).
import { readUsers, writeUsers } from '../../lib/userHelpers';
import { comparePassword, hashPassword } from '../../lib/password';
import { destroyOtherSessions } from '../../lib/sessions';
import { requireUser, SESSION_COOKIE } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const current = await requireUser(event);
  const body = await readBody<{ currentPassword?: unknown; newPassword?: unknown }>(event);

  const currentPassword = String(body?.currentPassword ?? '');
  const newPassword = String(body?.newPassword ?? '');

  if (!currentPassword || !newPassword) {
    throw createError({ statusCode: 400, message: 'Заполните текущий и новый пароль' });
  }
  if (newPassword.length < 6) {
    throw createError({
      statusCode: 400,
      message: 'Новый пароль должен содержать минимум 6 символов',
    });
  }
  if (newPassword === currentPassword) {
    throw createError({ statusCode: 400, message: 'Новый пароль должен отличаться от текущего' });
  }

  const users = await readUsers(event);
  const user = users.find((u) => u.id === current.id);
  if (!user) throw createError({ statusCode: 404, message: 'Пользователь не найден' });

  if (!(await comparePassword(currentPassword, user.password ?? ''))) {
    throw createError({ statusCode: 400, message: 'Текущий пароль неверен' });
  }

  user.password = await hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  await writeUsers(event, users);

  const otherSessionsEnded = await destroyOtherSessions(
    event,
    user.id,
    getCookie(event, SESSION_COOKIE),
  );

  return { success: true, otherSessionsEnded, message: 'Пароль изменён' };
});
