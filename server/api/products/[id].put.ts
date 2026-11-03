// server/api/products/[id].put.ts
import {
  readProducts,
  writeProducts,
  slugify,
  generateUniqueSlug,
  normalizeCategories,
  extractLocalizedPatch,
  applyLocalizedPatch,
  sanitizeVariants,
  sanitizeVariantLabel,
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

    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID товара не указан' });
    }

    const body = await readBody<ProductBody>(event);

    const products = await readProducts(event);
    const index = products.findIndex((p) => String(p.id) === String(id));
    if (index === -1) {
      throw createError({ statusCode: 404, message: 'Товар не найден' });
    }

    const existing = products[index];

    // Slug: если изменилось имя — генерируем заново, иначе оставляем
    let slug = existing.slug;
    if (body.name && body.name.trim() !== existing.name) {
      slug = generateUniqueSlug(slugify(body.name), products, existing.id);
    }

    let imageUrl = existing.image;
    if (body.image?.startsWith('data:image/')) {
      imageUrl = await processImage(event, body.image, 'main');
    } else if (body.image) {
      imageUrl = body.image;
    }

    const gallery =
      body.gallery !== undefined ? await processGallery(event, body.gallery) : existing.gallery;

    const stockQuantity =
      body.stockQuantity !== undefined
        ? parseInt(String(body.stockQuantity)) || 0
        : existing.stockQuantity;

    // Категории: нормализуем все поддерживаемые форматы (массив, [{name}], CSV).
    // Поле пришло пустым — явная ошибка, а не молчаливое сохранение старых
    // (раньше очистка поля в редакторе незаметно оставляла прежние категории).
    // Поле не пришло вовсе (null) — категории не трогаем.
    const categories = normalizeCategories(body);
    if (categories !== null && categories.length === 0) {
      throw createError({ statusCode: 400, message: 'Укажите хотя бы одну категорию' });
    }

    const updated = applyLocalizedPatch(
      {
        ...existing,
        name: body.name?.trim() ?? existing.name,
        description: body.description ?? existing.description,
        price: body.price !== undefined ? parseFloat(String(body.price)) : existing.price,
        image: imageUrl,
        gallery,
        categories: categories ?? existing.categories,
        inStock: stockQuantity > 0,
        stockQuantity,
        characteristics: body.characteristics ?? existing.characteristics,
        // Варианты (цвет/память): не пришли — не трогаем; пришли —
        // санитайзер; [] — удалить (товар без вариантов)
        variants: body.variants !== undefined ? sanitizeVariants(body.variants) : existing.variants,
        variantName:
          body.variantName !== undefined
            ? sanitizeVariantLabel(body.variantName)
            : existing.variantName,
        variantNameEn:
          body.variantNameEn !== undefined
            ? sanitizeVariantLabel(body.variantNameEn)
            : existing.variantNameEn,
        variantNameEs:
          body.variantNameEs !== undefined
            ? sanitizeVariantLabel(body.variantNameEs)
            : existing.variantNameEs,
        slug,
        updatedAt: new Date().toISOString(),
      },
      // Переводы (nameEn/…/categoriesEs): не пришли — не трогаем;
      // ''/null — удалить (фолбэк на русский); строка — сохранить
      extractLocalizedPatch(body),
    );

    products[index] = updated;
    await writeProducts(event, products);

    return { success: true, product: updated, message: 'Товар обновлён' };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка обновления товара:', error);
    throw createError({ statusCode: 500, message: 'Не удалось обновить товар' });
  }
});
