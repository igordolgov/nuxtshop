// composables/useApi.ts
export const useApi = () => {
  const config = useRuntimeConfig()
  
  const apiFetch = $fetch.create({
    baseURL: config.public.apiBaseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })
  
  return {
    // Авторизация
    async login(email: string, password: string) {
      return apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })
    },
    
    async register(name: string, email: string, password: string) {
      return apiFetch('/api/auth/register', {
        method: 'POST',
        body: { name, email, password }
      })
    },
    
    // Товары
    async getProducts() {
      return apiFetch('/api/products')
    },
    
    async getProduct(id: number) {
      return apiFetch(`/api/products/${id}`)
    },
    
    // Профиль
    async getProfile() {
      return apiFetch('/api/auth/profile')
    }
  }
}