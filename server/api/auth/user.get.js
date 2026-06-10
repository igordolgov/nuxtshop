// server/api/auth/user.get.js
import { readUsers } from '../../lib/userHelpers.js'

export default defineEventHandler(async (event) => {
  try {
    console.log('🔍 GET /api/auth/user')
    
    // ====== ПОЛУЧАЕМ СЕССИЮ ======
    const sessionCookie = getCookie(event, 'user_session')
    
    if (!sessionCookie) {
      return { 
        success: true,
        isAuthenticated: false, 
        user: null 
      }
    }
    
    let sessionData
    try {
      sessionData = JSON.parse(sessionCookie)
    } catch (e) {
      console.log('❌ Невалидная сессия')
      return { 
        success: true,
        isAuthenticated: false, 
        user: null 
      }
    }
    
    const userId = sessionData?.user?.id
    
    if (!userId) {
      return { 
        success: true,
        isAuthenticated: false, 
        user: null 
      }
    }

    // ====== ЧИТАЕМ СВЕЖИЕ ДАННЫЕ ИЗ БАЗЫ ======
    const users = await readUsers()
    const user = users.find(u => u.id === userId)
    
    if (!user) {
      console.log('❌ Пользователь не найден в базе:', userId)
      return { 
        success: true,
        isAuthenticated: false, 
        user: null 
      }
    }

    // ====== ВОЗВРАЩАЕМ БЕЗ ПАРОЛЯ ======
    const { password, ...userWithoutPassword } = user
    
    console.log('✅ Пользователь:', user.email, '| Роль:', user.role)
    
    return {
      success: true,
      isAuthenticated: true,
      user: userWithoutPassword
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