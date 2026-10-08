// middleware/user-auth.js
// ============================================
// Middleware: user-auth — требует авторизации.
// Сервер: SSR-проверка по кукам (роуты не кэшируются).
// Клиент: проверка через общий стейт useAuth.
// ============================================
export default defineNuxtRouteMiddleware(async () => {
  // ─── Сервер ───────────────────────────────────────────────
  if (import.meta.server) {
    // $fetch при SSR не пересылает куки автоматически — делаем это явно
    const headers = useRequestHeaders(['cookie'])
    try {
      const data = await $fetch('/api/auth/user', { headers })
      if (!data?.user) return navigateTo('/auth/login', { replace: true })
    } catch {
      return navigateTo('/auth/login', { replace: true })
    }
    return
  }

  // ─── Клиент ───────────────────────────────────────────────
  const { authChecked, isAuthenticated, checkAuth } = useAuth()

  if (!authChecked.value) {
    await checkAuth()
  }

  if (!isAuthenticated.value) {
    return navigateTo('/auth/login', { replace: true })
  }
})