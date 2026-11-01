// server/api/admin/reviews/[id].delete.ts
// Удаление отзыва (DELETE /api/admin/reviews/:id). Только админ, необратимо.
import { readReviews, writeReviews } from '../../../lib/reviewHelpers'
import { requireAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const reviews = await readReviews(event)
  const next = reviews.filter((r) => String(r.id) !== String(id))
  if (next.length === reviews.length) {
    throw createError({ statusCode: 404, message: 'Отзыв не найден' })
  }

  await writeReviews(event, next)
  return { success: true, message: 'Отзыв удалён' }
})
