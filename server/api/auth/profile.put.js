// server/api/auth/profile.put.js
import { readUsers, writeUsers } from '../../lib/userHelpers.js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    console.log('📝 PUT /api/auth/profile - обновление профиля:', { 
      name: body.name,
      phone: body.phone,
      address: body.address
    })

    // Пробуем разные способы получения сессии
    let userSession = getCookie(event, 'user_session')
    console.log('🍪 Кука user_session:', userSession ? 'есть' : 'нет')

    // Если нет куки, пробуем получить сессию через h3
    if (!userSession) {
      try {
        const { getUserSession } = await import('../../utils/session.js')
        const sessionData = await getUserSession(event)
        if (sessionData?.user) {
          console.log('🔐 Получена сессия через h3')
          userSession = JSON.stringify({ user: sessionData.user })
        }
      } catch (sessionError) {
        console.log('ℹ️ h3 сессии не доступны')
      }
    }

    if (!userSession) {
      console.log('❌ Нет сессии пользователя')
      throw createError({
        statusCode: 401,
        statusMessage: 'Неавторизованный доступ'
      })
    }

    let sessionData
    try {
      sessionData = JSON.parse(userSession)
      console.log('👤 Данные сессии:', sessionData.user)
    } catch (parseError) {
      console.error('❌ Ошибка парсинга сессии:', parseError)
      throw createError({
        statusCode: 401,
        statusMessage: 'Невалидная сессия'
      })
    }

    const currentUser = sessionData.user
    if (!currentUser || !currentUser.id) {
      console.log('❌ Нет данных пользователя в сессии')
      throw createError({
        statusCode: 401,
        statusMessage: 'Невалидная сессия пользователя'
      })
    }

    // Читаем пользователей
    const users = await readUsers()
    console.log('👥 Всего пользователей:', users.length)
    
    const userIndex = users.findIndex(u => u.id === currentUser.id)
    console.log('🔍 Индекс пользователя:', userIndex)
    
    if (userIndex === -1) {
      console.log('❌ Пользователь не найден в базе')
      throw createError({
        statusCode: 404,
        statusMessage: 'Пользователь не найден'
      })
    }

    // Валидация данных
    if (!body.name || body.name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Имя обязательно для заполнения'
      })
    }

    // Обновляем данные
    const updatedUserData = {
      ...users[userIndex],
      name: body.name.trim(),
      phone: body.phone || '',
      address: body.address || '',
      updatedAt: new Date().toISOString()
    }

    users[userIndex] = updatedUserData
    await writeUsers(users)

    console.log('✅ Пользователь обновлен:', {
      id: updatedUserData.id,
      name: updatedUserData.name,
      email: updatedUserData.email
    })

    // Подготавливаем ответ без пароля
    const userResponse = { ...updatedUserData }
    delete userResponse.password

    // Обновляем куку
    setCookie(event, 'user_session', JSON.stringify({ user: userResponse }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'lax'
    })

    console.log('🍪 Сессия обновлена в куках')

    return {
      success: true,
      user: userResponse,
      message: 'Профиль обновлен'
    }

  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Ошибка при обновлении профиля'
    })
  }
})