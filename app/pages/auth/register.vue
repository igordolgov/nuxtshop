<!-- pages/auth/register.vue -->
<template lang="pug">
.register-page
  .min-h-screen.flex.items-center.justify-center.bg-base-200
    .card.w-full.max-w-md.bg-base-100.shadow-xl
      .card-body
        .text-center.mb-8
          h1.card-title.text-3xl.justify-center Регистрация
          p.text-base-content.opacity-70.mt-2 Создайте новый аккаунт

        form(@submit.prevent="handleRegister")
          .form-control
            label.label
              span.label-text Имя
            input.input.input-bordered(
              type="text" 
              v-model="form.name"
              placeholder="Ваше имя"
              required
              autocomplete="name"
            )
            .label(v-if="errors.name")
              span.label-text-alt.text-error {{ errors.name }}

          .form-control.mt-4
            label.label
              span.label-text Email
            input.input.input-bordered(
              type="email" 
              v-model="form.email"
              placeholder="your@email.com"
              required
              autocomplete="email"
            )
            .label(v-if="errors.email")
              span.label-text-alt.text-error {{ errors.email }}

          .form-control.mt-4
            label.label
              span.label-text Пароль
            .relative
              input.input.input-bordered.w-full(
                :type="showPassword ? 'text' : 'password'"
                v-model="form.password"
                placeholder="••••••••"
                required
                autocomplete="new-password"
              )
              button.absolute.right-1.top-1.btn.btn-ghost.btn-sm(
                type="button"
                @click="showPassword = !showPassword"
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

          .form-control.mt-4
            label.label
              span.label-text Подтверждение пароля
            input.input.input-bordered(
              :type="showPassword ? 'text' : 'password'"
              v-model="form.confirmPassword"
              placeholder="••••••••"
              required
              autocomplete="new-password"
            )
            .label(v-if="errors.confirmPassword")
              span.label-text-alt.text-error {{ errors.confirmPassword }}

          .form-control.mt-6
            button.btn.btn-primary(
              type="submit"
              :disabled="loading"
              :class="{ 'loading': loading }"
            ) 
              span(v-if="!loading") Зарегистрироваться
              span(v-else) Регистрация...

          .text-center.mt-4
            p.text-sm
              | Уже есть аккаунт? 
              a.link.link-primary(@click="$router.push('/auth/login')") Войдите

        .alert.alert-error.mt-6(v-if="registerError")
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
          span {{ registerError }}
</template>

<script setup>
const { register, isAuthenticated } = useAppState()
const router = useRouter()
const { $notify } = useNuxtApp()

// Состояние формы
const form = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const registerError = ref('')
const errors = ref({})
const loading = ref(false)

// Проверка аутентификации при загрузке
onMounted(() => {
  if (isAuthenticated.value) {
    console.log('🔐 Пользователь уже авторизован, перенаправляем на главную')
    router.push('/')
  }
})

// Валидация формы
const validateForm = () => {
  errors.value = {}
  
  if (!form.value.name.trim()) {
    errors.value.name = 'Имя обязательно для заполнения'
  }
  
  if (!form.value.email) {
    errors.value.email = 'Email обязателен для заполнения'
  } else if (!/\S+@\S+\.\S+/.test(form.value.email)) {
    errors.value.email = 'Некорректный формат email'
  }
  
  if (!form.value.password) {
    errors.value.password = 'Пароль обязателен для заполнения'
  } else if (form.value.password.length < 6) {
    errors.value.password = 'Пароль должен содержать минимум 6 символов'
  }
  
  if (!form.value.confirmPassword) {
    errors.value.confirmPassword = 'Подтверждение пароля обязательно'
  } else if (form.value.password !== form.value.confirmPassword) {
    errors.value.confirmPassword = 'Пароли не совпадают'
  }
  
  return Object.keys(errors.value).length === 0
}

// Обработчик регистрации
const handleRegister = async () => {
  if (!validateForm()) return

  registerError.value = ''
  loading.value = true
  
  try {
    const result = await register({
      name: form.value.name.trim(),
      email: form.value.email.toLowerCase(),
      password: form.value.password
    })

    if (result.success) {
      $notify.success('Добро пожаловать в нашу систему!', 'Регистрация успешна!')
      router.push('/')
    } else {
      registerError.value = result.error
    }
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error)
    registerError.value = error.data?.statusMessage || 'Ошибка при регистрации'
  } finally {
    loading.value = false
  }
}
</script>