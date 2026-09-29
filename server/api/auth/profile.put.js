// server/api/auth/profile.put.js
import { readUsers, writeUsers, stripPassword } from '../../lib/userHelpers'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const current = await requireUser(event)
  const body = await readBody(event)

  const users = await readUsers(event)
  const user = users.find((u) => u.id === current.id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Пользователь не найден' })

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length < 2 || name.length > 50) {
      throw createError({ statusCode: 400, statusMessage: 'Имя должно содержать от 2 до 50 символов' })
    }
    user.name = name
  }
  if (body.phone !== undefined) user.phone = String(body.phone).trim()
  if (body.address !== undefined) user.address = String(body.address).trim()
  user.updatedAt = new Date().toISOString()

  await writeUsers(event, users)
  return { success: true, user: stripPassword(user), message: 'Профиль обновлён' }
})