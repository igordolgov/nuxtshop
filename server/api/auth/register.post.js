// server/api/auth/register.post.js
import { readUsers, writeUsers } from '../../lib/userHelpers.js'
import { hashPassword } from '../../lib/authHelpers.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Логирование регистраций
const logRegistration = async (email, success, ip, reason = null) => {
  try {
    const logDir = join(process.cwd(), 'server', 'logs')
    const logFile = join(logDir, 'registrations.json')
    
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
    
    let logs = []
    if (existsSync(logFile)) {
      logs = JSON.parse(readFileSync(logFile, 'utf-8') || '[]')
    }
    
    logs.unshift({
      timestamp: new Date().toISOString(),
      email,
      success,
      ip,
      reason
    })
    
    if (logs.length > 500) logs = logs.slice(0, 500)
    writeFileSync(logFile, JSON.stringify(logs, null, 2))
  } catch (e) {
    console.error('Ошибка логирования:', e)
  }
}

// Валидация email
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
    
    const ip = getRequestHeader(event, 'x-forwarded-for') || 
               getRequestHeader(event, 'x-real-ip') || 
               'unknown'
    
    console.log('👤 POST /api/auth/register:', email)

    // ====== ВАЛИДАЦИЯ ======
    
    // Проверка обязательных полей
    if (!body.email || !body.password || !body.name) {
      await logRegistration(email, false, ip, 'Missing required fields')
      throw createError({
        statusCode: 400,
        statusMessage: 'Все поля обязательны для заполнения'
      })
    }

    // Валидация email
    if (!isValidEmail(email)) {
      await logRegistration(email, false, ip, 'Invalid email format')
      throw createError({
        statusCode: 400,
        statusMessage: 'Некорректный формат email'
      })
    }

    // Валидация имени
    const name = body.name.trim()
    if (name.length < 2) {
      await logRegistration(email, false, ip, 'Name too short')
      throw createError({
        statusCode: 400,
        statusMessage: 'Имя должно содержать минимум 2 символа'
      })
    }
    
    if (name.length > 50) {
      await logRegistration(email, false, ip, 'Name too long')
      throw createError({
        statusCode: 400,
        statusMessage: 'Имя слишком длинное'
      })
    }

    // Валидация пароля
    if (body.password.length < 6) {
      await logRegistration(email, false, ip, 'Password too short')
      throw createError({
        statusCode: 400,
        statusMessage: 'Пароль должен содержать минимум 6 символов'
      })
    }
    
    if (body.password.length > 100) {
      await logRegistration(email, false, ip, 'Password too long')
      throw createError({
        statusCode: 400,
        statusMessage: 'Пароль слишком длинный'
      })
    }

    // ====== ПРОВЕРКА СУЩЕСТВУЮЩЕГО ПОЛЬЗОВАТЕЛЯ ======
    const users = await readUsers()
    console.log(`📊 Пользователей в базе: ${users.length}`)
    
    const existingUser = users.find(u => u.email.toLowerCase() === email)
    
    if (existingUser) {
      console.log('❌ Email уже занят:', email)
      await logRegistration(email, false, ip, 'Email already exists')
      throw createError({
        statusCode: 400,
        statusMessage: 'Пользователь с таким email уже существует'
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    }

    // Сохраняем
    users.push(newUser)
    await writeUsers(users)
    
    console.log(`✅ Пользователь создан: ${email}`)

    // ====== СОЗДАЕМ СЕССИЮ ======
    const sessionData = {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        address: newUser.address
      },
      createdAt: new Date().toISOString()
    }

    setCookie(event, 'user_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
      sameSite: 'lax'
    })

    // ====== ЛОГИРУЕМ УСПЕШНУЮ РЕГИСТРАЦИЮ ======
    await logRegistration(email, true, ip)

    const { password, ...userWithoutPassword } = newUser
    
    const duration = Date.now() - startTime
    console.log(`✅ Регистрация завершена: ${email} (${duration}ms)`)

    return {
      success: true,
      user: userWithoutPassword,
      message: 'Регистрация успешна'
    }

  } catch (error) {
    console.error('❌ Ошибка регистрации:', error.message)
    
    throw createError({
      statusCode: error.statusCode || 400,
      statusMessage: error.statusMessage || 'Ошибка при регистрации'
    })
  }
})