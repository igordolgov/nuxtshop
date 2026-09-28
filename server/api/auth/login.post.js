// server/api/auth/login.post.js
import { readUsers, writeUsers } from '../../lib/userHelpers.js'
import { comparePassword } from '../../lib/authHelpers.js'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const email = body.email?.toLowerCase().trim() || ''
    const password = body.password || ''
    
    console.log('═══════════════════════════════════════')
    console.log('🔐 ПОПЫТКА ВХОДА')
    console.log('📧 Email:', email)
    console.log('🔑 Пароль:', password)
    console.log('🔑 Длина пароля:', password.length)

    // Валидация
    if (!email || !password) {
      console.log('❌ Нет email или пароля')
      throw createError({
        statusCode: 400,
        statusMessage: 'Email и пароль обязательны'
      })
    }

    // Читаем пользователей
    console.log('📖 Чтение users.json...')
    const users = await readUsers()
    console.log('👥 Пользователей в базе:', users.length)
    
    // Выводим все emails для проверки
    users.forEach((u, i) => {
      console.log(`  [${i}] ${u.email} (${u.role})`)
    })

    // Ищем пользователя
    const user = users.find(u => u.email.toLowerCase() === email)
    
    if (!user) {
      console.log('❌ Пользователь НЕ НАЙДЕН:', email)
      throw createError({
        statusCode: 401,
        statusMessage: 'Неверный email или пароль'
      })
    }
    
    console.log('✅ Пользователь найден:', user.name)
    console.log('🔑 Хэш из базы:', user.password?.substring(0, 30) + '...')

    // Проверяем пароль напрямую (для отладки)
    console.log('🔑 Проверка пароля через bcrypt...')
    
    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log('🔑 Результат bcrypt.compare:', isPasswordValid)
    
    if (!isPasswordValid) {
      console.log('❌ НЕВЕРНЫЙ ПАРОЛЬ')
      
      // Попробуем захэшировать и сравнить
      const testHash = await bcrypt.hash(password, 12)
      console.log('🔑 Новый хэш для того же пароля:', testHash.substring(0, 30) + '...')
      
      throw createError({
        statusCode: 401,
        statusMessage: 'Неверный email или пароль'
      })
    }

    // Успешный вход
    console.log('✅ ПАРОЛЬ ВЕРНЫЙ!')
    
    // Создаём сессию
    const sessionData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        phone: user.phone || '',
        address: user.address || ''
      },
      createdAt: new Date().toISOString()
    }

    setCookie(event, 'user_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'lax'
    })

    // Обновляем lastLogin
    const userIndex = users.findIndex(u => u.id === user.id)
    if (userIndex !== -1) {
      users[userIndex].lastLogin = new Date().toISOString()
      await writeUsers(users)
    }

    const { password: _, ...userWithoutPassword } = user
    
    console.log('✅ УСПЕШНЫЙ ВХОД:', email)
    console.log('═══════════════════════════════════════')

    return {
      success: true,
      user: userWithoutPassword,
      message: 'Вход выполнен успешно'
    }

  } catch (error) {
    console.error('❌ ОШИБКА:', error.message)
    console.log('═══════════════════════════════════════')
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Ошибка при входе'
    })
  }
})