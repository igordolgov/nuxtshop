// app/plugins/sw-update.client.ts
// Самолечение PWA: телефон может неделями держать приложение в памяти
// без новой навигации — service worker тогда не проверяет обновления,
// и посетитель застревает на старой версии (симптом: «исправил, а у
// меня всё по-старому»).
//
// 1) Периодическая проверка: при возврате на вкладку и раз в 30 минут
//    просим registration.update() (не чаще раза в 5 минут).
// 2) Автоперезагрузка ОДИН раз за вкладку, когда новый SW уже взял
//    управление страницей (vite-pwa autoUpdate + skipWaiting): без
//    reload страница продолжает жить на старых ассетах, пока её
//    вручную не закроешь. Guard-и от ложных перезагрузок:
//    - страница НЕ была под контролем SW на момент загрузки
//      (controller === null → это первый визит; активация и claim
//      страницы свежим SW — норма, а не обновление, reload не нужен).
//      Раньше здесь был таймер «3 секунды», но workbox при первом
//      визите прекеширует ~700 КБ ассетов — на медленных сетях
//      активация заканчивается ПОЗЖЕ трёх секунд, и первый визит
//      перезагружался (Lighthouse ловил двойную загрузку страницы:
//      TBT ×2, второй документ на ~5-й секунде);
//    - флаг в sessionStorage: одна перезагрузка на вкладку.
export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return;

  const RELOADED_KEY = 'sw-autoreloaded';

  // Читается ДО регистрации SW (см. offline-init): если SW уже управлял
  // страницей на момент загрузки, только его смена считается обновлением.
  const wasControlledAtStart = navigator.serviceWorker.controller !== null;

  if (!sessionStorage.getItem(RELOADED_KEY)) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wasControlledAtStart) return;
      if (sessionStorage.getItem(RELOADED_KEY)) return;
      sessionStorage.setItem(RELOADED_KEY, '1');
      window.location.reload();
    });
  }

  let lastCheck = 0;
  const checkForUpdate = (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheck < 5 * 60 * 1000) return;
    lastCheck = now;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.update?.().catch(() => {}))
      .catch(() => {});
  };

  // Возврат на вкладку — типичный момент «я вернулся в магазин»
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });

  // Долгоживущие сессии без навигаций
  setInterval(() => checkForUpdate(true), 30 * 60 * 1000);

  // Скорый фоновый чек сразу после старта
  setTimeout(() => checkForUpdate(true), 60 * 1000);
});
