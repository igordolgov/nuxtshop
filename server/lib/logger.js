// server/lib/logger.js
/**
 * In-memory логгер для Cloudflare Workers.
 *
 * На Workers нет fs — логи хранятся в памяти изолята и дублируются в
 * console.log (Cloudflare собирает их в дашборде: Workers → Logs).
 *
 * Несколько изолятов = несколько независимых логов. Для консолидации
 * использовать Logpush или внешний сервис.
 */

const MAX_ENTRIES = 500

function createLogStore(name) {
  const entries = []

  return {
    add(entry) {
      const record = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        ...entry,
      }
      entries.unshift(record)
      if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES

      // Дублируем в консоль для Cloudflare Logs
      console.log(`[${name}]`, JSON.stringify(entry))
    },
    getAll() {
      return entries
    },
    count(filterFn) {
      return filterFn ? entries.filter(filterFn).length : entries.length
    },
  }
}

export const registrationLog = createLogStore('registration')
export const logoutLog = createLogStore('logout')
export const adminActionLog = createLogStore('admin-action')
export const adminAccessLog = createLogStore('admin-access')