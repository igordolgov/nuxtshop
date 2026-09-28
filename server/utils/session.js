// server/utils/session.js
import { useSession, getCookie, setCookie, deleteCookie } from 'h3'

// Конфигурация сессии (вынесена в одно место)
const SESSION_CONFIG = {
  password: process.env.SESSION_PASSWORD || 'change-this-password-in-production-min-32-chars!',
  maxAge: 60 * 60 * 24 * 7, // 7 дней
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  },
  cookieName: 'user_session'
}

// Имя куки для fallback
const SESSION_COOKIE_NAME = 'user_session'

/**
 * Получает конфигурацию сессии
 */
function getSessionConfig() {
  // Предупреждение о слабом пароле в production
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_PASSWORD) {
    console.warn('⚠️ WARNING: Using default session password in production! Set SESSION_PASSWORD env variable.')
  }
  
  return SESSION_CONFIG
}

/**
 * Создаёт или получает сессию h3
 * @param {H3Event} event 
 * @returns {Promise<{session: object, data: object}>}
 */
async function initSession(event) {
  try {
    const session = await useSession(event, getSessionConfig())
    return {
      session,
      data: session.data || {}
    }
  } catch (error) {
    console.error('❌ Ошибка инициализации сессии:', error.message)
    return {
      session: null,
      data: {}
    }
  }
}

/**
 * Устанавливает данные сессии пользователя
 * @param {H3Event} event 
 * @param {Object} sessionData - Данные для сохранения
 * @returns {Promise<boolean>}
 */
export async function setUserSession(event, sessionData) {
  try {
    const { session } = await initSession(event)
    
    if (!session) {
      // Fallback: используем куки напрямую
      setCookie(event, SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
        ...SESSION_CONFIG.cookie,
        maxAge: SESSION_CONFIG.maxAge
      })
      return true
    }
    
    await session.update(sessionData)
    return true
    
  } catch (error) {
    console.error('❌ Ошибка установки сессии:', error.message)
    return false
  }
}

/**
 * Получает данные сессии пользователя
 * @param {H3Event} event 
 * @returns {Promise<Object|null>}
 */
export async function getUserSession(event) {
  try {
    const { session, data } = await initSession(event)
    
    if (session && Object.keys(data).length > 0) {
      return data
    }
    
    // Fallback: читаем из куки
    const cookieData = getCookie(event, SESSION_COOKIE_NAME)
    
    if (cookieData) {
      try {
        return JSON.parse(cookieData)
      } catch {
        return null
      }
    }
    
    return null
    
  } catch (error) {
    console.error('❌ Ошибка получения сессии:', error.message)
    return null
  }
}

/**
 * Очищает сессию пользователя
 * @param {H3Event} event 
 * @returns {Promise<boolean>}
 */
export async function clearUserSession(event) {
  try {
    const { session } = await initSession(event)
    
    if (session) {
      await session.clear()
    }
    
    // Также удаляем куку fallback
    deleteCookie(event, SESSION_COOKIE_NAME)
    
    return true
    
  } catch (error) {
    console.error('❌ Ошибка очистки сессии:', error.message)
    return false
  }
}

/**
 * Проверяет, авторизован ли пользователь
 * @param {H3Event} event 
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated(event) {
  const session = await getUserSession(event)
  return !!(session?.user?.id)
}

/**
 * Получает пользователя из сессии
 * @param {H3Event} event 
 * @returns {Promise<Object|null>}
 */
export async function getSessionUser(event) {
  const session = await getUserSession(event)
  return session?.user || null
}

/**
 * Проверяет, является ли пользователь администратором
 * @param {H3Event} event 
 * @returns {Promise<boolean>}
 */
export async function isAdmin(event) {
  const user = await getSessionUser(event)
  return user?.role === 'admin'
}

/**
 * Обновляет данные пользователя в сессии
 * @param {H3Event} event 
 * @param {Object} userData - Новые данные пользователя
 * @returns {Promise<boolean>}
 */
export async function updateSessionUser(event, userData) {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    return false
  }
  
  const updatedUser = {
    ...session.user,
    ...userData
  }
  
  // Удаляем敏感ные поля
  delete updatedUser.password
  
  return setUserSession(event, {
    ...session,
    user: updatedUser
  })
}

/**
 * Устанавливает сессию для авторизованного пользователя
 * @param {H3Event} event 
 * @param {Object} user - Данные пользователя (без пароля!)
 * @returns {Promise<boolean>}
 */
export async function loginUser(event, user) {
  // Удаляем пароль перед сохранением
  const { password, ...safeUser } = user
  
  return setUserSession(event, {
    user: safeUser,
    loggedInAt: new Date().toISOString()
  })
}

/**
 * Выход пользователя
 * @param {H3Event} event 
 * @returns {Promise<boolean>}
 */
export async function logoutUser(event) {
  return clearUserSession(event)
}

// Экспорт по умолчанию
export default {
  setUserSession,
  getUserSession,
  clearUserSession,
  isAuthenticated,
  getSessionUser,
  isAdmin,
  updateSessionUser,
  loginUser,
  logoutUser
}