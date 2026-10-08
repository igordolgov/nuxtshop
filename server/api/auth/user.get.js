// server/api/auth/user.get.js
import { getSessionUser } from '../../utils/auth'
import { stripPassword } from '../../lib/userHelpers'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  return { success: true, user: user ? stripPassword(user) : null }
})