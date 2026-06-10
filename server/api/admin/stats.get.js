// server/api/admin/stats.get.js
import { readUsers } from '../../lib/userHelpers.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  try {
    console.log('📊 GET /api/admin/stats - запрос статистики')

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
    
    if (sessionData?.user?.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Доступ запрещен. Требуются права администратора'
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
      admins: users.filter(u => u.role === 'admin').length,
      managers: users.filter(u => u.role === 'manager').length,
      users: users.filter(u => u.role === 'user').length,
      newToday: users.filter(u => new Date(u.createdAt) > dayAgo).length,
      newWeek: users.filter(u => new Date(u.createdAt) > weekAgo).length,
      newMonth: users.filter(u => new Date(u.createdAt) > monthAgo).length,
      active: users.filter(u => u.lastLogin && new Date(u.lastLogin) > weekAgo).length
    }

    // ====== СТАТИСТИКА ЗАКАЗОВ ======
    let orderStats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      totalRevenue: 0,
      weekRevenue: 0
    }
    
    try {
      const ordersFile = join(process.cwd(), 'server', 'data', 'orders.json')
      if (existsSync(ordersFile)) {
        const orders = JSON.parse(readFileSync(ordersFile, 'utf-8') || '[]')
        
        orderStats = {
          total: orders.length,
          pending: orders.filter(o => o.status === 'pending').length,
          processing: orders.filter(o => o.status === 'processing').length,
          completed: orders.filter(o => o.status === 'completed').length,
          cancelled: orders.filter(o => o.status === 'cancelled').length,
          totalRevenue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
          weekRevenue: orders
            .filter(o => new Date(o.createdAt) > weekAgo)
            .reduce((sum, o) => sum + (o.total || 0), 0)
        }
      }
    } catch (e) {
      console.log('ℹ️ Файл заказов не найден')
    }

    // ====== СТАТИСТИКА ПРОДУКТОВ ======
    let productStats = { total: 0, inStock: 0, outOfStock: 0 }
    
    try {
      const productsFile = join(process.cwd(), 'server', 'data', 'products.json')
      if (existsSync(productsFile)) {
        const products = JSON.parse(readFileSync(productsFile, 'utf-8') || '[]')
        
        productStats = {
          total: products.length,
          inStock: products.filter(p => p.inStock).length,
          outOfStock: products.filter(p => !p.inStock).length
        }
      }
    } catch (e) {
      console.log('ℹ️ Файл продуктов не найден')
    }

    // ====== СТАТИСТИКА ЛОГОВ АДМИНА ======
    let adminActionsCount = 0
    try {
      const logFile = join(process.cwd(), 'server', 'logs', 'admin-actions.json')
      if (existsSync(logFile)) {
        const logs = JSON.parse(readFileSync(logFile, 'utf-8') || '[]')
        adminActionsCount = logs.filter(l => new Date(l.timestamp) > weekAgo).length
      }
    } catch (e) {
      // Игнорируем
    }

    // ====== ПОСЛЕДНИЕ ПОЛЬЗОВАТЕЛИ ======
    const recentUsers = users
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(({ password, ...user }) => user)

    // ====== ФОРМИРУЕМ ОТВЕТ ======
    return {
      success: true,
      timestamp: now.toISOString(),
      stats: {
        users: userStats,
        orders: orderStats,
        products: productStats,
        adminActions: adminActionsCount
      },
      recentUsers
    }

  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Ошибка сервера'
    })
  }
})