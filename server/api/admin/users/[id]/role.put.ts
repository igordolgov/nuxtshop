// server/api/admin/users/[id]/role.put.ts
import { readUsers, writeUsers, stripPassword, type User } from '../../../../lib/userHelpers';
import { requireAdmin } from '../../../../utils/auth';
import { adminActionLog } from '../../../../lib/logger';

export default defineEventHandler(async (event) => {
  const adminUser = await requireAdmin(event);

  const userId = getRouterParam(event, 'id');
  const body = await readBody<{ role?: string }>(event);

  if (!body?.role || !['user', 'manager', 'admin'].includes(body.role)) {
    throw createError({ statusCode: 400, message: 'Недопустимая роль' });
  }
  // После валидации role — одна из трёх допустимых ролей
  const role = body.role as User['role'];

  const users = await readUsers(event);
  const userIndex = users.findIndex((u) => u.id === userId);
  // Сужение вместо проверки index (noUncheckedIndexedAccess)
  const targetUser = users[userIndex];
  if (!targetUser) {
    throw createError({ statusCode: 404, message: 'Пользователь не найден' });
  }
  if (targetUser.role === 'admin' && role !== 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      throw createError({
        statusCode: 400,
        message: 'Нельзя снять роль с последнего администратора',
      });
    }
  }

  const oldRole = targetUser.role;
  const updatedUser = { ...targetUser, role, updatedAt: new Date().toISOString() };
  users[userIndex] = updatedUser;
  await writeUsers(event, users);

  adminActionLog.add({
    action: 'USER_ROLE_CHANGED',
    admin: { id: adminUser.id, email: adminUser.email },
    targetUser: { id: targetUser.id, email: targetUser.email },
    roleChange: { from: oldRole, to: role },
  });

  return { success: true, user: stripPassword(updatedUser), message: 'Роль обновлена' };
});
