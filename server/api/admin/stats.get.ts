// server/api/admin/stats.get.ts
import { readUsers, stripPassword } from '../../lib/userHelpers';
import { readProducts } from '../../lib/productHelpers';
import { readOrders } from '../../lib/orderHelpers';
import { cacheStats } from '../../lib/cache';
import { requireStaff } from '../../utils/auth';
import { adminActionLog } from '../../lib/logger';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const users = await readUsers(event);
  const products = await readProducts(event);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const userStats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    managers: users.filter((u) => u.role === 'manager').length,
    users: users.filter((u) => u.role === 'user').length,
    newToday: users.filter((u) => new Date(u.createdAt) > dayAgo).length,
    newWeek: users.filter((u) => new Date(u.createdAt) > weekAgo).length,
    newMonth: users.filter((u) => new Date(u.createdAt) > monthAgo).length,
    active: users.filter((u) => u.lastLogin && new Date(u.lastLogin) > weekAgo).length,
  };

  // Заказы в KV (data:orders): сводка для KPI дашборда. Детальная
  // аналитика (графики, топ товаров) — на /api/admin/analytics.
  // Выручка — не-отменённые заказы (семантика analyticsHelpers).
  const orders = await readOrders(event);
  const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
  const orderStats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'new').length,
    processing: orders.filter((o) => o.status === 'confirmed' || o.status === 'shipped').length,
    completed: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    totalRevenue: nonCancelled.reduce((sum, o) => sum + o.total, 0),
    weekRevenue: nonCancelled
      .filter((o) => new Date(o.createdAt) > weekAgo)
      .reduce((sum, o) => sum + o.total, 0),
  };

  const productStats = {
    total: products.length,
    inStock: products.filter((p) => p.inStock).length,
    outOfStock: products.filter((p) => !p.inStock).length,
  };

  const adminActionsCount = adminActionLog.count((l) => new Date(l.timestamp) > weekAgo);

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(stripPassword);

  return {
    success: true,
    timestamp: now.toISOString(),
    stats: {
      users: userStats,
      orders: orderStats,
      products: productStats,
      adminActions: adminActionsCount,
      // Счётчики кэша каталога (cache.ts): hits/misses за жизнь изолята.
      // Hit ratio = hits / (hits + misses) — доля запросов, обошедшихся
      // без чтения KV. Снимается ПОСЛЕ readProducts выше.
      cache: cacheStats(),
    },
    recentUsers,
  };
});
