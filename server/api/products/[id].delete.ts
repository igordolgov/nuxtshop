// server/api/products/[id].delete.ts
import { readProducts, writeProducts } from '../../lib/productHelpers';
import { requireAdmin } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event);

    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID товара не указан' });
    }

    const products = await readProducts(event);
    const index = products.findIndex((p) => String(p.id) === String(id));
    // Сужение вместо проверки index (noUncheckedIndexedAccess)
    const deleted = products[index];
    if (!deleted) {
      throw createError({ statusCode: 404, message: 'Товар не найден' });
    }
    products.splice(index, 1);
    await writeProducts(event, products);

    // Картинки data-URI живут внутри JSON товара — отдельная очистка файлов не нужна
    return { success: true, message: `Товар "${deleted.name}" удалён`, deletedId: deleted.id };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка удаления товара:', error);
    throw createError({ statusCode: 500, message: 'Не удалось удалить товар' });
  }
});
