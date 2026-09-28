// middleware/user-auth.js
export default defineNuxtRouteMiddleware(async (to) => {
  // Для API запросов пропускаем проверку
  if (to.path.startsWith('/api/')) {
    return
  }
  
  const appState = useAppState()
  
  // Проверяем аутентификацию, если еще не проверяли
  if (!appState.authChecked.value) {
    await appState.checkAuth()
  }
  
  console.log('🛡️ User auth middleware:', {
    path: to.path,
    user: appState.user.value,
    isAuthenticated: appState.isAuthenticated.value
  })
  
  if (!appState.isAuthenticated.value) {
    console.log('🚫 Redirect to login - not authenticated')
    return navigateTo('/auth/login')
  }
  
  console.log('✅ User access granted')
})