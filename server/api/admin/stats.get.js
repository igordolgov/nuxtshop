// server/api/admin/stats.get.js
import { readUsers } from '../../lib/userHelpers.js'
import { readProducts } from '../../lib/productHelpers.js'
import { adminActionLog } from '../../lib/logger.js'

export default defineEventHandler(async (event) => {
  try {
    console.log('📊 GET /api/admin/stats - запрос статистики')

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

    if (sessionData?.user?.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Доступ запрещен. Требуются права администратора',
      })
    }

    // ====== СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ ======
    const users = await readUsers()

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const userStats = {
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      managers: users.filter((u) => u.role === 'manager').length,
      users: users.filter((u) => u.role === 'user').length,
      newToday: users.filter((u) => new Date(u.createdAt) > dayAgo).length,
      newWeek: users.filter((u) => new Date(u.createdAt) > weekAgo).length,
      newMonth: users.filter((u) => new Date(u.createdAt) > monthAgo).length,
      active: users.filter((u) => u.lastLogin && new Date(u.lastLogin) > weekAgo).length,
    }

    // ====== СТАТИСТИКА ЗАКАЗОВ ======
    // Заказы не хранятся на сервере (нет D1/KV).
    // При подключении БД — заменить на реальный запрос.
    const orderStats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      totalRevenue: 0,
      weekRevenue: 0,
    }

    // ====== СТАТИСТИКА ПРОДУКТОВ ======
    const products = await readProducts()
    const productStats = {
      total: products.length,
      inStock: products.filter((p) => p.inStock).length,
      outOfStock: products.filter((p) => !p.inStock).length,
    }

    // ====== СТАТИСТИКА ДЕЙСТВИЙ АДМИНА ======
    const adminActionsCount = adminActionLog.count(
      (l) => new Date(l.timestamp) > weekAgo
    )

    // ====== ПОСЛЕДНИЕ ПОЛЬЗОВАТЕЛИ ======
    const recentUsers = [...users]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(({ password, ...user }) => user)

    return {
      success: true,
      timestamp: now.toISOString(),
      stats: {
        users: userStats,
        orders: orderStats,
        products: productStats,
        adminActions: adminActionsCount,
      },
      recentUsers,
    }
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Ошибка сервера',
    })
  }
})