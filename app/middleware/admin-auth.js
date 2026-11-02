// middleware/admin-auth.js
// ============================================
// Middleware: admin-auth — защита роутов /admin/**.
//
// Сервер: проверяем сессию по кукам запроса и отдаём редирект прямо в
// SSR-ответе — никакого «мигания» админики при F5. Безопасно, потому что
// /admin/** не кэшируется (SWR включён только для / и /product/**).
//
// Клиент: та же проверка через общий стейт useAuth (для SPA-навигаций
// и на случай смерти сессии между навигациями).
//
// Локаль: админка локализуется теми же префиксами (/en/admin, /es/admin),
// поэтому редиректы идут через localePath — не сбрасывая язык, и с
// ?redirect=<пришедший путь>, чтобы после логина вернуть пользователя туда,
// откуда его выкинуло (логин учитывает этот параметр).
// ============================================
export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()

  const loginRedirect = () =>
    navigateTo(
      localePath({ path: '/auth/login', query: { redirect: to.fullPath } }),
      { replace: true },
    )

  // ─── Сервер ───────────────────────────────────────────────
  if (import.meta.server) {
    // $fetch при SSR не пересылает куки автоматически — делаем это явно
    const headers = useRequestHeaders(['cookie'])
    try {
      const data = await $fetch('/api/auth/user', { headers })
      const user = data?.user ?? null
      if (!user) return loginRedirect()
      if (user.role !== 'admin') return navigateTo(localePath('/'), { replace: true })
    } catch {
      return loginRedirect()
    }
    return
  }

  // ─── Клиент ───────────────────────────────────────────────
  const nuxtApp = useNuxtApp()
  const { authChecked, isAuthenticated, isAdmin, checkAuth } = useAuth()

  // При гидратации (первая загрузка) сессию уже проверил сервер этим же
  // запросом. await checkAuth() здесь заполнял useAuth ДО первого рендера:
  // клиент рендерил шапку «админ», а SSR-HTML — «гость» → hydration
  // mismatch повреждал DOM админки (см. auth-init.global.js). Даже
  // неблокирующий checkAuth() здесь давал гонку: fetch запускался в фазе
  // middleware, ответ успевал до монтирования, пока vue-router грузил
  // chunk страницы. Проверку откладываем до конца гидратации: сессия,
  // умершая между SSR и гидратацией (окно в доли секунды), получит
  // редирект сразу после отрисовки страницы.
  if (nuxtApp.isHydrating && !authChecked.value) {
    nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
      checkAuth()
        .then((data) => {
          const user = data?.user ?? null
          if (!user) loginRedirect()
          else if (user.role !== 'admin') navigateTo(localePath('/'), { replace: true })
        })
        .catch(() => {})
    })
    return
  }

  // SPA-навигации: клиентский стейт может быть ещё не загружен — ждём
  if (!authChecked.value) {
    await checkAuth()
  }

  if (!isAuthenticated.value) {
    console.log('🚫 /admin: не авторизован →', to.path)
    return loginRedirect()
  }
  if (!isAdmin.value) {
    console.log('🚫 /admin: недостаточно прав →', to.path)
    return navigateTo(localePath('/'), { replace: true })
  }
})
