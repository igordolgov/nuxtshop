// server/api/auth/logout.post.js
import { logoutLog } from '../../lib/logger.js'

export default defineEventHandler(async (event) => {
  try {
    const ip =
      getRequestHeader(event, 'x-forwarded-for') ||
      getRequestHeader(event, 'x-real-ip') ||
      'unknown'

    let userData = null
    const sessionCookie = getCookie(event, 'user_session')
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie)
        userData = session?.user
      } catch {
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
      'nuxt_session',
    ]

    cookiesToClear.forEach((name) => {
      deleteCookie(event, name, { path: '/' })
      deleteCookie(event, name, { path: '/', domain: '' })
    })

    if (userData) {
      logoutLog.add({ email: userData.email, action: 'logout', success: true, ip })
      console.log('✅ Выход выполнен:', userData.email)
    } else {
      console.log('✅ Куки очищены (пользователь не определен)')
    }

    return { success: true, message: 'Выход выполнен успешно' }
  } catch (error) {
    console.error('❌ Ошибка выхода:', error)

    try {
      deleteCookie(event, 'user_session', { path: '/' })
    } catch {
      // Игнорируем
    }

    return { success: true, message: 'Сессия завершена' }
  }
})