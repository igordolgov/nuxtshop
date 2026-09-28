// server/api/auth/register.post.js
import { readUsers, writeUsers } from '../../lib/userHelpers.js'
import { hashPassword } from '../../lib/authHelpers.js'
import { registrationLog } from '../../lib/logger.js'

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  let email = ''

  try {
    const body = await readBody(event)
    email = body.email?.toLowerCase().trim() || ''

    const ip =
      getRequestHeader(event, 'x-forwarded-for') ||
      getRequestHeader(event, 'x-real-ip') ||
      'unknown'

    console.log('👤 POST /api/auth/register:', email)

    // ====== ВАЛИДАЦИЯ ======
    if (!body.email || !body.password || !body.name) {
      registrationLog.add({ email, success: false, ip, reason: 'Missing required fields' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Все поля обязательны для заполнения',
      })
    }

    if (!isValidEmail(email)) {
      registrationLog.add({ email, success: false, ip, reason: 'Invalid email format' })
      throw createError({ statusCode: 400, statusMessage: 'Некорректный формат email' })
    }

    const name = body.name.trim()
    if (name.length < 2) {
      registrationLog.add({ email, success: false, ip, reason: 'Name too short' })
      throw createError({ statusCode: 400, statusMessage: 'Имя должно содержать минимум 2 символа' })
    }

    if (name.length > 50) {
      registrationLog.add({ email, success: false, ip, reason: 'Name too long' })
      throw createError({ statusCode: 400, statusMessage: 'Имя слишком длинное' })
    }

    if (body.password.length < 6) {
      registrationLog.add({ email, success: false, ip, reason: 'Password too short' })
      throw createError({ statusCode: 400, statusMessage: 'Пароль должен содержать минимум 6 символов' })
    }

    if (body.password.length > 100) {
      registrationLog.add({ email, success: false, ip, reason: 'Password too long' })
      throw createError({ statusCode: 400, statusMessage: 'Пароль слишком длинный' })
    }

    // ====== ПРОВЕРКА СУЩЕСТВУЮЩЕГО ПОЛЬЗОВАТЕЛЯ ======
    const users = await readUsers()
    console.log(`📊 Пользователей в базе: ${users.length}`)

    const existingUser = users.find((u) => u.email.toLowerCase() === email)
    if (existingUser) {
      console.log('❌ Email уже занят:', email)
      registrationLog.add({ email, success: false, ip, reason: 'Email already exists' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Пользователь с таким email уже существует',
      })
    }

    // ====== СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ ======
    console.log('🔑 Хэширование пароля...')
    const hashedPassword = await hashPassword(body.password)

    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      role: 'user',
      phone: '',
      address: '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    }

    users.push(newUser)
    await writeUsers(users)

    console.log(`✅ Пользователь создан: ${email}`)

    // ====== СОЗДАЁМ СЕССИЮ ======
    const sessionData = {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        address: newUser.address,
      },
      createdAt: new Date().toISOString(),
    }

    setCookie(event, 'user_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'lax',
    })

    registrationLog.add({ email, success: true, ip })

    const { password, ...userWithoutPassword } = newUser

    const duration = Date.now() - startTime
    console.log(`✅ Регистрация завершена: ${email} (${duration}ms)`)

    return {
      success: true,
      user: userWithoutPassword,
      message: 'Регистрация успешна',
    }
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error.message)

    throw createError({
      statusCode: error.statusCode || 400,
      statusMessage: error.statusMessage || 'Ошибка при регистрации',
    })
  }
})