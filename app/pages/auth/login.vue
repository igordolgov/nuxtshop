<!-- app/pages/auth/login.vue -->
<template lang="pug">
.login-page
  .min-h-screen.flex.items-center.justify-center.bg-base-200
    .card.w-full.max-w-md.bg-base-100.shadow-xl
      .card-body
        .text-center.mb-8
          h1.card-title.text-3xl.justify-center {{ $t('auth.loginTitle') }}
          p.text-base-content.opacity-70.mt-2 {{ $t('auth.loginSubtitle') }}

        form(@submit.prevent="handleLogin")
          .form-control
            label.label
              span.label-text Email
            input.input.input-bordered(
              type="email"
              v-model="form.email"
              placeholder="your@email.com"
              required
              autocomplete="email"
              @input="clearError('email')"
            )
            .label(v-if="errors.email")
              span.label-text-alt.text-error {{ errors.email }}

          .form-control.mt-4
            label.label
              span.label-text {{ $t('auth.password') }}
            .relative
              input.input.input-bordered.w-full(
                :type="showPassword ? 'text' : 'password'"
                v-model="form.password"
                placeholder="••••••••"
                required
                autocomplete="current-password"
                @input="clearError('password')"
              )
              button.absolute.right-1.top-1.btn.btn-ghost.btn-sm(
                type="button"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
              )
                svg.w-4.h-4(
                  v-if="showPassword"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                )
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m9.02 9.02l3.83 3.83")
                svg.w-4.h-4(
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                )
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z")
            .label(v-if="errors.password")
              span.label-text-alt.text-error {{ errors.password }}

          .form-control.mt-6
            button.btn.btn-primary(
              type="submit"
              :disabled="loading"
              :class="{ 'loading': loading }"
            )
              span(v-if="!loading") {{ $t('auth.login') }}
              span(v-else) {{ $t('auth.loggingIn') }}

          .divider.mt-6 {{ $t('auth.or') }}

          .text-center.mt-4
            p.text-sm
              | {{ $t('auth.noAccount') }}
              a.link.link-primary(@click="$router.push($localePath('/auth/register'))") {{ $t('auth.registerLink') }}

        ClientOnly
          .card.bg-base-200.mt-4(v-if="isDev")
            .card-body.p-4
              .text-sm.font-bold.mb-2 {{ $t('auth.testData') }}
              .space-y-1
                .flex.justify-between
                  span Email:
                  code admin@shop.ru
                .flex.justify-between
                  span {{ $t('auth.passwordLabel') }}
                  code admin123
              button.btn.btn-xs.btn-outline.mt-2(@click="fillTestData") {{ $t('auth.fill') }}

        .alert.alert-error.mt-6(v-if="loginError")
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
          span {{ loginError }}

        .text-center.mt-6.pt-6.border-t
        p.text-xs.text-base-content.opacity-50
          | {{ $t('auth.problems') }}
          a.link.link-error(@click="$router.push($localePath('/emergency-logout'))") {{ $t('emergency.title') }}
</template>

<script setup>
const { t } = useI18n()
const appState = useAppState()
const { login, isAuthenticated, checkAuth, user } = appState

const router = useRouter()
// После входа: ?redirect= из middleware admin-auth (вернуться в админку,
// откуда выкинуло) — с защитой от open-redirect; иначе главная локали
const localePath = useLocalePath()
const route = useRoute()
const redirectTarget = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')
    ? r
    : localePath('/')
})
const { $notify } = useNuxtApp()

const form = ref({
  email: '',
  password: '',
})

const showPassword = ref(false)
const loginError = ref('')
const errors = ref({})
const loading = ref(false)
const isDev = ref(false)

onMounted(() => {
  isDev.value = import.meta.env.DEV

  if (import.meta.client) {
    checkAuth().then(() => {
      if (isAuthenticated.value) {
        router.push(redirectTarget.value)
      }
    })
  }
})

const clearError = (field) => {
  if (errors.value[field]) {
    errors.value[field] = ''
  }
  if (loginError.value) {
    loginError.value = ''
  }
}

const validateForm = () => {
  errors.value = {}
  let isValid = true

  if (!form.value.email.trim()) {
    errors.value.email = t('auth.errEmailRequired')
    isValid = false
  } else if (!/\S+@\S+\.\S+/.test(form.value.email)) {
    errors.value.email = t('auth.errEmailFormat')
    isValid = false
  }

  if (!form.value.password) {
    errors.value.password = t('auth.errPasswordRequired')
    isValid = false
  } else if (form.value.password.length < 3) {
    errors.value.password = t('auth.errPasswordShort')
    isValid = false
  }

  return isValid
}

const handleLogin = async () => {
  if (!validateForm()) return

  loginError.value = ''
  loading.value = true

  try {
    const result = await login({
      email: form.value.email.trim().toLowerCase(),
      password: form.value.password,
    })

    if (result && result.success) {
      await checkAuth()

      if (user.value) {
        $notify.success(t('auth.welcomeBack', { name: user.value.name || t('header.defaultUserName') }), t('auth.welcomeTitle'))
        setTimeout(() => router.push(redirectTarget.value), 100)
      } else {
        throw new Error(t('auth.errState'))
      }
    } else {
      loginError.value = result?.error || t('auth.errLoginDefault')
    }
  } catch (error) {
    if (error.data?.message || error.data?.statusMessage) {
      loginError.value = error.data.message || error.data.statusMessage
    } else if (error.status === 401) {
      loginError.value = t('auth.errLoginWrong')
    } else if (error.status === 500) {
      loginError.value = t('auth.errServerError')
    } else {
      loginError.value = error.message || t('auth.errLoginGeneric')
    }
  } finally {
    loading.value = false
  }
}

// Заполняет форму тестовыми данными — только по клику, без автозаполнения
const fillTestData = () => {
  form.value.email = 'admin@shop.ru'
  form.value.password = 'admin123'
}
</script>