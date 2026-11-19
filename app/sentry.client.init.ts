// app/sentry.client.init.ts
// Фактическая инициализация клиентского Sentry — вызывается из
// sentry-deferred.client.ts ПОСЛЕ гидрации, когда главный поток свободен.
// Файл намеренно НЕ называется sentry.client.config.*: под этим именем
// модуль @sentry/nuxt инъектирует eager-плагины и SDK попадает в
// критический путь загрузки (два чанка ~78 КБ transfer, ~200 КБ parse,
// половина байт неиспользуемая на типичной загрузке — Lighthouse).
import { browserTracingIntegration, captureException, init as sentryInit } from '@sentry/nuxt';

// Тип роутера выводится из самой интеграции (без прямого импорта
// vue-router — транзитивная зависимость, knip: unlisted dependency).
type TracingRouter = NonNullable<Parameters<typeof browserTracingIntegration>[0]['router']>;

export interface InitSentryClientOptions {
  dsn: string;
  /** Роутер приложения: транзакции SPA-переходов (pageload-транзакция при
   *  отложенной инициализации не имеет смысла — стартовала бы через пару
   *  секунд после загрузки). */
  router?: TracingRouter;
  /** Ошибки, случившиеся до инициализации (буфер плагина). */
  pendingErrors: unknown[];
}

/** Тип-договор репортёра, который плагин использует после инициализации. */
export interface SentryReporter {
  captureException(error: unknown, info?: string): void;
}

export function initSentryClient(options: InitSentryClientOptions): SentryReporter {
  sentryInit({
    dsn: options.dsn,
    environment: 'production',
    // PII не собираем: только события, стеки и метки
    sendDefaultPii: false,
    // Перфоманс-транзакции SPA-переходов: 10% достаточно для витрины
    // (переходы каталог → карточка и т.п.), остальное — только события
    // ошибок. Настройки совпадают с прежним sentry.client.config.ts.
    tracesSampleRate: 0.1,
    integrations: [
      // Тот же провайдер, что ставил плагин модуля при eager-инициализации
      // (routeLabel: 'path' — имена транзакций по URL, не по record'ам)
      browserTracingIntegration({
        ...(options.router ? { router: options.router } : {}),
        routeLabel: 'path',
      }),
    ],
  });

  // Ошибки из окна до инициализации (главный поток был занят гидрацией)
  for (const error of options.pendingErrors) {
    sentryCapture(error);
  }

  return { captureException: sentryCapture };
}

function sentryCapture(error: unknown, info?: string): void {
  captureException(error, info ? { extra: { info } } : undefined);
}
