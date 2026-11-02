// server/api/store-reviews/index.get.ts
// Одобренные отзывы о магазине (GET /api/store-reviews). Публично.
// Показываются блоком на странице «О магазине» (/about).
import { approvedStoreReviews, readStoreReviews, storeRatingSummary } from '../../lib/storeReviewHelpers'

export default defineEventHandler(async (event) => {
  const reviews = await readStoreReviews(event)
  const list = approvedStoreReviews(reviews)
  return { success: true, reviews: list, summary: storeRatingSummary(list) }
})
