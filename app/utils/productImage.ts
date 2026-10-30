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

export function withImageFormat(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'images.unsplash.com') return url
    if (!parsed.searchParams.has('auto')) parsed.searchParams.set('auto', 'format')
    if (!parsed.searchParams.has('q')) parsed.searchParams.set('q', '75')
    return parsed.toString()
  } catch {
    // Некорректный URL возвращаем как есть — картинка уже имеет fallback
    // в вызывающих компонентах (onerror → placeholder)
    return url
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
// Только для локальных файлов: data-URI, /api/images/<key> (админ-загрузки)
// и внешние URL второй версии не имеют — возвращаем undefined, атрибут
// не выводится и поведение остаётся прежним.

const LOCAL_PRODUCT_IMAGE_RE = /^\/images\/products\/(photo-\d+-[a-f0-9]+)\.webp$/

/** srcset «400w + 800w» для локальных фото каталога или undefined. */
export function productSrcset(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  const m = url.match(LOCAL_PRODUCT_IMAGE_RE)
  if (!m) return undefined
  const id = m[1]
  return `/images/products/small/${id}.webp 400w, /images/products/${id}.webp 800w`
}
