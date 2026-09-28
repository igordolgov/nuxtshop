// server/api/auth/current-user.get.js
import { readUsers } from '../../lib/userHelpers.js'

// Получение пользователя из сессии
const getUserFromSession = async (event) => {
  // Пробуем получить из куки
  const sessionCookie = getCookie(event, 'user_session')
  
  if (!sessionCookie) {
    return null
  }
  
  try {
    const sessionData = JSON.parse(sessionCookie)
    
    if (!sessionData?.user?.id) {
      return null
    }
    
    // Получаем свежие данные из базы
    const users = await readUsers()
    const user = users.find(u => u.id === sessionData.user.id)
    
    if (!user) {
      return null
    }
    
    // Возвращаем без пароля
    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
    
  } catch (e) {
    console.error('Ошибка парсинга сессии:', e)
    return null
  }
}

export default defineEventHandler(async (event) => {
  try {
    console.log('🔍 GET /api/auth/current-user')
    
    const user = await getUserFromSession(event)
    
    if (!user) {
      console.log('ℹ️ Пользователь не авторизован')
      return {
        success: false,
        isAuthenticated: false,
        user: null
      }
    }
    
    console.log('✅ Пользователь:', user.email, '| Роль:', user.role)
    
    return {
      success: true,
      isAuthenticated: true,
      user
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения пользователя:', error)
    
    return {
      success: false,
      isAuthenticated: false,
      user: null,
      error: error.message
    }
  }
})