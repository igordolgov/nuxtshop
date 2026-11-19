// app/sentry.loader.ts
// Мост для двухшагового динамического импорта Sentry.
//
// Зачем не импортировать sentry.client.init напрямую из плагина: Nuxt
// ставит <link rel=modulepreload> на динамические entry-чанки,
// подключённые ИЗ entry напрямую — SDK (~160 КБ raw) скачивался бы и
// компилировался при каждой загрузке страницы (Lighthouse считал его
// unused JavaScript, байты конкурировали за канал с LCP). Мост — крошечный
// промежуточный чанк: в preload попадает он, а настоящий SDK стартует
// только в idle (см. sentry-deferred.client.ts).
export function loadSentryInit(): Promise<typeof import('~/sentry.client.init')> {
  return import('~/sentry.client.init');
}
