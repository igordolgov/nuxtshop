// middleware/admin-auth.js
// ============================================
// Middleware: admin-auth — защита роутов /admin/**.
//
// Сервер: проверяем сессию по кукам запроса и отдаём редирект прямо в
// SSR-ответе — никакого «мигания» админки при F5. Безопасно, потому что
// /admin/** не кэшируется (SWR включён только для / и /product/**).
//
// Клиент: та же проверка через общий стейт useAuth (для SPA-навигаций
// и на случай смерти сессии между навигациями).
// ============================================
export default defineNuxtRouteMiddleware(async (to) => {
  // ─── Сервер ───────────────────────────────────────────────
  if (import.meta.server) {
    // $fetch при SSR не пересылает куки автоматически — делаем это явно
    const headers = useRequestHeaders(['cookie'])
    try {
      const data = await $fetch('/api/auth/user', { headers })
      const user = data?.user ?? null
      if (!user) return navigateTo('/auth/login', { replace: true })
      if (user.role !== 'admin') return navigateTo('/', { replace: true })
    } catch {
      return navigateTo('/auth/login', { replace: true })
    }
    return
  }

  // ─── Клиент ───────────────────────────────────────────────
  const { authChecked, isAuthenticated, isAdmin, checkAuth } = useAuth()

  // На первом заходе клиентский стейт может быть ещё не загружен — ждём
  if (!authChecked.value) {
    await checkAuth()
  }

  if (!isAuthenticated.value) {
    console.log('🚫 /admin: не авторизован →', to.path)
    return navigateTo('/auth/login', { replace: true })
  }
  if (!isAdmin.value) {
    console.log('🚫 /admin: недостаточно прав →', to.path)
    return navigateTo('/', { replace: true })
  }
})