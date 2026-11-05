// server/api/products/index.post.ts
// Создание товара (POST /api/products). Только админ.
// Категории ОБЯЗАТЕЛЬНЫ, форматы нормализует normalizeCategories
// (в productHelpers, общая с PUT):
//   categories: ['Электроника']         — массив строк
//   categories: 'Электроника, Техника'  — строка через запятую
//   categoriesInput: '...'              — строка через запятую (форма админки)
// Фиктивная категория «Другое» больше не подставляется:
// раньше она записывалась в KV при пустом поле и доезжала до корзины.
import {
  readProducts,
  writeProducts,
  slugify,
  generateUniqueSlug,
  normalizeCategories,
  applyLocalizedPatch,
  extractLocalizedPatch,
  sanitizeVariants,
  sanitizeVariantLabel,
  sanitizeOldPrice,
  sanitizeCharacteristics,
} from '../../lib/productHelpers';
import { requireAdmin } from '../../utils/auth';
import { processImage, processGallery } from '../../lib/imageStorage';

// Тело запроса: строгие поля + произвольные (нормализаторы сами разбирают
// categories/gallery/variants в любом допустимом формате)
type ProductBody = Record<string, unknown> & {
  name?: string;
  price?: string | number;
  description?: string;
  image?: string;
  gallery?: Array<string | null | undefined> | null;
  characteristics?: Record<string, string>;
  stockQuantity?: string | number;
};

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event);

    const body = await readBody<ProductBody>(event);
    if (!body?.name?.trim()) {
      throw createError({ statusCode: 400, message: 'Название товара обязательно' });
    }
    if (!body.price || Number.isNaN(parseFloat(String(body.price)))) {
      throw createError({ statusCode: 400, message: 'Цена товара обязательна' });
    }

    // Категории: обязательны (сообщения согласованы с валидацией в админке).
    // null → поле не пришло; для POST это так же пусто, как []
    const categories = normalizeCategories(body) ?? [];
    if (categories.length === 0) {
      throw createError({ statusCode: 400, message: 'Укажите хотя бы одну категорию' });
    }

    const products = await readProducts(event);

    const newId = products.length > 0 ? Math.max(...products.map((p) => Number(p.id) || 0)) + 1 : 1;
    const slug = generateUniqueSlug(slugify(body.name) || `product-${newId}`, products);

    // Fallback-картинка — СУЩЕСТВУЮЩИЙ файл (раньше был
    // /images/products/placeholder.webp, которого нет в public/images)
    let imageUrl = body.image || '/images/placeholder.jpg';
    if (body.image?.startsWith('data:image/')) {
      imageUrl = await processImage(event, body.image, 'main');
    }
    const gallery = await processGallery(event, body.gallery);

    const stockQuantity = parseInt(String(body.stockQuantity)) || 0;

    const now = new Date().toISOString();
    const price = parseFloat(String(body.price));
    const newProduct = applyLocalizedPatch(
      {
        id: String(newId),
        slug,
        name: body.name.trim(),
        description: body.description || '',
        price,
        // Скидка опциональна: мусор/<= price молча не попадает в запись
        oldPrice: sanitizeOldPrice(body.oldPrice, price),
        image: imageUrl,
        categories,
        gallery,
        inStock: stockQuantity > 0,
        stockQuantity,
        // Характеристики: санитайзер (мусор/пустые названия отбрасываются,
        // дубликаты схлопываются — битый ввод не ломает сохранение)
        characteristics: sanitizeCharacteristics(body.characteristics),
        // Варианты: при создании опциональны; битый вход молча отбрасывается
        variants: sanitizeVariants(body.variants),
        variantName: sanitizeVariantLabel(body.variantName),
        variantNameEn: sanitizeVariantLabel(body.variantNameEn),
        variantNameEs: sanitizeVariantLabel(body.variantNameEs),
        createdAt: now,
        updatedAt: now,
      },
      // Переводы (nameEn/…/categoriesEs) необязательны: пустые/нулевые
      // значения в новую запись не попадают — фолбэк на русский
      extractLocalizedPatch(body),
    );

    products.push(newProduct);
    await writeProducts(event, products);

    return { success: true, product: newProduct, message: 'Товар успешно добавлен' };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка добавления товара:', error);
    throw createError({ statusCode: 500, message: 'Не удалось добавить товар' });
  }
});
