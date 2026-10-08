
// server/api/auth/login.post.js
import { readUsers, writeUsers, stripPassword } from '../../lib/userHelpers'
import { comparePassword } from '../../lib/password'
import { createSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = body.email?.toLowerCase().trim() || ''
  const password = body.password || ''

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email и пароль обязательны' })
  }

  const users = await readUsers(event)
  const user = users.find((u) => u.email?.toLowerCase() === email)

  // Одинаковый ответ для «нет пользователя» и «неверный пароль» — не раскрываем email'ы
  if (!user || !(await comparePassword(password, user.password ?? ''))) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный email или пароль' })
  }

  user.lastLogin = new Date().toISOString()
  user.updatedAt = user.lastLogin
  await writeUsers(event, users)

  await createSession(event, user.id)
  return { success: true, user: stripPassword(user), message: 'Вход выполнен успешно' }
})