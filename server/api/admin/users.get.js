// server/api/admin/users.get.js
import { readUsers } from '../../lib/userHelpers.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Логирование доступа
const logAdminAccess = async (admin, action) => {
  try {
    const logDir = join(process.cwd(), 'server', 'logs')
    const logFile = join(logDir, 'admin-access.json')
    
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
    
    let logs = []
    if (existsSync(logFile)) {
      logs = JSON.parse(readFileSync(logFile, 'utf-8') || '[]')
    }
    
    logs.unshift({
      timestamp: new Date().toISOString(),
      admin: { id: admin.id, email: admin.email },
      action
    })
    
    if (logs.length > 500) logs = logs.slice(0, 500)
    writeFileSync(logFile, JSON.stringify(logs, null, 2))
  } catch (e) {
    console.error('Ошибка логирования:', e)
  }
}

export default defineEventHandler(async (event) => {
  try {
    console.log('👥 GET /api/admin/users - запрос списка пользователей')
    
    // ====== ПРОВЕРКА ПРАВ ======
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
      throw createError({
        statusCode: 403,
        statusMessage: 'Доступ запрещен. Требуются права администратора'
      })
    }

    // ====== ПОЛУЧАЕМ ПАРАМЕТРЫ ======
    const query = getQuery(event)
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 50
    const role = query.role // Фильтр по роли
    const search = query.search?.toLowerCase() // Поиск по имени/email
    const sortBy = query.sortBy || 'createdAt'
    const sortOrder = query.sortOrder || 'desc'

    // ====== ЧИТАЕМ ПОЛЬЗОВАТЕЛЕЙ ======
    const users = await readUsers()
    console.log(`📊 Загружено пользователей: ${users.length}`)

    // ====== ФИЛЬТРАЦИЯ ======
    let filteredUsers = [...users]
    
    if (role && ['admin', 'manager', 'user'].includes(role)) {
      filteredUsers = filteredUsers.filter(u => u.role === role)
    }
    
    if (search) {
      filteredUsers = filteredUsers.filter(u => 
        u.name?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search) ||
        u.phone?.includes(search)
      )
    }

    // ====== СОРТИРОВКА ======
    filteredUsers.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aVal = new Date(aVal || 0).getTime()
        bVal = new Date(bVal || 0).getTime()
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

    // ====== ПАГИНАЦИЯ ======
    const total = filteredUsers.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const paginatedUsers = filteredUsers.slice(offset, offset + limit)

    // ====== УБИРАЕМ ПАРОЛИ ======
    const safeUsers = paginatedUsers.map(({ password, ...user }) => ({
      ...user,
      hasPassword: !!password
    }))

    // ====== ЛОГИРОВАНИЕ ДОСТУПА ======
    await logAdminAccess(adminUser, 'VIEW_USERS_LIST')

    console.log(`✅ Возвращаем ${safeUsers.length} из ${total} пользователей`)

    return {
      success: true,
      users: safeUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      },
      filters: {
        role: role || null,
        search: search || null
      }
    }

  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error)
    
    // Для ошибок авторизации возвращаем статус ошибки
    if (error.statusCode) {
      throw error
    }
    
    return {
      success: false,
      error: error.message,
      users: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false }
    }
  }
})