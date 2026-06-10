// middleware/admin-auth.js
export default defineNuxtRouteMiddleware(async (to) => {
  const appState = useAppState()
  
  // Проверяем аутентификацию, если еще не проверяли
  if (!appState.authChecked.value) {
    await appState.checkAuth()
  }
  
  console.log('🛡️ Admin auth middleware:', {
    path: to.path,
    user: appState.user.value,
    isAuthenticated: appState.isAuthenticated.value,
    isAdmin: appState.isAdmin.value
  })
  
  if (!appState.isAuthenticated.value) {
    console.log('🚫 Redirect to login - not authenticated')
    return navigateTo('/auth/login')
  }
  
  if (!appState.isAdmin.value) {
    console.log('🚫 Redirect to home - not admin', {
      role: appState.user.value?.role
    })
    const { $notify } = useNuxtApp()
    $notify.error('Требуются права администратора')
    return navigateTo('/')
  }
  
  console.log('✅ Admin access granted')
})