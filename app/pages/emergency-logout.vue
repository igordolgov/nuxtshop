<!-- app\pages\emergency-logout.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body text-center">
        <div class="text-6xl mb-4">🚨</div>
        <h1 class="card-title text-2xl justify-center flex">Аварийный выход</h1>
        <p class="text-base-content opacity-70 mt-2 mb-6">
          Эта страница принудительно очистит все данные сессии и выйдет из системы.
        </p>
        
        <div class="space-y-4">
          <button class="btn btn-error w-full" @click="emergencyLogout">
            <svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Принудительный выход
          </button>
          
          <button class="btn btn-ghost w-full" @click="$router.push('/auth/login')">
            На страницу входа
          </button>
          
          <button class="btn btn-outline w-full" @click="$router.push('/')">
            На главную
          </button>
        </div>
        
        <div class="alert alert-warning mt-6">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>Используйте только если обычный выход не работает</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { $notify } = useNuxtApp()

const emergencyLogout = async () => {
  try {
    const result = await $fetch('/api/auth/emergency-logout', {
      method: 'POST'
    })
    
    if (result.success) {
      $notify.success('Все сессии очищены. Вы вышли из системы.')
      
      // Принудительно очищаем localStorage
      if (process.client) {
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // Ждем немного перед редиректом
      setTimeout(() => {
        window.location.href = '/auth/login'
      }, 1000)
    }
  } catch (error) {
    console.error('Ошибка аварийного выхода:', error)
    $notify.error('Ошибка при аварийном выходе')
  }
}
</script>
