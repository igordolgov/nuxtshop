// app/composables/useAuth.ts
// Локализация тостов/ошибок вне setup — через tr() (composables/tr.ts)
// и serverMessageTr (composables/useServerMessage.ts: серверные коды →
// server.* в словарях)
import { serverMessageTr } from './useServerMessage';

// In-flight дедупликация checkAuth. Только клиент: на SSR промисы нельзя
// шарить между запросами — это утечка сессий между пользователями.

/** Пользователь из /api/auth/** (сервер отдаёт stripPassword — без password) */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'manager' | 'admin';
  phone?: string;
  address?: string;
  avatar?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string | null;
}

/** Результат checkAuth: ответ /api/auth/user либо нормализованный «нет сессии» */
export type AuthCheckResult = {
  user: AuthUser | null;
  success?: boolean;
  isAuthenticated?: boolean;
};

let clientCheckPromise: Promise<AuthCheckResult> | null = null;

let authInstance: ReturnType<typeof createAuth> | null = null;

export const useAuth = () => {
  // SSR: свежий инстанс на каждый запрос — никакого шаринга между пользователями
  if (import.meta.server) return createAuth();

  if (authInstance) return authInstance;
  authInstance = createAuth();
  return authInstance;
};

function createAuth() {
  // Пользователь — в useState, а не в локальном ref: значение на сервере
  // попадает в payload запроса, и клиент гидратируется с ТЕМ ЖЕ пользователем.
  // Раньше SSR всегда рендерил шапку для гостя (стейт пуст), а клиент после
  // checkAuth в route-middleware — уже авторизованным → hydration mismatch
  // в мобильном меню/пользовательском блоке («Hydration node mismatch»).
  // На сервере useState даёт свежее значение на каждый запрос (без утечки
  // сессий), на клиенте — общий стейт для всех вызовов useAuth.
  // SSR-ветки admin-auth/user-auth кладут пользователя сюда до рендера.
  const user = useState<AuthUser | null>('auth-user', () => null);
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isManager = computed(() => user.value?.role === 'manager' || isAdmin.value);
  const loading = ref(false);
  const authChecked = ref(false);

  const updateAuthState = (newUser: AuthUser | null) => {
    user.value = newUser;
  };

  const checkAuth = async (): Promise<AuthCheckResult> => {
    if (authChecked.value) {
      return { user: user.value, isAuthenticated: !!user.value };
    }

    // Несколько компонентов могут запросить проверку одновременно — делаем один fetch
    if (import.meta.client && clientCheckPromise) {
      return clientCheckPromise;
    }

    const request = (async (): Promise<AuthCheckResult> => {
      try {
        const data = await $fetch<{ success: boolean; user: AuthUser | null }>('/api/auth/user', {
          credentials: 'include',
        });
        user.value = data.user ?? null;
        return data;
      } catch {
        user.value = null;
        return { user: null, isAuthenticated: false };
      } finally {
        authChecked.value = true;
        clientCheckPromise = null;
      }
    })();

    if (import.meta.client) clientCheckPromise = request;
    return request;
  };

  const login = async (credentials: { email: string; password: string }) => {
    loading.value = true;
    try {
      const data = await $fetch<{ success: boolean; user: AuthUser; error?: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: credentials,
          credentials: 'include',
        },
      );

      if (!data.success) throw new Error(data.error || tr('auth.errLoginDefault', 'Ошибка входа'));
      updateAuthState(data.user);
      return data;
    } catch (error) {
      // ofetch бросает FetchError: сервер кладёт code в data.data — серверный
      // код переводим через словарь (server.*), иначе локализованный фолбэк.
      // Русский текст сервера больше не показываем напрямую (i18n тостов).
      const err = error as {
        data?: { message?: string; data?: { code?: unknown; params?: Record<string, unknown> } };
        code?: unknown;
        status?: number;
        message?: string;
      };
      const coded = serverMessageTr(err);
      if (coded) throw new Error(coded);
      if (err.status === 401)
        throw new Error(tr('auth.errLoginWrong', 'Неверный email или пароль'));
      if (err.status === 500)
        throw new Error(tr('auth.errServerError', 'Ошибка сервера. Попробуйте позже.'));
      throw new Error(tr('auth.errLoginGeneric', 'Ошибка при входе в систему'));
    } finally {
      loading.value = false;
    }
  };

  const register = async (userData: { name: string; email: string; password: string }) => {
    loading.value = true;
    try {
      const data = await $fetch<{ success: boolean; user: AuthUser; error?: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: userData,
          credentials: 'include',
        },
      );

      if (!data.success)
        throw new Error(data.error || tr('auth.errRegister', 'Ошибка регистрации'));
      updateAuthState(data.user);
      return data;
    } catch (error) {
      // Серверные коды (missingFields/emailFormat/nameLength/…) → server.*
      const err = error as {
        data?: { message?: string; data?: { code?: unknown; params?: Record<string, unknown> } };
        code?: unknown;
        message?: string;
      };
      const coded = serverMessageTr(err);
      throw new Error(coded || tr('auth.errRegister', 'Ошибка при регистрации'));
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      authChecked.value = true;
    } catch (error) {
      // Сервер не подтвердил выход — локально разлогиниваем,
      // но при следующей навигации сессия будет перепроверена
      const err = error as { message?: string };
      authChecked.value = false;
      updateAuthState(null);
      return { success: false, error: err.message || tr('auth.errLogout', 'Не удалось выйти') };
    }

    updateAuthState(null);

    // Ключи от старой auth-схемы — чистим на устройствах пользователей
    if (import.meta.client) {
      localStorage.removeItem('user');
      localStorage.removeItem('auth-token');
      sessionStorage.removeItem('user');
    }

    return { success: true };
  };

  const updateProfile = async (profileData: {
    name?: string;
    phone?: string;
    address?: string;
  }) => {
    loading.value = true;
    try {
      const data = await $fetch<{ success: boolean; user: AuthUser; error?: string }>(
        '/api/auth/profile',
        {
          method: 'PUT',
          body: profileData,
          credentials: 'include',
        },
      );

      if (!data.success)
        throw new Error(data.error || tr('auth.errProfileUpdate', 'Ошибка обновления профиля'));
      updateAuthState(data.user);
      return data;
    } finally {
      loading.value = false;
    }
  };

  const resetAuth = () => {
    updateAuthState(null);
    authChecked.value = false;
  };

  return {
    user,
    isAuthenticated,
    isAdmin,
    isManager,
    loading,
    authChecked,
    checkAuth,
    login,
    register,
    logout,
    updateProfile,
    resetAuth,
    updateAuthState,
  };
}
