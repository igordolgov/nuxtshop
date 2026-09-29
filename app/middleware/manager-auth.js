// middleware/manager-auth.js
// ============================================
// Middleware: manager-auth — доступ manager и admin.
// Сервер: SSR-проверка по кукам (роуты не кэшируются).
// Клиент: проверка через общий стейт useAuth.
// ============================================
export default defineNuxtRouteMiddleware(async (to) => {
  // ─── Сервер ───────────────────────────────────────────────
  if (import.meta.server) {
    const headers = useRequestHeaders(['cookie'])
    try {
      const data = await $fetch('/api/auth/user', { headers })
      const user = data?.user ?? null
      if (!user) return navigateTo('/auth/login', { replace: true })
      if (!['manager', 'admin'].includes(user.role)) {
        return navigateTo('/', { replace: true })
      }
    } catch {
      return navigateTo('/auth/login', { replace: true })
    }
    return
  }

  // ─── Клиент ───────────────────────────────────────────────
  const { $notify } = useNuxtApp()
  const { authChecked, isAuthenticated, isManager, checkAuth } = useAuth()

  if (!authChecked.value) {
    await checkAuth()
  }

  if (!isAuthenticated.value) {
    $notify.error('Для доступа необходимо войти в систему')
    return navigateTo('/auth/login', { replace: true })
  }
  if (!isManager.value) {
    $notify.error('Недостаточно прав для доступа')
    return navigateTo('/', { replace: true })
  }
})