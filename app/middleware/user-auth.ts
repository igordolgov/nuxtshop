// middleware/user-auth.ts
// ============================================
// Middleware: user-auth — требует авторизации.
// Сервер: SSR-проверка по кукам (роуты не кэшируются).
// Клиент: проверка через общий стейт useAuth.
// ============================================
import type { AuthUser } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async () => {
  // ─── Сервер ───────────────────────────────────────────────
  if (import.meta.server) {
    // $fetch при SSR не пересылает куки автоматически — делаем это явно
    const headers = useRequestHeaders(['cookie']);
    try {
      const data = await $fetch<{ success: boolean; user: AuthUser | null }>('/api/auth/user', {
        headers,
      });
      if (!data?.user) return navigateTo('/auth/login', { replace: true });
      // Пользователь — в общий стейт (useAuth читает useState('auth-user')),
      // чтобы SSR-шапка и клиентская гидратация рендерили одно и то же
      useState<AuthUser | null>('auth-user', () => null).value = data.user;
    } catch {
      return navigateTo('/auth/login', { replace: true });
    }
    return;
  }

  // ─── Клиент ───────────────────────────────────────────────
  const { authChecked, isAuthenticated, checkAuth } = useAuth();

  if (!authChecked.value) {
    await checkAuth();
  }

  if (!isAuthenticated.value) {
    return navigateTo('/auth/login', { replace: true });
  }
});
