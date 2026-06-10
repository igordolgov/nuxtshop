// server/api/admin/users/[id]/role.put.js
import { readUsers, writeUsers } from '../../../../lib/userHelpers.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Функция логирования действий админа
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

// Получение сессии из куки
const getSessionFromCookie = (event) => {
  const sessionCookie = getCookie(event, 'user_session')
  if (!sessionCookie) return null
  
  try {
    return JSON.parse(sessionCookie)
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  try {
    console.log('🔄 PUT /api/admin/users/[id]/role - обновление роли')
    
    // ====== ПРОВЕРКА ПРАВ АДМИНА ======
    const session = getSessionFromCookie(event)
    
    if (!session?.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Требуется авторизация'
      })
    }
    
    const adminUser = session.user
    
    if (adminUser.role !== 'admin') {
      console.log('⛔ Доступ запрещен. Роль:', adminUser.role)
      
      await logAdminAction('UNAUTHORIZED_ROLE_CHANGE_ATTEMPT', {
        attemptedBy: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role
        }
      })
      
      throw createError({
        statusCode: 403,
        statusMessage: 'Доступ запрещен. Требуются права администратора'
      })
    }
    
    console.log('✅ Админ подтвержден:', adminUser.email)
    
    // ====== ОСНОВНАЯ ЛОГИКА ======
    const userId = getRouterParam(event, 'id')
    const body = await readBody(event)
    
    if (!body.role || !['user', 'manager', 'admin'].includes(body.role)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Недопустимая роль'
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
    const oldRole = targetUser.role
    
    // Обновляем роль
    users[userIndex] = {
      ...targetUser,
      role: body.role,
      updatedAt: new Date().toISOString()
    }

    await writeUsers(users)

    // ====== ЛОГИРОВАНИЕ ======
    await logAdminAction('USER_ROLE_CHANGED', {
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name
      },
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name
      },
      roleChange: { from: oldRole, to: body.role }
    })

    const { password, ...userWithoutPassword } = users[userIndex]

    console.log('✅ Роль обновлена:', targetUser.email, oldRole, '→', body.role)

    return {
      success: true,
      user: userWithoutPassword,
      message: 'Роль обновлена'
    }

  } catch (error) {
    console.error('❌ Ошибка:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Ошибка сервера'
    })
  }
})