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
      span.ml-3 {{ $t('common.loading') }}

    //- Защитный блок (мидлвэр user-auth обычно редиректит на вход)
    .flex.justify-center.items-center.min-h-96(v-else-if="!currentUser")
      .text-center
        .text-4xl.mb-4 🔒
        h2.text-xl.font-bold.mb-3 {{ $t('user.authRequired') }}
        button.btn.btn-primary.btn-sm(type="button" @click="navigateTo($localePath('/auth/login'))") {{ $t('auth.login') }}

    //- Основной контент (нижний «воздух» даёт .mobile-nav-safe на корне)
    .space-y-4(v-else)
      //- ─── Аккаунт ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 👤 {{ $t('settings.account') }}
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
                .text-xs(class="text-base-content/50") {{ $t('settings.memberSince', { date: memberSince }) }}
          .text-xs.mt-3(class="text-base-content/50")
            | {{ $t('settings.editInProfile1') }}
            NuxtLink.link.link-primary(:to="$localePath('/user')") {{ $t('settings.editInProfile2') }}

      //- ─── Оформление ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 🎨 {{ $t('settings.appearance') }}
          p.text-xs(class="text-base-content/50 mb-1") {{ $t('settings.themeNote') }}
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
                .text-sm.font-medium {{ $t('settings.light') }}
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
                .text-sm.font-medium {{ $t('settings.dark') }}
                .text-xs(class="text-base-content/50") business

      //- ─── Безопасность: смена пароля ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 🔑 {{ $t('settings.changePassword') }}
          form.space-y-3.mt-2(@submit.prevent="submitPassword")
            .form-control
              label.label.py-1
                span.label-text.text-sm {{ $t('settings.currentPassword') }}
              .relative
                input.input.input-bordered.w-full(
                  :type="showPasswords ? 'text' : 'password'"
                  v-model="pwForm.current"
                  autocomplete="current-password"
                )
            .form-control
              label.label.py-1
                span.label-text.text-sm {{ $t('settings.newPassword') }}
                label.label.cursor-pointer.py-0.gap-1
                  input.checkbox.checkbox-xs(type="checkbox" v-model="showPasswords")
                  span.label-text.text-xs {{ $t('auth.showPassword') }}
              input.input.input-bordered.w-full(
                :type="showPasswords ? 'text' : 'password'"
                v-model="pwForm.next"
                autocomplete="new-password"
              )
              label.label.py-1
                span.label-text-alt(class="text-base-content/50") {{ $t('settings.min6') }}
            .form-control
              label.label.py-1
                span.label-text.text-sm {{ $t('settings.repeatPassword') }}
              input.input.input-bordered.w-full(
                :type="showPasswords ? 'text' : 'password'"
                v-model="pwForm.repeat"
                autocomplete="new-password"
              )
            button.btn.btn-primary.btn-sm(type="submit" :disabled="changingPassword")
              span(v-if="changingPassword") {{ $t('settings.saving') }}
              span(v-else) {{ $t('settings.changePasswordBtn') }}
          .divider.my-2
          .flex.items-center.justify-between.gap-3.flex-wrap
            .text-xs.min-w-0(class="text-base-content/60")
              | {{ $t('settings.logoutAllNote') }}
            button.btn.btn-outline.btn-warning.btn-sm(
              type="button"
              :disabled="loggingOutOthers"
              @click="logoutOthers"
            ) {{ $t('settings.logoutAll') }}

      //- ─── Локальные данные (этот браузер) ───
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          h3.card-title.text-md 🧹 {{ $t('settings.localData') }}
          p.text-xs(class="text-base-content/50")
            | {{ $t('settings.localDataNote') }}
          .flex.flex-col.gap-2.mt-2
            button.btn.btn-outline.btn-sm.justify-start(type="button" @click="clearLocalData('cart')")
              span 🛒 {{ $t('settings.clearCart') }}
            button.btn.btn-outline.btn-sm.justify-start(type="button" @click="clearLocalData('favorites')")
              span ❤️ {{ $t('settings.clearFavorites') }}
            button.btn.btn-outline.btn-sm.justify-start(type="button" @click="clearLocalData('orders')")
              span 📦 {{ $t('settings.clearOrdersCache') }}

  //- МОБИЛЬНЫЙ ФУТЕР
  MobileNavFooter
</template>

<script setup>
const { t, locale } = useI18n()
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
const userName = computed(() => currentUser.value?.name || t('header.defaultUserName'))
const userEmail = computed(() => currentUser.value?.email || '')
const userRole = computed(() => currentUser.value?.role || 'user')
const roleText = computed(
  () => ({ admin: t('header.roleAdmin'), manager: t('header.roleManager') })[userRole.value] || t('header.roleUser'),
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
    $notify.error(t('settings.errFillAll'))
    return
  }
  if (pwForm.value.next.length < 6) {
    $notify.error(t('settings.errMin6'))
    return
  }
  if (pwForm.value.next === pwForm.value.current) {
    $notify.error(t('settings.errSame'))
    return
  }
  if (pwForm.value.next !== pwForm.value.repeat) {
    $notify.error(t('auth.errPasswordsMismatch'))
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
          ? t('settings.passwordChangedSessions', { n: res.otherSessionsEnded })
          : t('settings.passwordChanged'),
      )
      pwForm.value = { current: '', next: '', repeat: '' }
      showPasswords.value = false
    } else {
      throw new Error(res?.message || t('favorites.error'))
    }
  } catch (error) {
    console.error('[settings] Смена пароля:', error)
    $notify.error(error.data?.message || error.message || t('settings.errPassword'))
  } finally {
    changingPassword.value = false
  }
}

//- ─── Выйти со всех других устройств ───
const loggingOutOthers = ref(false)

const logoutOthers = async () => {
  if (!confirm(t('settings.logoutAllConfirm'))) return
  try {
    loggingOutOthers.value = true
    const res = await $fetch('/api/auth/logout-others', { method: 'POST' })
    if (res?.success) $notify.success(res.message || t('settings.done'))
  } catch (error) {
    console.error('[settings] Выход с устройств:', error)
    $notify.error(error.data?.message || t('settings.errSessions'))
  } finally {
    loggingOutOthers.value = false
  }
}

//- ─── Локальные данные этого браузера ───
const LOCAL_DATA = {
  cart: {
    keys: ['cart'],
    labelKey: 'settings.labelCart',
    event: 'cart-updated',
    warnKey: 'settings.warnCart',
  },
  favorites: {
    keys: ['favoriteProducts', 'userFavorites'],
    labelKey: 'settings.labelFavorites',
    event: 'favorites-updated',
    warnKey: 'settings.warnFavorites',
  },
  orders: {
    keys: ['userOrders'],
    labelKey: 'settings.labelOrders',
    event: null,
    warnKey: 'settings.warnOrders',
  },
}

const clearLocalData = (what) => {
  const conf = LOCAL_DATA[what]
  if (!conf || !import.meta.client) return
  if (!confirm(t(conf.warnKey))) return
  conf.keys.forEach((k) => localStorage.removeItem(k))
  if (conf.event) window.dispatchEvent(new CustomEvent(conf.event))
  $notify.success(t('settings.cleared', { what: t(conf.labelKey) }))
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
