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
// события, SDK динамически импортируется, когда главный поток свободен
// (requestIdleCallback, потолок 2 с), и вычитывает буфер. Трейд:
// события в первые ~2 секунды после гидрации уходят после
// инициализации, а не в момент возникновения; pageload-транзакция
// не существует, транзакции SPA-переходов сохранены.
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

  // Главный поток свободен после гидрации; потолок 2 с, чтобы долго
  // загружающаяся страница всё же получила мониторинг.
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(start, { timeout: 2000 });
  } else {
    setTimeout(start, 1500);
  }
});
