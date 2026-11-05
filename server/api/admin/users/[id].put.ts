// server/api/admin/users/[id].put.ts
// Редактирование профиля пользователя администратором:
// имя, email (с проверкой уникальности), телефон, адрес.
// Роль меняется отдельным эндпоинтом [id]/role.put.ts, удаление — [id].delete.ts.
// Смена email безопасна для активных сессий: сессии хранят userId, не email.
import { readUsers, writeUsers, stripPassword, type User } from '../../../lib/userHelpers';
import { requireAdmin } from '../../../utils/auth';
import { adminActionLog } from '../../../lib/logger';

// Практичный формат-чек (полный RFC 5322 не нужен — ловим опечатки вида «a@b»)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default defineEventHandler(async (event) => {
  const adminUser = await requireAdmin(event);

  const userId = getRouterParam(event, 'id');
  const body = await readBody<{
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    address?: unknown;
  }>(event);

  const users = await readUsers(event);
  const userIndex = users.findIndex((u) => u.id === userId);
  // Сужение вместо проверки index (noUncheckedIndexedAccess)
  const targetUser = users[userIndex];
  if (!targetUser) {
    throw createError({ statusCode: 404, message: 'Пользователь не найден' });
  }

  // Имя: необязательное в теле (не передали — оставляем прежнее)
  let name = targetUser.name;
  if (body?.name !== undefined) {
    name = String(body.name).trim();
    // Лимиты согласованы с self-сервисом auth/profile.put.ts (2–50)
    if (name.length < 2 || name.length > 50) {
      throw createError({ statusCode: 400, message: 'Имя должно содержать от 2 до 50 символов' });
    }
  }

  // Email: формат + уникальность среди ДРУГИХ пользователей (без регистра)
  let email = targetUser.email;
  if (body?.email !== undefined) {
    email = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw createError({ statusCode: 400, message: 'Некорректный email' });
    }
    if (users.some((u) => u.id !== targetUser.id && u.email?.toLowerCase() === email)) {
      throw createError({ statusCode: 409, message: 'Пользователь с таким email уже существует' });
    }
  }

  // Телефон/адрес: пустая строка = «не указан», лимиты — защита от мусора
  let phone = targetUser.phone;
  if (body?.phone !== undefined) {
    phone = String(body.phone).trim();
    if (phone.length > 30) {
      throw createError({ statusCode: 400, message: 'Телефон: максимум 30 символов' });
    }
  }
  let address = targetUser.address;
  if (body?.address !== undefined) {
    address = String(body.address).trim();
    if (address.length > 200) {
      throw createError({ statusCode: 400, message: 'Адрес: максимум 200 символов' });
    }
  }

  const updatedUser: User = {
    ...targetUser,
    name,
    email,
    phone,
    address,
    updatedAt: new Date().toISOString(),
  };
  users[userIndex] = updatedUser;
  await writeUsers(event, users);

  // В журнал — только реально изменившиеся поля (экономия места в KV-логе)
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (targetUser.name !== updatedUser.name)
    changes.name = { from: targetUser.name, to: updatedUser.name };
  if (targetUser.email !== updatedUser.email)
    changes.email = { from: targetUser.email, to: updatedUser.email };
  if (targetUser.phone !== updatedUser.phone)
    changes.phone = { from: targetUser.phone, to: updatedUser.phone };
  if (targetUser.address !== updatedUser.address)
    changes.address = { from: targetUser.address, to: updatedUser.address };

  adminActionLog.add({
    action: 'USER_PROFILE_UPDATED',
    admin: { id: adminUser.id, email: adminUser.email },
    targetUser: { id: targetUser.id, email: updatedUser.email },
    changedFields: Object.keys(changes),
    changes,
  });

  return { success: true, user: stripPassword(updatedUser), message: 'Профиль обновлён' };
});
