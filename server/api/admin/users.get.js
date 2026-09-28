// server/api/admin/users.get.js
import { readUsers } from '../../lib/userHelpers.js'
import { adminAccessLog } from '../../lib/logger.js'

export default defineEventHandler(async (event) => {
  try {
    console.log('👥 GET /api/admin/users - запрос списка пользователей')

    // ====== ПРОВЕРКА ПРАВ ======
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
      throw createError({
        statusCode: 403,
        statusMessage: 'Доступ запрещен. Требуются права администратора',
      })
    }

    // ====== ПАРАМЕТРЫ ======
    const query = getQuery(event)
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 50
    const role = query.role
    const search = query.search?.toLowerCase()
    const sortBy = query.sortBy || 'createdAt'
    const sortOrder = query.sortOrder || 'desc'

    // ====== ЧИТАЕМ ПОЛЬЗОВАТЕЛЕЙ ======
    const users = await readUsers()
    console.log(`📊 Загружено пользователей: ${users.length}`)

    // ====== ФИЛЬТРАЦИЯ ======
    let filteredUsers = [...users]

    if (role && ['admin', 'manager', 'user'].includes(role)) {
      filteredUsers = filteredUsers.filter((u) => u.role === role)
    }

    if (search) {
      filteredUsers = filteredUsers.filter(
        (u) =>
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

      if (sortOrder === 'asc') return aVal > bVal ? 1 : -1
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
      hasPassword: !!password,
    }))

    adminAccessLog.add({
      admin: { id: adminUser.id, email: adminUser.email },
      action: 'VIEW_USERS_LIST',
    })

    console.log(`✅ Возвращаем ${safeUsers.length} из ${total} пользователей`)

    return {
      success: true,
      users: safeUsers,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
      filters: { role: role || null, search: search || null },
    }
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error)

    if (error.statusCode) throw error

    return {
      success: false,
      error: error.message,
      users: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false },
    }
  }
})