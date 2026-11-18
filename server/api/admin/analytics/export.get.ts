// server/api/admin/analytics/export.get.ts
// CSV-выгрузки аналитики (GET /api/admin/analytics/export?type=…&days=30).
// Менеджер или админ (staff). Три среза тем же диалектом «Excel RU», что и
// выгрузка заказов (BOM + «;» + CRLF, server/lib/csvHelpers.ts):
//   type=top-products — топ товаров за период (полный, без лимита страницы)
//   type=series       — продажи по дням (включая нулевые дни, как на графике)
//   type=promo-codes  — статистика промокодов за период
// Деньги — «сырые» числа (считаются формулами в Excel), валюта в заголовках.
import { computeAnalytics, computePromoAnalytics } from '../../../lib/analyticsHelpers';
import {
  analyticsSeriesToCsv,
  promoAnalyticsToCsv,
  topProductsToCsv,
} from '../../../lib/analyticsExport';
import { readOrders } from '../../../lib/orderHelpers';
import { readPromoCodes } from '../../../lib/promoHelpers';
import { requireStaff } from '../../../utils/auth';

const EXPORT_TYPES = ['top-products', 'series', 'promo-codes'] as const;
type ExportType = (typeof EXPORT_TYPES)[number];

/** ASCII-префикс имени файла (Content-Disposition без не-ASCII). */
const FILE_PREFIX: Record<ExportType, string> = {
  'top-products': 'analytics-top-products',
  series: 'analytics-daily',
  'promo-codes': 'analytics-promo-codes',
};

export default defineEventHandler(async (event) => {
  try {
    await requireStaff(event);

    const query = getQuery(event);
    const type = String(query.type ?? '') as ExportType;
    if (!EXPORT_TYPES.includes(type)) {
      throw createError({
        statusCode: 400,
        message: `Неизвестный тип выгрузки: ${type || '(пусто)'}. Доступны: ${EXPORT_TYPES.join(', ')}`,
      });
    }
    const days = Math.min(Math.max(parseInt(String(query.days)) || 30, 1), 365);

    const orders = await readOrders(event);
    const date = new Date().toISOString().slice(0, 10);

    let csv: string;
    if (type === 'series') {
      csv = analyticsSeriesToCsv(computeAnalytics(orders, days).series);
    } else if (type === 'promo-codes') {
      const promos = await readPromoCodes(event);
      csv = promoAnalyticsToCsv(computePromoAnalytics(orders, promos, days));
    } else {
      // Полный топ без лимита страницы (на странице — топ-8, в файле — все)
      const topLimit = Number.POSITIVE_INFINITY;
      csv = topProductsToCsv(computeAnalytics(orders, days, new Date(), topLimit).topProducts);
    }

    const filename = `${FILE_PREFIX[type]}-${date}.csv`;
    setHeaders(event, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
    });

    return csv;
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка CSV-экспорта аналитики:', error);
    throw createError({ statusCode: 500, message: 'Не удалось сформировать CSV' });
  }
});
