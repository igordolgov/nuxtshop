import * as Sentry from '@sentry/nuxt';

// Клиентский Sentry: мониторинг ошибок витрины (Vue, консоль, сеть).
// Модуль @sentry/nuxt оборачивает этот файл в Nuxt-плагин —
// useRuntimeConfig() доступен (experimental.asyncContext включён).
//
// DSN задаётся на рантайме var NUXT_PUBLIC_SENTRY_DSN (vars в
// wrangler.jsonc или дашборд воркера). Пусто → SDK стартует без DSN
// и НИЧЕГО не отправляет: витрина без настроенного Sentry работает
// как раньше, бандл перезаливать не нужно.
let dsn: string | undefined;
try {
  dsn = useRuntimeConfig().public.sentryDsn || undefined;
} catch {
  // Вне Nuxt-контекста (крайний случай) — SDK остаётся выключенным
  dsn = undefined;
}

Sentry.init({
  dsn,
  environment: 'production',
  // PII не собираем: только события, стеки и метки
  sendDefaultPii: false,
  // Перфоманс-транзакции: 10% достаточно для витрины (загрузки страниц,
  // переходы каталог → карточка), остальное — только события ошибок
  tracesSampleRate: 0.1,
});
