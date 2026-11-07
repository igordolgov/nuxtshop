// app/composables/useServerMessage.ts
// ============================================================
// Локализация серверных сообщений в тостах и инлайн-ошибках.
//
// Проблема: сервер возвращает сообщения на русском («Неверный email
// или пароль», «Недостаточно товара на складе: …»), и в тостах вида
// `error.data?.message || t('ключ')` русский текст сервера всегда
// побеждал локализованный фолбэк — при переключении языка уведомления
// оставались русскими (см. также tr() в composables/tr.ts).
//
// Решение: сервер кладёт в тело ошибки машиночитаемый код
// createError({ statusCode, message, data: { code, params? } }).
// Клиент переводит ключ server.<code> из словаря (секции server в
// i18n/locales/*.json); при неизвестном коде или без кода — берёт
// локализованный fallback-ключ из контекста вызова.
//
// Форма тела ошибки (h3 H3Error.toJSON → тело ответа → FetchError.data):
//   { message, statusCode, data?: { code, params? } }
// поэтому код читается из err.data.data.code; для надёжности
// допускаем также err.data.code и err.code (если код когда-нибудь
// положат ближе к поверхности тела).
// ============================================================

interface ServerErrorShape {
  data?: {
    code?: unknown;
    params?: Record<string, unknown>;
    data?: { code?: unknown; params?: Record<string, unknown> };
  };
  code?: unknown;
}

/** Вытаскивает { code, params } из любого места тела ошибки. */
const extractCode = (
  err: ServerErrorShape | null | undefined,
): { code: string; params: Record<string, unknown> } | null => {
  const body = err?.data ?? {};
  const payload = body?.data ?? body ?? {};
  const code = payload?.code ?? body?.code ?? err?.code;
  if (typeof code !== 'string' || code.length === 0) return null;
  const params = (payload?.params ?? body?.params ?? {}) as Record<string, unknown>;
  return { code, params };
};

/**
 * Setup-контекст (компоненты и страницы): useServerMessage().
 * err — ошибка $fetch или Error; fallbackKey — локализованный ключ,
 * который показывается, если кода нет или он не переведён.
 */
export const useServerMessage = () => {
  const { t, te } = useI18n();

  const serverMessage = (
    err: ServerErrorShape | null | undefined,
    fallbackKey: string,
    params: Record<string, unknown> = {},
  ): string => {
    const found = extractCode(err);
    if (found) {
      const key = `server.${found.code}`;
      let known = false;
      try {
        known = te(key);
      } catch {
        known = false;
      }
      if (known) return t(key, { ...found.params, ...params });
    }
    return t(fallbackKey, params);
  };

  return { serverMessage };
};

/**
 * Вне setup-контекста (синглтоны useAppState/useProducts, плагины):
 * перевод через tr() — как в composables/tr.ts. При неизвестном коде
 * возвращает null, чтобы вызывающий сам выбрал фолбэк.
 */
export const serverMessageTr = (err: ServerErrorShape | null | undefined): string | null => {
  const found = extractCode(err);
  if (!found) return null;
  // tr(key, fallback): если ключа нет — вернёт fallback-маркер
  const MISSING = '__server_message_missing__';
  const msg = tr(`server.${found.code}`, MISSING, { ...found.params });
  return msg === MISSING ? null : msg;
};
