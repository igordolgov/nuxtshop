// app/composables/useActiveRoute.js
// ============================================
// Composable: useActiveRoute — активные пункты меню (Header, MobileNavFooter).
//
// route.path на /en и /es несёт префикс локали ('/en/favorites') — сравнивать
// нужно с локализованным путём (useLocalePath), сырые '/favorites' на этих
// локалях никогда не совпадут.
//
// ⚠️ Корень ('/') на /en и /es локализуется до '/en', '/es' — а это префикс
// ЛЮБОГО маршрута локали. Наивный startsWith(localized + '/') подсвечивал
// «Главную» на каждой странице /en/* и /es/* (баг шапки: пункт «Главная»
// активен везде, кроме русского). Поэтому для корня активно только точное
// совпадение; остальные разделы подсвечиваются и на вложенных путях
// (/admin → /admin/products, граница — по сегменту '/').
// ============================================

/** Чистая: активен ли раздел. localized — localePath(path) для текущей локали.
 *  Корень ('/') — только точное совпадение, остальные пути — совпадение или
 *  вложенный маршрут (граница по '/', '/en/administrator' не ловится). */
export const matchActiveRoute = (currentPath, localized, path) => {
  if (currentPath === localized) return true;
  if (path === '/') return false;
  return currentPath.startsWith(localized + '/');
};

/** Чистая: только точное совпадение с локализованным путём
 *  (пункты меню без вложенных страниц: /admin/products, /user/orders…). */
export const matchExactActiveRoute = (currentPath, localized) =>
  currentPath === localized;

export const useActiveRoute = () => {
  const route = useRoute();
  const localePath = useLocalePath();

  /** Активен ли раздел меню (точное совпадение или вложенный путь). */
  const isActiveRoute = (path) =>
    matchActiveRoute(route.path, localePath(path), path);

  /** Точное совпадение с локализованным путём. */
  const isExactActiveRoute = (path) =>
    matchExactActiveRoute(route.path, localePath(path));

  return { isActiveRoute, isExactActiveRoute };
};
