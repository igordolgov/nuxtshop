// server/api/auth/logout.post.js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Логирование выходов
const logLogout = async (user, ip) => {
  try {
    if (!user) return
    
    const logDir = join(process.cwd(), 'server', 'logs')
    const logFile = join(logDir, 'login-attempts.json')
    
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
    
    let logs = []
    if (existsSync(logFile)) {
      logs = JSON.parse(readFileSync(logFile, 'utf-8') || '[]')
    }
    
    logs.unshift({
      timestamp: new Date().toISOString(),
      email: user.email,
      action: 'logout',
      success: true,
      ip
    })
    
    if (logs.length > 500) logs = logs.slice(0, 500)
    writeFileSync(logFile, JSON.stringify(logs, null, 2))
  } catch (e) {
    console.error('Ошибка логирования:', e)
  }
}

export default defineEventHandler(async (event) => {
  try {
    const ip = getRequestHeader(event, 'x-forwarded-for') || 
               getRequestHeader(event, 'x-real-ip') || 
               'unknown'
    
    // Получаем информацию о пользователе перед выходом
    let userData = null
    const sessionCookie = getCookie(event, 'user_session')
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie)
        userData = session?.user
      } catch (e) {
        // Игнорируем
      }
    }
    
    console.log('🚪 POST /api/auth/logout', userData?.email || 'неизвестный пользователь')
    
    // ====== ОЧИЩАЕМ КУКИ ======
    const cookiesToClear = [
      'user_session',
      'auth_token', 
      'session_id',
      'user',
      'nuxt_session'
    ]
    
    cookiesToClear.forEach(name => {
      deleteCookie(event, name, { path: '/' })
      // Также пробуем с другими параметрами
      deleteCookie(event, name, { path: '/', domain: '' })
    })
    
    // ====== ЛОГИРУЕМ ВЫХОД ======
    await logLogout(userData, ip)
    
    if (userData) {
      console.log('✅ Выход выполнен:', userData.email)
    } else {
      console.log('✅ Куки очищены (пользователь не определен)')
    }
    
    return {
      success: true,
      message: 'Выход выполнен успешно'
    }
    
  } catch (error) {
    console.error('❌ Ошибка выхода:', error)
    
    // Даже при ошибке пытаемся очистить куки
    try {
      deleteCookie(event, 'user_session', { path: '/' })
    } catch (e) {
      // Игнорируем
    }
    
    return {
      success: true,
      message: 'Сессия завершена'
    }
  }
})