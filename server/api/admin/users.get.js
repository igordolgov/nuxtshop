// server/api/admin/users.get.js
import { readUsers, stripPassword } from '../../lib/userHelpers'
import { requireAdmin } from '../../utils/auth'
import { adminAccessLog } from '../../lib/logger'

export default defineEventHandler(async (event) => {
  try {
    const adminUser = await requireAdmin(event)

    const query = getQuery(event)
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 50
    const role = query.role
    const search = query.search?.toLowerCase()
    const sortBy = query.sortBy || 'createdAt'
    const sortOrder = query.sortOrder || 'desc'

    const users = await readUsers(event)

    let filteredUsers = [...users]

    if (role && ['admin', 'manager', 'user'].includes(role)) {
      filteredUsers = filteredUsers.filter((u) => u.role === role)
    }
    if (search) {
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search) ||
          u.phone?.includes(search),
      )
    }

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

    const total = filteredUsers.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const safeUsers = filteredUsers.slice(offset, offset + limit).map((u) => ({
      ...stripPassword(u),
      hasPassword: !!u.password,
    }))

    adminAccessLog.add({
      admin: { id: adminUser.id, email: adminUser.email },
      action: 'VIEW_USERS_LIST',
    })

    return {
      success: true,
      users: safeUsers,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
      filters: { role: role || null, search: search || null },
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка получения пользователей:', error)
    throw createError({ statusCode: 500, statusMessage: 'Ошибка сервера' })
  }
})