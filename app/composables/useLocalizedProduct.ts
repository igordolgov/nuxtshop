// app/composables/useLocalizedProduct.ts
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
// Админ-страница товаров тоже локализует ОТОБРАЖЕНИЕ (таблица, поиск,
// подписи категорий); данные для редактирования остаются сырыми —
// модалки правят оригиналы из KV.
// ============================================

import { computed } from 'vue';
import { localizedProduct, buildCategoryLabelMap } from '../utils/localizedProduct';
// Дефолтная локаль витрины (без URL-префикса) — из store.config: у кубинской
// копии это 'es' (а 'ru' — с префиксом /ru). Хардкод 'ru' здесь ломал копию:
// весь переводной контент (новости, «О нас», категории, товары) откатывался
// на русский при испанском интерфейсе.
import { STORE_DEFAULT_LOCALE } from '../../store.config';

/**
 * Реактивная локаль витрины из URL: /en/… → 'en', /es/… → 'es',
 * путь без префикса — дефолтная локаль магазина (store.config: RU-магазин
 * 'ru', кубинская копия 'es'). Вне Nuxt-контекста (юнит-тесты на node) —
 * та же константа из store.config.
 */
export function useStoreLocale() {
  let route: ReturnType<typeof useRoute> | null = null;
  try {
    route = useRoute();
  } catch {
    route = null;
  }
  return computed<'ru' | 'en' | 'es'>(() => {
    const match = /^\/(en|es)(\/|$)/.exec(route?.path ?? '');
    return match ? (match[1] as 'ru' | 'en' | 'es') : STORE_DEFAULT_LOCALE;
  });
}

export function useLocalizedProduct() {
  const locale = useStoreLocale();

  const loc = <T extends Record<string, unknown>>(product: T | null | undefined) =>
    localizedProduct(product, locale.value);

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

  const labelMap = computed(() => buildCategoryLabelMap(products.value, locale.value));

  const categoryLabel = (rawCategory: string): string =>
    labelMap.value.get(rawCategory) ?? rawCategory;

  return { categoryLabel };
}
