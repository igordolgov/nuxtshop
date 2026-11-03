// middleware/auth-init.global.ts
// ============================================
// Разовая инициализация приложения (каталог, auth, фильтры).
//
// ВАЖНО про тайминг: route-middleware на первой загрузке выполняется ДО
// гидратации страницы. Любой await здесь (loadProducts, checkAuth) — сеть,
// а Suspense ждёт middleware: стейт успевает измениться ещё до того, как
// страница начнёт гидратироваться. SSR же отрендерил страницу по СТАРОМУ
// стейту (каталог пуст, пользователь гость) → клиентский рендер при
// гидратации расходится с SSR-HTML → hydration mismatch. В production Vue
// патчит DOM позиционно, не пересоздавая дерево: таблица /admin/products
// оказывалась ВНУТРИ узлов пустого состояния (центрирование + opacity-30
// предка), обёртки .table-wrapper/.desktop-table не создавались — «блеклая
// неактивная таблица по центру» после F5 или смены языка (оба сценария =
// полная загрузка страницы). Тот же механизм давал node mismatch в шапке.
//
// Лечение: в middleware не трогаем стейт вовсе. Инициализация стартует
// строго ПОСЛЕ app:suspense:resolve (страница полностью гидратирована),
// дальше стейт меняется штатным реактивным патчем. Побочный эффект: при
// перезагрузке страница на долю секунды рендерится по SSR-стейту, затем
// догружается — обычный hydration-safe паттерн.
// ============================================

// Защита от повторного планирования на SPA-навигациях: hookOnce после
// резолва Suspense уже никогда не сработает, планируем ровно один раз.
let scheduled = false;

export default defineNuxtRouteMiddleware(() => {
  if (!process.client) return;

  const nuxtApp = useNuxtApp();
  const runInit = async () => {
    const appState = useAppState();
    if (appState._initialized) return;
    appState._initialized = true;
    console.log('🔄 Инициализация приложения...');
    try {
      await appState.initializeApp();
      console.log('✅ Приложение инициализировано');
    } catch (error) {
      console.error('❌ Ошибка инициализации приложения:', error);
    }
  };

  if (nuxtApp.isHydrating) {
    // Первая загрузка: ждём app:suspense:resolve — корневой Suspense
    // резолвится, когда страница ПОЛНОСТЬЮ гидратирована. app:mounted
    // недостаточно: он срабатывает раньше, чем RouteProvider (route-middleware
    // страницы с await checkAuth) отдаёт контент, и быстрый ответ
    // /api/products успевает изменить стейт до гидратации — mismatch
    // возвращается. После suspense:resolve изменения стейт-а проходят
    // штатным реактивным патчем.
    if (!scheduled) {
      scheduled = true;
      nuxtApp.hooks.hookOnce('app:suspense:resolve', runInit);
    }
  } else {
    // SPA-навигация после монтирования: выполняем сразу
    runInit();
  }
});
