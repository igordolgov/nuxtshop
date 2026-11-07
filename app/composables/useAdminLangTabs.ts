// app/composables/useAdminLangTabs.ts
// ── Языковые вкладки контента товара в модалках админки ───────────────────
//
// Порядок вкладок берётся из store.config (STORE_ADMIN_LANG_TABS): язык
// витрины магазина идёт первым — RU-магазин: Русский → English → Español;
// кубинская копия (подмена конфига в CI): Español → English → Русский.
// Контент основного языка магазина набирается без лишнего клика.
//
// ru в ОБОИХ магазинах остаётся языком базового контента (контракт данных:
// базовые поля записи — русский текст, nameEn/nameEs/characteristicsEn/Es —
// необязательные переводы), поэтому подсказка «Необязательно…» показывается
// на любой вкладке, кроме ru, независимо от порядка вкладок.

import { STORE_ADMIN_LANG_TABS, type StoreLocale } from '../../store.config';

// Подписи вкладок — имена языков, каждое на своём языке (как было в
// захардкоженных кнопках). НЕ i18n: название языка не переводится.
const TAB_LABELS: Record<StoreLocale, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
};

export function useAdminLangTabs() {
  // Вкладки в порядке store.config: [{ code: 'es', label: 'Español' }, …]
  // для копии; [{ code: 'ru', … }, …] для RU-магазина
  const langTabs = STORE_ADMIN_LANG_TABS.map((code) => ({ code, label: TAB_LABELS[code] }));
  // Активная вкладка; сброс формы возвращает на первую вкладку магазина
  const langTab = ref<StoreLocale>(STORE_ADMIN_LANG_TABS[0]);
  // Подпись в лейбле описания («Описание ({lang})») — как раньше:
  // русский строчными, en/es — своими именами
  const langLabel = computed(() =>
    langTab.value === 'ru' ? 'русский' : TAB_LABELS[langTab.value],
  );
  return { langTabs, langTab, langLabel };
}
