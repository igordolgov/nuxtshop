// server/api/auth/register.post.js

import { createUser, getUserByEmail, stripPassword } from '../../lib/userHelpers'
import { hashPassword } from '../../lib/password'
import { createSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = body.email?.toLowerCase().trim() || ''
  const name = body.name?.trim() || ''
  const password = body.password || ''

  if (!email || !password || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Все поля обязательны для заполнения' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный формат email' })
  }
  if (name.length < 2 || name.length > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Имя должно содержать от 2 до 50 символов' })
  }
  if (password.length < 6 || password.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Пароль должен содержать от 6 до 100 символов' })
  }
  if (await getUserByEmail(event, email)) {
    throw createError({ statusCode: 400, statusMessage: 'Пользователь с таким email уже существует' })
  }

  const user = await createUser(event, { name, email, password: await hashPassword(password) })
  await createSession(event, user.id)

  return { success: true, user: stripPassword(user), message: 'Регистрация успешна' }
})