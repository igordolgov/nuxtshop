// server/api/admin/stats.get.js
import { readUsers, stripPassword } from '../../lib/userHelpers'
import { readProducts } from '../../lib/productHelpers'
import { requireAdmin } from '../../utils/auth'
import { adminActionLog } from '../../lib/logger'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const users = await readUsers(event)
  const products = await readProducts(event)

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

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

  // Заказы не хранятся на сервере — когда появится БД, заменить на реальные данные
  const orderStats = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    totalRevenue: 0,
    weekRevenue: 0,
  }

  const productStats = {
    total: products.length,
    inStock: products.filter((p) => p.inStock).length,
    outOfStock: products.filter((p) => !p.inStock).length,
  }

  const adminActionsCount = adminActionLog.count((l) => new Date(l.timestamp) > weekAgo)

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(stripPassword)

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
})