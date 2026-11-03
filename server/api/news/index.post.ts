// server/api/news/index.post.ts
// Создание новости (POST /api/news). Только админ.
// Валидация в sanitizeNewsItem (newsHelpers — общая с PUT, покрыта тестами):
// кидает NewsValidationError с сообщением на русском → отдаём как 400.
import {
  NewsValidationError,
  applySanitizedNews,
  nextNewsId,
  readNews,
  sanitizeNewsItem,
  writeNews,
} from '../../lib/newsHelpers';
import { processImage } from '../../lib/imageStorage';
import { sendNewsPost } from '../../lib/telegram';
import { requireAdmin } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event);

    const body = await readBody(event);
    const clean = sanitizeNewsItem(body ?? {});
    // Фото из админки приходит data-URI (клиентский ресайз в webp) —
    // уезжает в KV под img:news/…, в записи остаётся короткий /api/images/<key>.
    // Строки-пути/URL проходят насквозь без изменений (см. processImage).
    const image = await processImage(event, clean.image, 'main', 'news/news');

    const news = await readNews(event);
    // applySanitizedNews применяет и базовые поля, и переводы (null → поле
    // не ставится); фото переопределяем результатом processImage.
    const item = applySanitizedNews({ id: nextNewsId(news) } as never, clean);
    item.image = image;
    news.push(item);
    await writeNews(event, news);

    // Telegram-постинг только при публикации: черновик уходит в KV тихо.
    // Сбой бота/сети не ломает создание новости; без секретов — no-op (false).
    let telegramPosted = false;
    if (item.published !== false) {
      try {
        const env = event.context.cloudflare?.env;
        telegramPosted = await sendNewsPost(env, item, getRequestURL(event).origin);
      } catch (e) {
        console.warn('news: telegram-постинг не удался', e);
      }
    }

    return {
      success: true,
      news: item,
      telegramPosted,
      message:
        item.published === false
          ? 'Черновик сохранён — на витрине он не виден, для публикации откройте его и включите тумблер'
          : telegramPosted
            ? 'Новость добавлена и отправлена в Telegram'
            : 'Новость добавлена',
    };
  } catch (error) {
    if (error instanceof NewsValidationError) {
      throw createError({ statusCode: 400, message: error.message });
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка добавления новости:', error);
    throw createError({ statusCode: 500, message: 'Не удалось добавить новость' });
  }
});
