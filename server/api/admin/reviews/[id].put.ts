// server/api/admin/reviews/[id].put.ts
// Модерация отзыва (PUT /api/admin/reviews/:id, body: { approved: boolean }).
// true — опубликовать на витрине (и в aggregateRating), false — скрыть.
import { readReviews, writeReviews } from '../../../lib/reviewHelpers'
import { requireAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  if (typeof body?.approved !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Поле approved обязательно (true/false)' })
  }

  const reviews = await readReviews(event)
  const item = reviews.find((r) => String(r.id) === String(id))
  if (!item) {
    throw createError({ statusCode: 404, message: 'Отзыв не найден' })
  }

  item.approved = body.approved
  await writeReviews(event, reviews)

  return {
    success: true,
    review: item,
    message: body.approved ? 'Отзыв опубликован' : 'Отзыв скрыт с витрины',
  }
})
