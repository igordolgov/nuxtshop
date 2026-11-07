// server/api/products/[id].delete.ts
import { readProducts, writeProducts } from '../../lib/productHelpers';
import { requireStaff } from '../../utils/auth';
import { adminActionLog } from '../../lib/logger';

export default defineEventHandler(async (event) => {
  try {
    const staff = await requireStaff(event);

    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID товара не указан',
        data: { code: 'productNoId' },
      });
    }

    const products = await readProducts(event);
    const index = products.findIndex((p) => String(p.id) === String(id));
    // Сужение вместо проверки index (noUncheckedIndexedAccess)
    const deleted = products[index];
    if (!deleted) {
      throw createError({
        statusCode: 404,
        message: 'Товар не найден',
        data: { code: 'productNotFound' },
      });
    }
    products.splice(index, 1);
    await writeProducts(event, products);

    // Удаление необратимо (корзины нет) — актёр обязателен в журнале
    adminActionLog.add({
      action: 'PRODUCT_DELETED',
      actor: { id: staff.id, email: staff.email, role: staff.role },
      product: { id: deleted.id, name: deleted.name },
    });

    // Картинки data-URI живут внутри JSON товара — отдельная очистка файлов не нужна
    return { success: true, message: `Товар "${deleted.name}" удалён`, deletedId: deleted.id };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка удаления товара:', error);
    throw createError({
      statusCode: 500,
      message: 'Не удалось удалить товар',
      data: { code: 'productDeleteFailed' },
    });
  }
});
