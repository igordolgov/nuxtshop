// server/api/admin/users/[id].delete.js
import { readUsers, writeUsers } from '../../../lib/userHelpers.js'
import { adminActionLog } from '../../../lib/logger.js'

export default defineEventHandler(async (event) => {
  try {
    console.log('🗑️ DELETE /api/admin/users/[id] - удаление пользователя')

    // ====== ПРОВЕРКА ПРАВ АДМИНА ======
    const userSession = getCookie(event, 'user_session')

    if (!userSession) {
      throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' })
    }

    let sessionData
    try {
      sessionData = JSON.parse(userSession)
    } catch {
      throw createError({ statusCode: 401, statusMessage: 'Невалидная сессия' })
    }

    const adminUser = sessionData?.user

    if (!adminUser || adminUser.role !== 'admin') {
      adminActionLog.add({
        action: 'UNAUTHORIZED_DELETE_ATTEMPT',
        attemptedBy: adminUser
          ? { id: adminUser.id, email: adminUser.email, role: adminUser.role }
          : null,
      })

      throw createError({
        statusCode: 403,
        statusMessage: 'Доступ запрещен. Требуются права администратора',
      })
    }

    console.log('✅ Админ подтвержден:', adminUser.email)

    // ====== ОСНОВНАЯ ЛОГИКА ======
    const userId = getRouterParam(event, 'id')

    if (!userId) {
      throw createError({ statusCode: 400, statusMessage: 'ID пользователя не указан' })
    }

    const users = await readUsers()
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      throw createError({ statusCode: 404, statusMessage: 'Пользователь не найден' })
    }

    const targetUser = users[userIndex]

    if (targetUser.id === adminUser.id) {
      throw createError({ statusCode: 400, statusMessage: 'Нельзя удалить свою учетную запись' })
    }

    const adminCount = users.filter((u) => u.role === 'admin').length
    if (targetUser.role === 'admin' && adminCount <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Нельзя удалить последнего администратора',
      })
    }

    users.splice(userIndex, 1)
    await writeUsers(users)

    adminActionLog.add({
      action: 'USER_DELETED',
      admin: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
      },
    })

    console.log('✅ Пользователь удален:', { deleted: targetUser.email, by: adminUser.email })

    return {
      success: true,
      message: `Пользователь "${targetUser.name}" (${targetUser.email}) удален`,
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
    }
  } catch (error) {
    console.error('❌ Ошибка удаления:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Ошибка сервера',
    })
  }
})