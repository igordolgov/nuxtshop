// server/api/admin/store-reviews/index.get.ts
// Все отзывы о магазине для модерации (GET /api/admin/store-reviews). Только админ.
import { readStoreReviews, storeRatingSummary } from '../../../lib/storeReviewHelpers'
import { requireAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const reviews = await readStoreReviews(event)
  const sorted = [...reviews].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return {
    success: true,
    reviews: sorted,
    pending: sorted.filter((r) => !r.approved).length,
    summary: storeRatingSummary(sorted.filter((r) => r.approved)),
  }
})
