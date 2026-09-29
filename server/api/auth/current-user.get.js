// server/api/auth/current-user.get.js
import { getSessionUser } from '../../utils/auth'
import { stripPassword } from '../../lib/userHelpers'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  // Не кидаем 401 — эндпоинт вызывается на каждой загрузке страницы,
  // отсутствие сессии это нормальное состояние, а не ошибка
  return { success: true, user: user ? stripPassword(user) : null }
})