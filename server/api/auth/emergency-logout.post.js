// server/api/auth/emergency-logout.post.js
export default defineEventHandler(async (event) => {
  try {
    console.log('🆘 АВАРИЙНЫЙ ВЫХОД ИЗ СИСТЕМЫ')
    
    // Очищаем ВСЕ куки
    const headers = getHeaders(event)
    const cookieHeader = headers.cookie
    
    if (cookieHeader) {
      const cookies = cookieHeader.split(';')
      cookies.forEach(cookie => {
        const name = cookie.split('=')[0].trim()
        if (name) {
          deleteCookie(event, name, {
            path: '/',
            domain: '',
            secure: false,
            httpOnly: true
          })
          console.log(`🗑️ Очищена кука: ${name}`)
        }
      })
    }
    
    console.log('✅ Все куки очищены')
    
    return {
      success: true,
      message: 'Аварийный выход выполнен. Все куки очищены.'
    }
  } catch (error) {
    console.error('❌ Ошибка аварийного выхода:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Ошибка при аварийном выходе'
    })
  }
})