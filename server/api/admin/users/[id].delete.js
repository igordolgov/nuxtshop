// server/api/admin/users/[id].delete.js
import { readUsers, writeUsers, stripPassword } from '../../../lib/userHelpers'
import { requireAdmin } from '../../../utils/auth'
import { adminActionLog } from '../../../lib/logger'

export default defineEventHandler(async (event) => {
  const adminUser = await requireAdmin(event)

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'ID пользователя не указан' })
  }

  const users = await readUsers(event)
  const userIndex = users.findIndex((u) => u.id === userId)
  if (userIndex === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Пользователь не найден' })
  }

  const targetUser = users[userIndex]

  if (targetUser.id === adminUser.id) {
    throw createError({ statusCode: 400, statusMessage: 'Нельзя удалить свою учётную запись' })
  }

  const adminCount = users.filter((u) => u.role === 'admin').length
  if (targetUser.role === 'admin' && adminCount <= 1) {
    throw createError({ statusCode: 400, statusMessage: 'Нельзя удалить последнего администратора' })
  }

  users.splice(userIndex, 1)
  await writeUsers(event, users)

  adminActionLog.add({
    action: 'USER_DELETED',
    admin: { id: adminUser.id, email: adminUser.email },
    deletedUser: { id: targetUser.id, email: targetUser.email, role: targetUser.role },
  })

  return {
    success: true,
    message: `Пользователь "${targetUser.name}" (${targetUser.email}) удалён`,
    deletedUser: stripPassword(targetUser),
  }
})