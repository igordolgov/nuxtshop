// server/api/products/[id]/history.get.ts
// История изменений товара (аудит) — для блока «История» в модалке
// редактирования. Менеджер или админ (staff). Удалённый товар тоже
// отвечает: ключ истории живёт в KV и после удаления записи товара.
import { readProductHistory } from '../../../lib/productHistory';
import { requireStaff } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    await requireStaff(event);

    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID товара не указан',
        data: { code: 'productNoId' },
      });
    }

    const history = await readProductHistory(event, id);
    return { success: true, history };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка чтения истории товара:', error);
    throw createError({
      statusCode: 500,
      message: 'Не удалось загрузить историю товара',
      data: { code: 'productHistoryFailed' },
    });
  }
});
