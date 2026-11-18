// app/utils/productImage.ts
// Единая нормализация URL картинок товаров.
//
// Зачем: почти все фото каталога лежат на images.unsplash.com. Без
// параметра auto=format Unsplash отдаёт исходный JPEG — аудит скорости
// (Lighthouse/СеоЛик) помечает это как «Форматы изображений»: нет
// WebP/AVIF. withImageFormat() добавляет auto=format (браузер получает
// WebP/AVIF по Accept-заголовку) и q=75, если параметры ещё не заданы.
//
// Используется из resolve-функций ProductCardGrid / ProductGallery /
// ProductCardFavorite (автоимпорт из app/utils, см. imports.dirs).

export function withImageFormat(url: string, width?: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'images.unsplash.com') return url;
    if (!parsed.searchParams.has('auto')) parsed.searchParams.set('auto', 'format');
    if (!parsed.searchParams.has('q')) parsed.searchParams.set('q', '75');
    // Ширина по запросу карточки: без w= Unsplash отдаёт ОРИГИНАЛ
    // (3000-5000px, сотни KB) в слот ~200-300 CSS px. Явный w= админа
    // не трогаем — он задан сознательно.
    if (width && !parsed.searchParams.has('w')) parsed.searchParams.set('w', String(width));
    return parsed.toString();
  } catch {
    // Некорректный URL возвращаем как есть — картинка уже имеет fallback
    // в вызывающих компонентах (onerror → placeholder)
    return url;
  }
}

// ─── Миниатюры каталога (srcset) ─────────────────────────────────────────────
//
// Локальные фото существуют в двух версиях: /images/products/<id>.webp (800w)
// и /images/products/small/<id>.webp (400w, тот же crop-параметр Unsplash).
// Карточки каталога рисуют фото площадью ~180-300 CSS px (aspect-square,
// object-fit:cover), поэтому 800w втрое-вшестеро избыточен — Lighthouse
// «image-delivery» насчитывал ~674 KiB экономии на главной. productSrcset()
// включает выбор версии браузером через srcset/sizes.
//
// Unsplash-URL (без явного w= админа) получают тот же ряд 400w/800w через
// параметр imgix w= — иначе в src= уходил бы оригинал в полном разрешении.
// data-URI, /api/images/<key> (админ-загрузки), URL с явным w= и
// некорректные строки — undefined, атрибут не выводится, поведение прежнее.

const LOCAL_PRODUCT_IMAGE_RE = /^\/images\/products\/(photo-\d+-[a-f0-9]+)\.webp$/;

/**
 * srcset «400w + 800w» для фото каталога: локальных файлов (две версии на
 * диске) и Unsplash-URL (параметр imgix w=). Для остальных входов —
 * undefined (админ-загрузки /api/images, data-URI, URL с явным w=).
 */
export function productSrcset(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const m = url.match(LOCAL_PRODUCT_IMAGE_RE);
  if (m) {
    const id = m[1];
    return `/images/products/small/${id}.webp 400w, /images/products/${id}.webp 800w`;
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === 'images.unsplash.com' &&
      parsed.pathname.startsWith('/photo-') &&
      !parsed.searchParams.has('w')
    ) {
      const withParams = withImageFormat(parsed.toString()); // auto=format + q=75
      const at = (w: number) => {
        const u = new URL(withParams);
        u.searchParams.set('w', String(w));
        return `${u.toString()} ${w}w`;
      };
      return `${at(400)}, ${at(800)}`;
    }
  } catch {
    // Некорректный URL — undefined, как и раньше
  }
  return undefined;
}
