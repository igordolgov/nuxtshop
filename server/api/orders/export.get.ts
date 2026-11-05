// server/api/orders/export.get.ts
// CSV-выгрузка всех заказов (GET /api/orders/export). Менеджер или админ (staff).
//
// Формат «Excel RU»: BOM + разделитель «;» + CRLF (см. server/lib/csvHelpers.ts) —
// файл открывается двойным кликом в русском Excel без мастера импорта.
// Выгружаются ВСЕ заказы без лимита (лимит 500 есть только у списка в
// /api/orders — выгрузка для бухгалтерии должна быть полной).
// Дата/время в файле — UTC (детерминированно, колонка «Дата (UTC)»).
import { readOrders } from '../../lib/orderHelpers';
import { ordersToCsv } from '../../lib/csvHelpers';
import { requireStaff } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    await requireStaff(event);

    const orders = await readOrders(event);
    const csv = ordersToCsv(orders);
    const date = new Date().toISOString().slice(0, 10);

    setHeaders(event, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="orders-${date}.csv"; filename*=UTF-8''orders-${date}.csv`,
    });

    return csv;
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка CSV-экспорта заказов:', error);
    throw createError({ statusCode: 500, message: 'Не удалось сформировать CSV' });
  }
});
