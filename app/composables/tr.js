// app/composables/tr.js
// ============================================================
// tr(key, fallback, params?) — перевод СТРОКИ в не-setup контексте:
// тосты и ошибки в композаблах, плагинах, обработчиках событий.
//
// Почему не useI18n(): он бросает вне setup-контекста (singleton
// appState создаётся в middleware auth-init ДО setup — см. шапку
// useLocalizedProduct.js). useNuxtApp() в клиентском рантайме —
// синглтон, доступен из обработчиков и плагинов; на сервере вызовы
// tr() идут в рамках запроса. В юнит-тестах на node nuxt-приложения
// нет — срабатывает фолбэк (русская строка, поведение до i18n).
//
// Если vue-i18n не нашёл ключ (нет и в fallback 'ru'), возвращаем
// fallback — тосты не должны показывать «orders.errLoad».
// ============================================================
export const tr = (key, fallback, params = {}) => {
  try {
    const i18n = useNuxtApp().$i18n
    if (!i18n) return fallback
    const msg = i18n.t(key, params)
    return !msg || msg === key ? fallback : msg
  } catch {
    return fallback
  }
}
