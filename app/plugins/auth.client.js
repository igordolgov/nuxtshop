// plugins/auth.client.js
export default defineNuxtPlugin(() => {
  const userStore = useUserStore()
  
  // Синхронизация между вкладками
  if (process.client) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'user' || e.key === 'token') {
        userStore.initialize()
      }
    })
  }
})