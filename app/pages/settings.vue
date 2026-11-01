<!-- app/pages/settings.vue — настройки аккаунта: профиль (ссылка в кабинет),
     тема оформления, смена пароля, сессии, локальные данные браузера. -->
<template lang="pug">
.settings-page.min-h-screen.bg-base-200.mobile-nav-safe
  //- ХЕДЕР
  ClientOnly
    Header

  .container.mx-auto.p-4.max-w-3xl
    //- Состояние загрузки
    .flex.justify-center.items-center.min-h-96(v-if="loading")
      .loading.loading-spinner.loading-lg.text-primary
      span.ml-3 Загрузка...

    //- Защитный блок (мидлвэр user-auth обычно редиректит на вход)
    .flex.justify-center.items-center.min-h-96(v-else-if="!currentUser")
      .text-center
        .text-4xl.mb-4 🔒
        h2.text-xl.font-bold.mb-3 Требуется авторизация
        button.btn.btn-primary.btn-sm(type="button" @click="navigateTo('/auth/login')") Войти

    //- Основной контент (нижний «воздух» даёт .mobile-nav-safe на корне)
    .space-y-4(v-else)
      //- ─── Аккаунт ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 👤 Аккаунт
          .flex.items-center.gap-4.mt-2
            .avatar
              .w-14.rounded-full.bg-primary.text-primary-content.flex.items-center.justify-center
                span.text-base.font-bold {{ userInitials }}
            .flex-1.min-w-0
              .font-semibold {{ userName }}
              .text-sm.truncate(class="text-base-content/70") {{ userEmail }}
              .flex.items-center.gap-2.mt-1.flex-wrap
                .badge.badge-sm.rounded-sm(
                  :class="userRole === 'admin' ? 'badge-primary' : userRole === 'manager' ? 'badge-secondary' : 'badge-accent'"
                ) {{ roleText }}
                .text-xs(class="text-base-content/50") В магазине с {{ memberSince }}
          .text-xs.mt-3(class="text-base-content/50")
            | Имя, телефон и адрес доставки редактируются в
            NuxtLink.link.link-primary(to="/user") личном кабинете

      //- ─── Оформление ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 🎨 Оформление
          p.text-xs(class="text-base-content/50 mb-1") Тема применяется сразу и запоминается для этого браузера
          .grid.grid-cols-2.gap-3
            button.theme-option.card.cursor-pointer.border-2.transition-colors(
              type="button"
              :class="currentTheme === 'corporate' ? 'border-primary' : 'border-base-300 hover:border-base-content/30'"
              @click="applyTheme('corporate')"
            )
              .card-body.p-3.items-center.gap-2
                .theme-preview.theme-preview-light
                  .theme-preview-bar
                  .theme-preview-dot.theme-preview-dot-primary
                  .theme-preview-dot.theme-preview-dot-base
                .text-sm.font-medium Светлая
                .text-xs(class="text-base-content/50") corporate
            button.theme-option.card.cursor-pointer.border-2.transition-colors(
              type="button"
              :class="currentTheme === 'business' ? 'border-primary' : 'border-base-300 hover:border-base-content/30'"
              @click="applyTheme('business')"
            )
              .card-body.p-3.items-center.gap-2
                .theme-preview.theme-preview-dark
                  .theme-preview-bar
                  .theme-preview-dot.theme-preview-dot-primary
                  .theme-preview-dot.theme-preview-dot-base
                .text-sm.font-medium Тёмная
                .text-xs(class="text-base-content/50") business

      //- ─── Безопасность: смена пароля ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 🔑 Смена пароля
          form.space-y-3.mt-2(@submit.prevent="submitPassword")
            .form-control
              label.label.py-1
                span.label-text.text-sm Текущий пароль
              .relative
                input.input.input-bordered.w-full(
                  :type="showPasswords ? 'text' : 'password'"
                  v-model="pwForm.current"
                  autocomplete="current-password"
                )
            .form-control
              label.label.py-1
                span.label-text.text-sm Новый пароль
                label.label.cursor-pointer.py-0.gap-1
                  input.checkbox.checkbox-xs(type="checkbox" v-model="showPasswords")
                  span.label-text.text-xs Показать
              input.input.input-bordered.w-full(
                :type="showPasswords ? 'text' : 'password'"
                v-model="pwForm.next"
                autocomplete="new-password"
              )
              label.label.py-1
                span.label-text-alt(class="text-base-content/50") Минимум 6 символов
            .form-control
              label.label.py-1
                span.label-text.text-sm Повторите новый пароль
              input.input.input-bordered.w-full(
                :type="showPasswords ? 'text' : 'password'"
                v-model="pwForm.repeat"
                autocomplete="new-password"
              )
            button.btn.btn-primary.btn-sm(type="submit" :disabled="changingPassword")
              span(v-if="changingPassword") Сохранение...
              span(v-else) Изменить пароль
          .divider.my-2
          .flex.items-center.justify-between.gap-3.flex-wrap
            .text-xs.min-w-0(class="text-base-content/60")
              | Завершить все сессии на других устройствах — текущее останется в системе
            button.btn.btn-outline.btn-warning.btn-sm(
              type="button"
              :disabled="loggingOutOthers"
              @click="logoutOthers"
            ) Выйти со всех устройств

      //- ─── Локальные данные (этот браузер) ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 🧹 Локальные данные
          p.text-xs(class="text-base-content/50")
            | Корзина, избранное и кэш заказов хранятся только в этом браузере.
            | Очистка действует на текущем устройстве и не обратима.
          .flex.flex-col.gap-2.mt-2
            button.btn.btn-outline.btn-sm.justify-start(type="button" @click="clearLocalData('cart')")
              span 🛒 Очистить корзину
            button.btn.btn-outline.btn-sm.justify-start(type="button" @click="clearLocalData('favorites')")
              span ❤️ Очистить избранное
            button.btn.btn-outline.btn-sm.justify-start(type="button" @click="clearLocalData('orders')")
              span 📦 Очистить кэш заказов

  //- МОБИЛЬНЫЙ ФУТЕР
  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
definePageMeta({
  middleware: 'user-auth',
})

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { isMobile } = useMobileDetection()
const { $notify } = useNuxtApp()
const appState = useAppState()

const loading = ref(true)
const currentUser = ref(null)

//- ─── Загрузка пользователя (паттерн /user: ждём общий стейт аутентификации) ───
const loadUserData = async () => {
  try {
    loading.value = true
    if (!appState.isAuthenticated?.value) {
      const { checkAuth } = useAuth()
      await checkAuth()
    }
    let attempts = 0
    while (!appState.user?.value && attempts < 30) {
      await new Promise((r) => setTimeout(r, 100))
      attempts++
    }
    currentUser.value = appState.user?.value || null
  } catch (error) {
    console.error('[settings] Ошибка загрузки:', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadUserData)

const userInitials = computed(
  () =>
    currentUser.value?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'U',
)
const userName = computed(() => currentUser.value?.name || 'Пользователь')
const userEmail = computed(() => currentUser.value?.email || '')
const userRole = computed(() => currentUser.value?.role || 'user')
const roleText = computed(
  () => ({ admin: 'Администратор', manager: 'Менеджер' })[userRole.value] || 'Пользователь',
)
const memberSince = computed(() =>
  currentUser.value?.createdAt ? new Date(currentUser.value.createdAt).toLocaleDateString('ru-RU') : '—',
)

//- ─── Оформление: та же пара тем, что и в шапке (corporate / business) ───
const currentTheme = ref('corporate')

const applyTheme = (theme) => {
  if (!import.meta.client) return
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  // Шапка слушает это событие и подхватывает состояние переключателя
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }))
}

onMounted(() => {
  if (!import.meta.client) return
  const applied = document.documentElement.getAttribute('data-theme')
  currentTheme.value = applied === 'business' ? 'business' : 'corporate'
})

//- ─── Смена пароля ───
const pwForm = ref({ current: '', next: '', repeat: '' })
const showPasswords = ref(false)
const changingPassword = ref(false)

const submitPassword = async () => {
  if (!pwForm.value.current || !pwForm.value.next || !pwForm.value.repeat) {
    $notify.error('Заполните все поля')
    return
  }
  if (pwForm.value.next.length < 6) {
    $notify.error('Новый пароль — минимум 6 символов')
    return
  }
  if (pwForm.value.next === pwForm.value.current) {
    $notify.error('Новый пароль совпадает с текущим')
    return
  }
  if (pwForm.value.next !== pwForm.value.repeat) {
    $notify.error('Пароли не совпадают')
    return
  }
  try {
    changingPassword.value = true
    const res = await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: pwForm.value.current, newPassword: pwForm.value.next },
    })
    if (res?.success) {
      $notify.success(
        res.otherSessionsEnded > 0
          ? `Пароль изменён. Завершено других сессий: ${res.otherSessionsEnded}`
          : 'Пароль изменён',
      )
      pwForm.value = { current: '', next: '', repeat: '' }
      showPasswords.value = false
    } else {
      throw new Error(res?.message || 'Ошибка')
    }
  } catch (error) {
    console.error('[settings] Смена пароля:', error)
    $notify.error(error.data?.message || error.message || 'Не удалось изменить пароль')
  } finally {
    changingPassword.value = false
  }
}

//- ─── Выйти со всех других устройств ───
const loggingOutOthers = ref(false)

const logoutOthers = async () => {
  if (!confirm('Завершить все сессии на других устройствах?')) return
  try {
    loggingOutOthers.value = true
    const res = await $fetch('/api/auth/logout-others', { method: 'POST' })
    if (res?.success) $notify.success(res.message || 'Готово')
  } catch (error) {
    console.error('[settings] Выход с устройств:', error)
    $notify.error(error.data?.message || 'Не удалось завершить сессии')
  } finally {
    loggingOutOthers.value = false
  }
}

//- ─── Локальные данные этого браузера ───
const LOCAL_DATA = {
  cart: {
    keys: ['cart'],
    label: 'корзину',
    event: 'cart-updated',
    warn: 'Очистить корзину на этом устройстве?',
  },
  favorites: {
    keys: ['favoriteProducts', 'userFavorites'],
    label: 'избранное',
    event: 'favorites-updated',
    warn: 'Очистить избранное? Оно хранится только в этом браузере и будет удалено безвозвратно.',
  },
  orders: {
    keys: ['userOrders'],
    label: 'кэш заказов',
    event: null,
    warn: 'Очистить локальный кэш заказов? Сами заказы останутся на сервере.',
  },
}

const clearLocalData = (what) => {
  const conf = LOCAL_DATA[what]
  if (!conf || !import.meta.client) return
  if (!confirm(conf.warn)) return
  conf.keys.forEach((k) => localStorage.removeItem(k))
  if (conf.event) window.dispatchEvent(new CustomEvent(conf.event))
  $notify.success(`Очищено: ${conf.label}`)
}
</script>

<style scoped>
/* Мини-превью тем: панель + акцентные точки, цвета фиксированные,
   чтобы превью не зависело от активной темы страницы */
.theme-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 44px;
  border-radius: 8px;
  padding: 8px;
}
.theme-preview-light {
  background: #f4f6fb;
  border: 1px solid #d9deea;
}
.theme-preview-dark {
  background: #1d2531;
  border: 1px solid #39414e;
}
.theme-preview-bar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
}
.theme-preview-light .theme-preview-bar {
  background: #ffffff;
  border: 1px solid #d9deea;
}
.theme-preview-dark .theme-preview-bar {
  background: #2b3442;
}
.theme-preview-dot {
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  flex-shrink: 0;
}
.theme-preview-dot-primary {
  background: #4f6bed;
}
.theme-preview-dot-base {
  background: #94a3b8;
}
.theme-preview-light .theme-preview-dot-base {
  background: #64748b;
}
</style>
