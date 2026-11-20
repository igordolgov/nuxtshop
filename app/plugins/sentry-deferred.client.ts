// app/plugins/sentry-deferred.client.ts
// Отложенный клиентский Sentry: SDK уходит с критического пути гидрации.
//
// Было: модуль @sentry/nuxt инъекцировал eager-плагины из
// sentry.client.config.ts — SDK (два чанка ~78 КБ transfer, ~200 КБ parse,
// половина байт неиспользуемая на типичной загрузке) грузился и
// исполнялся ДО интерактивности. Lighthouse (mobile) приписывал этому
// сотни миллисекунд TBT карточки товара.
//
// Стало: хуки ошибок (vue:error, app:error) ставятся сразу и буферизуют
// события, SDK динамически импортируется ПОСЛЕ события load, когда
// главный поток свободен (requestIdleCallback, потолок 4 с), и вычитывает
// буфер. Трейд: события до load уходят после инициализации, а не в момент
// возникновения; pageload-транзакция не существует, транзакции
// SPA-переходов сохранены.
//
// Без DSN SDK не грузится вовсе (раньше грузился всегда) — витрина без
// настроенного Sentry не платит ни байта.
//
// Конвенция sentry.client.config.ts больше не используется: файл удалён,
// модуль не инъекцирует клиентские плагины. source maps upload не был
// настроен (нет SENTRY_AUTH_TOKEN) — терять нечего. Серверный форвардер
// server/plugins/sentry-error.ts не зависит от клиентского SDK.
export default defineNuxtPlugin((nuxtApp) => {
  // 3xx/4xx — нормальные ответы витрины (404 несуществующего товара и
  // пр.), не ошибки: то же правило, что у модульного плагина и
  // серверного форвардера.
  const isIgnored = (error: unknown) => {
    const code =
      (error as { statusCode?: number } | undefined)?.statusCode ??
      (error as { status?: number } | undefined)?.status;
    return typeof code === 'number' && code >= 300 && code < 500;
  };

  let reporter: import('~/sentry.client.init').SentryReporter | null = null;
  const pending: { error: unknown; info?: string }[] = [];
  const report = (error: unknown, info?: string) => {
    if (isIgnored(error)) return;
    if (reporter) reporter.captureException(error, info);
    else if (pending.length < 20) pending.push({ error, info });
  };

  nuxtApp.hook('vue:error', (error, _instance, info) => report(error, info));
  nuxtApp.hook('app:error', (error) => report(error));

  let dsn: string | undefined;
  try {
    dsn = useRuntimeConfig().public.sentryDsn || undefined;
  } catch {
    // Вне Nuxt-контекста — SDK остаётся выключенным
    return;
  }
  if (!dsn) return;

  const start = () => {
    // Двухшаговый импорт (плагин → крошечный мост → init+SDK): прямой
    // динамический импорт из entry заставил бы Nuxt preload-ить SDK
    // в HTML — см. app/sentry.loader.ts.
    import('~/sentry.loader')
      .then(({ loadSentryInit }) => loadSentryInit())
      .then(({ initSentryClient }) => {
        reporter = initSentryClient({
          dsn,
          router: nuxtApp.$router,
          pendingErrors: pending.splice(0, pending.length).map((p) => p.error),
        });
      })
      .catch(() => {
        // SDK не загрузился (сеть/блокировщик) — мониторинг молчит,
        // витрина не должна падать из-за наблюдаемости
      });
  };

  // Старт — только ПОСЛЕ события load: голый requestIdleCallback
  // срабатывает в микро-idle между задачами гидрации (на карточке товара
  // — t=650 мс), SDK начинал скачиваться и исполняться прямо между
  // готовностью LCP-картинки и её отрисовкой — Lighthouse приписывал
  // этому ~+500 мс LCP (2240 против 1753 мс при том же TBT 660).
  // load гасит конкуренцию за канал (картинки/шрифты уже доехали) и за
  // окно отрисовки. После load rIC запускает импорт, как только главный
  // поток реально свободен.
  //
  // Потолок 10 с (было 4 с): eval ядра SDK ~160 КБ — это задача 120-170 мс,
  // и при потолке 4 с она стабильно попадала в окно TBT главной (LH: задача
  // k10-B-L9 120 мс на t≈4.7 с при TTI 4.7 с, mobile/4x). 10 с уводят её
  // за TTI — TBT главной −~120 мс в лаборатории; в реале SDK стартует
  // прежним rIC'ом сразу, как только поток свободен (потолок — лишь
  // страховка для страниц, где idle не наступает вовсе). Мониторинг
  // ошибок первых секунд не теряется: буфер (до 20) вычитывается при
  // инициализации.
  //
  // Трейд: если какой-то субресурс завис и load не пришёл вовсе,
  // мониторинг на этом pageview не стартует — ошибки остаются в буфере
  // (до 20). Цена приемлема: зависший субресурс — редкость, а
  // eager-Sentry (5fc93a4) стоил сотни мс TBT и не улучшал LCP.
  const kickIdle = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(start, { timeout: 10000 });
    } else {
      setTimeout(start, 1500);
    }
  };
  if (document.readyState === 'complete') {
    // Плагин исполнился после load (восстановление, кеш) — не ждать
    // события, которое уже не наступит
    kickIdle();
  } else {
    window.addEventListener('load', kickIdle, { once: true });
  }
});
