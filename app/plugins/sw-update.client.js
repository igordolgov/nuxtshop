// app/plugins/sw-update.client.js
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
//    - первые 3 секунды после загрузки (первый контроль страницы
//      свежим SW — это нормальный первый визит, не обновление);
//    - флаг в sessionStorage: одна перезагрузка на вкладку.
export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  const RELOADED_KEY = 'sw-autoreloaded'

  if (!sessionStorage.getItem(RELOADED_KEY)) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem(RELOADED_KEY)) return
      if (performance.now() < 3000) return
      sessionStorage.setItem(RELOADED_KEY, '1')
      window.location.reload()
    })
  }

  let lastCheck = 0
  const checkForUpdate = (force = false) => {
    const now = Date.now()
    if (!force && now - lastCheck < 5 * 60 * 1000) return
    lastCheck = now
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.update?.().catch(() => {}))
      .catch(() => {})
  }

  // Возврат на вкладку — типичный момент «я вернулся в магазин»
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })

  // Долгоживущие сессии без навигаций
  setInterval(() => checkForUpdate(true), 30 * 60 * 1000)

  // Скорый фоновый чек сразу после старта
  setTimeout(() => checkForUpdate(true), 60 * 1000)
})
