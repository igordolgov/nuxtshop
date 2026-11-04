// server/api/admin/reviews/index.get.ts
// Все отзывы для модерации (GET /api/admin/reviews). Только админ.
// Обогащаются именем/слагом товара (для ссылок и понятного списка);
// удалённые из каталога товары дают null — отзыв остаётся удаляемым.
import { publicReviewView, sortReviewsDesc, readReviews } from '../../../lib/reviewHelpers';
import { readProducts } from '../../../lib/productHelpers';
import { requireAdmin } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const [reviews, products] = await Promise.all([readReviews(event), readProducts(event)]);
  const byId = new Map(products.map((p) => [String(p?.id), p]));

  const enriched = sortReviewsDesc(reviews).map((r) => {
    const product = byId.get(String(r.productId));
    return {
      // publicReviewView: helpfulBy (id пользователей) не нужен админке —
      // только счётчик «полезно»; ids пользователей остаются внутренним делом
      ...publicReviewView(r),
      productName: product?.name ?? null,
      productSlug: product?.slug ?? null,
    };
  });

  return {
    success: true,
    reviews: enriched,
    pending: reviews.filter((r) => !r.approved).length,
  };
});
