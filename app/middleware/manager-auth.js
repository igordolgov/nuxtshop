// middleware/manager-auth.js
export default defineNuxtRouteMiddleware(async (_to, _from) => {
  const { $notify } = useNuxtApp()
  const appState = useAppState()
  
  // Проверяем аутентификацию, если еще не проверяли
  if (!appState.authChecked.value) {
    await appState.checkAuth()
  }
  
  // Если пользователь не аутентифицирован
  if (!appState.isAuthenticated.value) {
    consola.debug('🚫 Доступ запрещен: неавторизованный пользователь')
    $notify.error('Для доступа необходимо войти в систему')
    return navigateTo('/auth/login')
  }
  
  // Если пользователь не менеджер или администратор
  if (!appState.isManager.value) {
    consola.debug('🚫 Доступ запрещен: недостаточно прав', {
      user: appState.user.value,
      isManager: appState.isManager.value
    })
    $notify.error('Недостаточно прав для доступа')
    return navigateTo('/')
  }
  
  consola.debug('✅ Доступ разрешен: менеджер/администратор')
})