// server/api/auth/logout-others.post.js
// «Выйти со всех других устройств» из «Настроек» (/settings):
// гасим все сессии пользователя, кроме текущей.
import { destroyOtherSessions } from '../../lib/sessions'
import { requireUser, SESSION_COOKIE } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const ended = await destroyOtherSessions(event, user.id, getCookie(event, SESSION_COOKIE))
  return {
    success: true,
    ended,
    message: ended > 0 ? `Завершено сессий на других устройствах: ${ended}` : 'Других активных сессий нет',
  }
})
