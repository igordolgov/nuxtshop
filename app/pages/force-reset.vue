<!-- app\pages\force-reset.vue -->
<template>
  <div class="flex justify-center items-center bg-base-200 min-h-screen">
    <div class="bg-base-100 shadow-xl w-full max-w-md card">
      <div class="text-center card-body">
        <div class="mb-4 text-6xl">🔄</div>
        <h1 class="flex justify-center text-2xl card-title">Принудительный сброс</h1>
        <p class="opacity-70 mt-2 mb-6 text-base-content">
          Эта страница полностью сбросит все данные приложения.
        </p>
        
        <div class="space-y-4">
          <button class="w-full btn btn-error" @click="forceReset">
            <svg class="mr-2 w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Полный сброс
          </button>
          
          <button class="w-full btn btn-warning" @click="clearAuthOnly">
            <svg class="mr-2 w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Сбросить только аутентификацию
          </button>
          
          <button class="w-full btn btn-ghost" @click="$router.push('/auth/login')">
            На страницу входа
          </button>
        </div>
        
        <div class="bg-base-300 mt-6 p-4 rounded-lg">
          <h2 class="mb-2 font-bold">Текущее состояние:</h2>
          <div class="text-sm text-left">
            <div>Аутентифицирован: {{ isAuthenticated ? 'Да' : 'Нет' }}</div>
            <div>Пользователь: {{ user?.name || 'Нет' }}</div>
            <div>Email: {{ user?.email || 'Нет' }}</div>
            <div>Роль: {{ user?.role || 'Нет' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { user, isAuthenticated, logout } = useAuth()

const forceReset = async () => {
  try {
    // Очищаем все хранилища
    if (process.client) {
      localStorage.clear()
      sessionStorage.clear()
      
      // Очищаем все куки
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim()
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      })
    }
    
    // Выходим из системы
    await logout()
    
    // Редирект
    window.location.href = '/auth/login'
    
  } catch (error) {
    console.error('Ошибка сброса:', error)
    window.location.href = '/auth/login'
  }
}

const clearAuthOnly = async () => {
  try {
    await logout()
    window.location.href = '/auth/login'
  } catch (error) {
    console.error('Ошибка сброса аутентификации:', error)
    window.location.href = '/auth/login'
  }
}
</script>