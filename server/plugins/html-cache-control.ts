// server/plugins/html-cache-control.ts — браузерный кэш для SSR-HTML.
//
// Проблема: у страниц без routeRules (личные, /compare, /admin/**) не было
// браузерных директив кэша — браузеры (особенно Opera на Android) держали
// устаревшую копию после деплоя, и пользователи не видели обновлений
// интерфейса, пока не делали жёсткое обновление. У SWR-страниц (/, /about…)
// Nitro выставляет только «s-maxage=60, stale-while-revalidate» — это
// директивы для CDN, браузер они ни к чему не обязывают.
//
// Решение для КАЖДОГО text/html-ответа:
//  • нет Cache-Control            → «no-cache» (ревалидация по ETag);
//  • только CDN-директивы (swr)   → добавляем «max-age=0, must-revalidate»,
//    сохраняя s-maxage/stale-while-revalidate для CDN;
//  • браузерная директива уже есть → не трогаем.
// API/статика (не text/html) не затрагиваются.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    const headers = response.headers ?? (response.headers = {});
    const ct = String(headers['content-type'] ?? event.node.res.getHeader('content-type') ?? '');
    if (!ct.includes('text/html')) return;
    const cur = String(headers['cache-control'] ?? event.node.res.getHeader('cache-control') ?? '');
    if (/(^|[,\s])(no-cache|no-store|max-age=0)/.test(cur)) return;
    const parts = ['max-age=0', 'must-revalidate'];
    const sm = /s-maxage=(\d+)/.exec(cur);
    if (sm) parts.push(`s-maxage=${sm[1]}`);
    if (/stale-while-revalidate/.test(cur)) parts.push('stale-while-revalidate');
    headers['cache-control'] = parts.join(', ');
  });
});
