// middleware/manager-auth.js
export default defineNuxtRouteMiddleware(async (to, from) => {
  const { $notify } = useNuxtApp()
  const appState = useAppState()
  
  // Проверяем аутентификацию, если еще не проверяли
  if (!appState.authChecked.value) {
    await appState.checkAuth()
  }
  
  // Если пользователь не аутентифицирован
  if (!appState.isAuthenticated.value) {
    console.log('🚫 Доступ запрещен: неавторизованный пользователь')
    $notify.error('Для доступа необходимо войти в систему')
    return navigateTo('/auth/login')
  }
  
  // Если пользователь не менеджер или администратор
  if (!appState.isManager.value) {
    console.log('🚫 Доступ запрещен: недостаточно прав', {
      user: appState.user.value,
      isManager: appState.isManager.value
    })
    $notify.error('Недостаточно прав для доступа')
    return navigateTo('/')
  }
  
  console.log('✅ Доступ разрешен: менеджер/администратор')
})