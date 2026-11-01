// app/composables/useLocalizedProduct.js
// ============================================
// Композабл: локализованные товары для витрины (этап i18n-2).
// Обёртки над чистой app/utils/localizedProduct.ts:
//   useStoreLocale()   — реактивная локаль витрины ИЗ ПУТИ МАРШРУТА
//   loc(p)             — локализованная копия товара
//   categoryLabel(raw) — подпись чипа фильтра из карты «сырая → перевод»
//
// ⚠️ Локаль — из пути URL (useRoute), а НЕ из useI18n(): клиентский
// singleton appState создаётся в глобальном middleware auth-init ДО
// setup-контекста компонентов — там useI18n() бросает исключение, и
// локаль навсегда падала в 'ru' (SSR не страдал: на сервере каждый
// запрос получает свежий инстанс уже в setup). Путь маршрута доступен
// и в middleware, и в setup, детерминирован на сервере и клиенте.
// Админка локали НЕ локализует: админ-компоненты не используют loc().
// ============================================

import { computed } from 'vue';
import {
  localizedProduct,
  buildCategoryLabelMap,
} from '../utils/localizedProduct';

/**
 * Реактивная локаль витрины из URL: /en/… → 'en', /es/… → 'es', иначе 'ru'.
 * Вне Nuxt-контекста (юнит-тесты на node) — константа 'ru'.
 */
export function useStoreLocale() {
  let route = null;
  try {
    route = useRoute();
  } catch {
    route = null;
  }
  return computed(() => {
    const match = /^\/(en|es)(\/|$)/.exec(route?.path ?? '');
    return match ? match[1] : 'ru';
  });
}

export function useLocalizedProduct() {
  const locale = useStoreLocale();

  const loc = (product) => localizedProduct(product, locale.value);

  return { locale, loc };
}

/**
 * Локализованные подписи категорий для чипов фильтров
 * (ProductCategories, DesktopSidebar, MobileFiltersPanel, ProductSortBar).
 * Значения фильтров остаются сырыми — переводится только подпись.
 * Карта строится из каталога: если каталог ещё не загружен (SSR карточки
 * товара), чипы фолбэкаются на сырые значения без ошибок.
 */
export function useCategoryLabels() {
  const locale = useStoreLocale();
  const { products } = useProducts();

  const labelMap = computed(() =>
    buildCategoryLabelMap(products.value, locale.value),
  );

  const categoryLabel = (rawCategory) =>
    labelMap.value.get(rawCategory) ?? rawCategory;

  return { categoryLabel };
}
