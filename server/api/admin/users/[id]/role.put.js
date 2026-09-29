// server/api/admin/users/[id]/role.put.js
import { readUsers, writeUsers, stripPassword } from '../../../../lib/userHelpers'
import { requireAdmin } from '../../../../utils/auth'
import { adminActionLog } from '../../../../lib/logger'

export default defineEventHandler(async (event) => {
  const adminUser = await requireAdmin(event)

  const userId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!body?.role || !['user', 'manager', 'admin'].includes(body.role)) {
    throw createError({ statusCode: 400, statusMessage: 'Недопустимая роль' })
  }

  const users = await readUsers(event)
  const userIndex = users.findIndex((u) => u.id === userId)
  if (userIndex === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Пользователь не найден' })
  }

  const targetUser = users[userIndex]
  if (targetUser.role === 'admin' && body.role !== 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length
    if (adminCount <= 1) {
      throw createError({ statusCode: 400, statusMessage: 'Нельзя снять роль с последнего администратора' })
    }
  }

  const oldRole = targetUser.role
  users[userIndex] = { ...targetUser, role: body.role, updatedAt: new Date().toISOString() }
  await writeUsers(event, users)

  adminActionLog.add({
    action: 'USER_ROLE_CHANGED',
    admin: { id: adminUser.id, email: adminUser.email },
    targetUser: { id: targetUser.id, email: targetUser.email },
    roleChange: { from: oldRole, to: body.role },
  })

  return { success: true, user: stripPassword(users[userIndex]), message: 'Роль обновлена' }
})