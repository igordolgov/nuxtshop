// app/providers/cfWorkersImage.ts
/**
 * Кастомный провайдер @nuxt/image для Cloudflare Workers (*.workers.dev).
 *
 * Почему не встроенный `cloudflare`: он строит URL вида
 * /cdn-cgi/image/w=400,.../path — эта схема включается только на
 * СОБСТВЕННОЙ зоне (Images → Transformations в дашборде), на workers.dev
 * она не работает. Здесь URL строится на наш роут-трансформатор
 * (server/routes/img.ts), а тот уже применяет cf.image методом
 * «Transform via fetch» — единственный документированный способ для
 * workers.dev.
 *
 * Почему не `none`: провайдер должен быть настоящим, чтобы NuxtImg
 * сам генерировал srcset по `sizes` (пока `sizes` не передан — src один).
 * Ручные :srcset в компонентах (productSrcset) по-прежнему перекрывают
 * сгенерированный — их поведение не меняется до отдельной фазы миграции.
 *
 * base URL задаётся в nuxt.config.ts → image.providers.cfworkers.options
 * (стандартное для провайдеров поле baseURL = путь роута /img).
 *
 * Файл импортируется и в клиентский бандл (генерация URL при гидратации),
 * поэтому только чистый JS без зависимостей: ufo не импортируем — knip
 * требует указывать прямые зависимости, а ради двух функций тянуть пакет
 * в package.json незачем (encodeURIComponent стандартизован).
 */

import { defineProvider } from '@nuxt/image/runtime';

/** Абсолютный URL: протокол data:, blob:, http(s):, mailto: и т.п. */
const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export default defineProvider({
  getImage: (src, { modifiers = {}, baseURL = '/img' }) => {
    // Внешние URL (Unsplash — уже оптимизированы на их CDN), blob:, data:
    // и прочие абсолютные адреса трансформировать не нужно и нельзя:
    // роут /img принимает только внутренние пути (SSRF-защита).
    if (ABSOLUTE_URL_RE.test(src)) {
      return { url: src };
    }

    // Модификаторы → query трансформатора. Передаём только заданное:
    // дефолты (q=75) — на стороне роута, единая точка правды.
    const params: Record<string, string> = { src };
    const { width, height, quality, format, fit } = modifiers as Record<string, unknown>;
    if (width) params.w = String(width);
    if (height) params.h = String(height);
    if (quality) params.q = String(quality);
    if (format) params.f = String(format);
    if (fit) params.fit = String(fit);

    const search = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return { url: `${baseURL}?${search}` };
  },
});
