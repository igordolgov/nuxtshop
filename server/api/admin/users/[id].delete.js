// server/api/admin/users/[id].delete.js
import { readUsers, writeUsers } from '../../../lib/userHelpers.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Функция логирования
const logAdminAction = async (action, data) => {
  try {
    const logDir = join(process.cwd(), 'server', 'logs')
    const logFile = join(logDir, 'admin-actions.json')
    
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
    
    let logs = []
    if (existsSync(logFile)) {
      logs = JSON.parse(readFileSync(logFile, 'utf-8') || '[]')
    }
    
    logs.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action,
      ...data
    })
    
    if (logs.length > 1000) logs = logs.slice(0, 1000)
    writeFileSync(logFile, JSON.stringify(logs, null, 2))
  } catch (error) {
    console.error('❌ Ошибка записи лога:', error)
  }
}

export default defineEventHandler(async (event) => {
  try {
    console.log('🗑️ DELETE /api/admin/users/[id] - удаление пользователя')
    
    // ====== ПРОВЕРКА ПРАВ АДМИНА ======
    const userSession = getCookie(event, 'user_session')
    
    if (!userSession) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Требуется авторизация'
      })
    }

    let sessionData
    try {
      sessionData = JSON.parse(userSession)
    } catch {
      throw createError({
        statusCode: 401,
        statusMessage: 'Невалидная сессия'
      })
    }
    
    const adminUser = sessionData?.user
    
    if (!adminUser || adminUser.role !== 'admin') {
      // Логируем попытку несанкционированного доступа
      await logAdminAction('UNAUTHORIZED_DELETE_ATTEMPT', {
        attemptedBy: adminUser ? { id: adminUser.id, email: adminUser.email, role: adminUser.role } : null
      })
      
      throw createError({
        statusCode: 403,
        statusMessage: 'Доступ запрещен. Требуются права администратора'
      })
    }
    
    console.log('✅ Админ подтвержден:', adminUser.email)
    
    // ====== ОСНОВНАЯ ЛОГИКА ======
    const userId = getRouterParam(event, 'id')
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID пользователя не указан'
      })
    }
    
    const users = await readUsers()
    const userIndex = users.findIndex(u => u.id === userId)
    
    if (userIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Пользователь не найден'
      })
    }
    
    const targetUser = users[userIndex]
    
    // Нельзя удалить самого себя
    if (targetUser.id === adminUser.id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Нельзя удалить свою учетную запись'
      })
    }
    
    // Нельзя удалить последнего администратора
    const adminCount = users.filter(u => u.role === 'admin').length
    if (targetUser.role === 'admin' && adminCount <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Нельзя удалить последнего администратора'
      })
    }
    
    // Удаляем пользователя
    users.splice(userIndex, 1)
    await writeUsers(users)
    
    // ====== ЛОГИРОВАНИЕ ======
    await logAdminAction('USER_DELETED', {
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name
      },
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role
      }
    })
    
    console.log('✅ Пользователь удален:', {
      deleted: targetUser.email,
      by: adminUser.email
    })
    
    return {
      success: true,
      message: `Пользователь "${targetUser.name}" (${targetUser.email}) удален`,
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка удаления:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Ошибка сервера'
    })
  }
})