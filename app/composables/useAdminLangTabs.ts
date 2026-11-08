// app/composables/useAdminLangTabs.ts
// ── Языковые вкладки контента в модалках/формах админки ───────────────────
//
// Порядок вкладок берётся из store.config (STORE_ADMIN_LANG_TABS): язык
// базового контента идёт первым — RU-магазин: Русский → English → Español;
// кубинская копия (подмена конфига в CI): Español → English, вкладка
// «Русский» убрана вовсе (отзыв: «уберем русский из кубинской версии —
// друг не знает русского»). Контент основного языка набирается без
// лишнего клика.
//
// Язык БАЗОВОГО контента записи — STORE_BASE_CONTENT_LOCALE (должен
// совпадать с первой вкладкой): базовые поля записи (name/description/
// характеристики/категории товара, title/body новостей, тексты контента)
// набираются на нём; вкладки остальных языков — необязательные переводы
// (пусто → витрина показывает базовое). RU-магазин: базовый 'ru',
// кубинская копия: 'es' — подсказки «Необязательно…» показываются на
// любой вкладке, кроме базовой.

import {
  STORE_ADMIN_LANG_TABS,
  STORE_BASE_CONTENT_LOCALE,
  type StoreLocale,
} from '../../store.config';

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
  // Код базовой вкладки (язык базового контента из store.config)
  const baseLocale: StoreLocale = STORE_BASE_CONTENT_LOCALE;
  // Активная вкладка — базовая (обязательные поля записи)?
  const isBaseTab = computed(() => langTab.value === baseLocale);
  // Подпись в лейбле описания («Описание ({lang})») — как раньше:
  // русский строчными, en/es — своими именами
  const langLabel = computed(() =>
    langTab.value === 'ru' ? 'русский' : TAB_LABELS[langTab.value],
  );
  // Подпись БАЗОВОЙ вкладки — для подсказок «Необязательно…» (i18n-ключи
  // с {lang}) и «обязательное поле — на вкладке {tab}»: на копии это
  // Español, на RU-магазине — Русский
  const baseTabLabel: string = TAB_LABELS[STORE_BASE_CONTENT_LOCALE];
  return { langTabs, langTab, langLabel, baseLocale, isBaseTab, baseTabLabel };
}
