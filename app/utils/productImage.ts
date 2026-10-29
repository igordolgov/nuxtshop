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
