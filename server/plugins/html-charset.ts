// server/plugins/html-charset.ts — charset=utf-8 во ВСЕХ text/html-ответах.
//
// Проблема: проверяльщики скорости (Lighthouse/PSI, GTmetrix, PR-CY) ругались
// «Требуется задать кодировку символов» на редиректах. Обычные SSR-страницы
// отдаются Nitro'ом как «text/html;charset=utf-8», но h3 sendRedirect()
// (наш server/middleware/redirect.ts и SSR navigateTo в auth-middlewares)
// жёстко ставит «Content-Type: text/html» без charset. Хук render:response
// (html-cache-control.ts) сюда не доходит: редирект завершает запрос
// до конвейера рендеринга.
//
// Решение: на старте КАЖДОГО запроса оборачиваем event.node.res.setHeader —
// если кто-либо пытается выставить ровно «text/html», добавляем «; charset=utf-8».
// Один механизм закрывает и текущие, и будущие места редиректов; страницы
// и API (у них charset уже есть / это не HTML) не затрагиваются.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const res = event.node?.res;
    if (!res || res.__charsetPatched) return;
    res.__charsetPatched = true;
    const original = res.setHeader.bind(res);
    res.setHeader = (name: string, value: unknown) => {
      if (
        String(name).toLowerCase() === 'content-type' &&
        typeof value === 'string' &&
        value.trim() === 'text/html'
      ) {
        value = 'text/html; charset=utf-8';
      }
      return original(name, value);
    };
  });
});
