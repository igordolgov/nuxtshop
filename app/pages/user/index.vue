<!-- pages/user/index.vue -->
<template lang="pug">
.user-account.min-h-screen.bg-base-200
  //- ХЕДЕР
  ClientOnly
    Header

  .container.mx-auto.p-4.max-w-7xl
    //- Состояние загрузки
    .flex.justify-center.items-center.min-h-96(v-if="loading")
      .loading.loading-spinner.loading-lg.text-primary
      span.ml-3 Загрузка...

    //- Состояние неавторизованного пользователя
    .flex.justify-center.items-center.min-h-96(v-else-if="!isAuthenticated")
      .text-center
        .text-4xl.mb-4 🔒
        h2.text-xl.font-bold.mb-3 Требуется авторизация
        button.btn.btn-primary.btn-sm(@click="navigateTo('/auth/login')") Войти

    //- Основной контент
    .space-y-4.pb-20(v-else)
      //- Верхняя строка - информация о пользователе
      .card.bg-base-100.shadow-sm
        .card-body.p-4
          .flex.items-center.justify-between.flex-wrap.gap-4
            .flex.items-center.gap-4
              .avatar
                .w-12.rounded-full.bg-primary.text-primary-content.flex.items-center.justify-center
                  span.text-sm.font-bold {{ userInitials }}
              div
                h2.card-title.text-lg {{ userName }}
                p.text-sm(class="text-base-content/70") {{ userEmail }}
              .badge.badge-lg.rounded-sm(
                :class="userRole === 'admin' ? 'badge-primary' : userRole === 'manager' ? 'badge-secondary' : 'badge-accent'"
              ) {{ userRole }}
            
            .flex.items-center.justify-between.gap-2
              .stats.stats-horizontal
                .stat.p-2
                  .stat-value.text-lg {{ orders.length }}
                  .stat-desc.text-xs Заказы
                .stat.p-2
                  .stat-value.text-lg {{ favoritesCount }}
                  .stat-desc.text-xs Избранное
              button.btn.btn-outline.btn-error.btn-sm.ml-auto(@click="logout")
                svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1")

      //- Основной контент в 2 колонки
      .grid.grid-cols-1.gap-4(class="lg:grid-cols-2")
        //- Левая колонка
        .space-y-4
          //- Редактирование профиля
          .card.bg-base-100.shadow-sm
            .card-body.p-4
              h3.card-title.text-md.mb-4 📝 Редактирование профиля
              form.grid.grid-cols-1.gap-3(@submit.prevent="updateProfile" class="md:grid-cols-2")
                .form-control
                  label.label.py-1
                    span.label-text.text-sm Имя
                  input.input.input-bordered.input-sm(type="text" v-model="profileForm.name")
                
                .form-control
                  label.label.py-1
                    span.label-text.text-sm Email
                  input.input.input-bordered.input-sm.text-sm(type="email" v-model="profileForm.email" disabled)
                
                .form-control
                  label.label.py-1
                    span.label-text.text-sm Телефон
                  input.input.input-bordered.input-sm(type="tel" v-model="profileForm.phone")
                
                .form-control(class="md:col-span-2")
                  label.label.py-1.mr-2
                    span.label-text.text-sm Адрес доставки
                  textarea.textarea.textarea-bordered.textarea-sm(v-model="profileForm.address" rows="2")
                
                div(class="md:col-span-2")
                  button.btn.btn-primary.btn-sm(:disabled="updatingProfile")
                    span(v-if="updatingProfile") Сохранение...
                    span(v-else) Сохранить изменения

          //- Статистика
          .card.bg-base-100.shadow-sm
            .card-body.p-4
              h3.card-title.text-md 📊 Детальная статистика
              .grid.grid-cols-2.gap-2(class="md:grid-cols-4")
                .stat.place-items-center.text-center.mr-4
                  .stat-figure.text-primary
                    svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2")
                  .stat-value.text-lg {{ orders.length }}
                  .stat-title.text-xs Всего заказов
                
                .stat.place-items-center.text-center
                  .stat-figure.text-info
                    svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z")
                  .stat-value.text-lg {{ activeOrdersCount }}
                  .stat-title.text-xs Активных
                
                .stat.place-items-center.text-center
                  .stat-figure.text-secondary
                    svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z")
                  .stat-value.text-lg {{ favoritesCount }}
                  .stat-title.text-xs Избранное
                
                .stat.place-items-center.text-center
                  .stat-figure.text-success
                    svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z")
                  .stat-value.text-lg {{ completedOrdersCount }}
                  .stat-title.text-xs Завершено

        //- Правая колонка
        .space-y-4
          //- Быстрые действия
          .card.bg-base-100.shadow-sm
            .card-body.p-4
              h3.card-title.text-md.mb-3 ⚡ Быстрые действия
              .flex.flex-col.gap-2
                button.btn.btn-primary.btn-sm.justify-start(@click="navigateTo('/cart')")
                  svg.w-4.h-4.mr-2(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                    path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
                  span Корзина покупок
                
                button.btn.btn-secondary.btn-sm.justify-start(@click="navigateTo('/')")
                  svg.w-4.h-4.mr-2(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                    path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6")
                  span Вернуться в магазин
                
                button.btn.btn-accent.btn-sm.justify-start(@click="navigateTo('/favorites')")
                  svg.w-4.h-4.mr-2(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                    path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z")
                  span Мои избранные

          //- Последние заказы
          .card.bg-base-100.shadow-sm
            .card-body.p-4
              .flex.items-center.justify-between.mb-3
                h3.card-title.text-md 📦 Последние заказы
                .badge.badge-sm.badge-outline.rounded-sm {{ orders.length }}

              .text-center.py-4(v-if="orders.length === 0")
                .text-2xl 📭
                p.text-xs Нет заказов
                button.btn.btn-primary.btn-xs.mt-2(@click="navigateTo('/')") Сделать заказ
              
              .flex.flex-col.gap-3(v-else)
                //- Заказ с раскрывающимися деталями
                .border.rounded-lg.overflow-hidden(
                  v-for="order in orders" 
                  :key="order.id"
                )
                  //- Заголовок заказа (кликабельный)
                  .p-3.cursor-pointer(
                    class="bg-base-50 hover:bg-base-200 transition-colors"
                    @click="toggleOrderDetails(order.id)"
                  )
                    .flex.items-center.justify-between.gap-2
                      .flex.items-center.justify-between.gap-4
                        .badge.badge-sm.rounded-sm.text-white(:class="getStatusBadgeClass(order.status)") {{ getStatusText(order.status) }}
                        .font-semibold Заказ №{{ order.id }}
                    
                    .flex.items-center.justify-between.mt-2
                      .text-xs(class="text-base-content/70") {{ formatDate(order.createdAt) }}
                      .text-xs(class="text-base-content/70") {{ order.items?.length || 0 }} товар(ов)
                      .flex.items-center.gap-2
                        .text-sm.font-bold.text-sky-600 {{ formatPrice(order.total) }}
                        svg.w-4.h-4.transition-transform(
                          :class="expandedOrders.includes(order.id) ? 'rotate-180' : ''"
                          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        )
                          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7")
                  
                  //- Детали заказа (раскрывающиеся)
                  .border-t.p-3.bg-base-100(v-if="expandedOrders.includes(order.id)")
                    //- Товары в заказе
                    .mb-3
                      .text-xs.font-semibold.mb-2.uppercase(class="text-base-content/60") Товары
                      .flex.flex-col.gap-2
                        .flex.items-center.gap-3.p-2.bg-base-200.rounded(
                          v-for="item in order.items" 
                          :key="item.id"
                        )
                          NuxtImg.w-12.h-12.rounded.object-cover.flex-shrink-0(
                            :src="item.image || '/images/placeholder.jpg'" 
                            :alt="item.name"
                          )
                          .flex-1.min-w-0
                            .font-medium.text-sm.truncate {{ item.name }}
                            p.text-xs(class="text-base-content/70") {{ item.quantity }} шт. × {{ formatPrice(item.price) }}
                          .text-sm.font-semibold {{ formatPrice(item.price * item.quantity) }}
                    
                    //- Информация о доставке и оплате
                    .grid.grid-cols-1.gap-2.mb-3(class="sm:grid-cols-2")
                      .p-2.bg-base-200.rounded
                        .text-xs.font-semibold.mb-1.uppercase(class="text-base-content/60") Доставка
                        .text-sm {{ getDeliveryText(order.deliveryMethod) }}
                        p.text-xs.mt-1(v-if="order.customer?.city" class="text-base-content/70") 
                          | {{ order.customer.city }}{{ order.customer.address ? ', ' + order.customer.address : '' }}
                      
                      .p-2.bg-base-200.rounded
                        .text-xs.font-semibold.mb-1.uppercase(class="text-base-content/60") Оплата
                        .text-sm {{ getPaymentText(order.paymentMethod) }}
                    
                    //- Суммы
                    .border-t.pt-2
                      .flex.justify-between.text-xs.mb-1
                        span(class="text-base-content/70") Подытог
                        span {{ formatPrice(order.subtotal) }}
                      .flex.justify-between.text-xs.mb-1(v-if="order.discount > 0")
                        span(class="text-base-content/70") Скидка
                        span.text-error -{{ formatPrice(order.discount) }}
                      .flex.justify-between.text-xs.mb-1
                        span(class="text-base-content/70") Доставка
                        span {{ order.deliveryPrice > 0 ? formatPrice(order.deliveryPrice) : 'Бесплатно' }}
                      .flex.justify-between.text-sm.font-bold.pt-1.border-t.mt-1
                        span Итого
                        span.text-sky-600 {{ formatPrice(order.total) }}

          //- Избранное
          .card.bg-base-100.shadow-sm
            .card-body.p-4
              .flex.items-center.justify-between.mb-3
                h3.card-title.text-md ❤️ Избранное
                .badge.badge-sm.badge-outline.rounded-sm {{ favoritesCount }}
              
              .text-center.py-4(v-if="favoritesCount === 0")
                .text-2xl.mb-2 🤍
                p.text-xs Нет избранного
                button.btn.btn-primary.btn-xs.mt-2(@click="navigateTo('/')") Найти товары
              
              .flex.flex-col.gap-2(v-else)
                //- Карточка товара в избранном - кликабельная
                .flex.items-center.gap-3.p-2.border.rounded-lg.cursor-pointer.transition-colors(
                  v-for="product in favoriteProducts" 
                  :key="product.id"
                  class="hover:bg-base-200"
                  @click="goToProduct(product)"
                )
                  NuxtImg.w-14.h-14.rounded.object-cover.flex-shrink-0(
                    :src="product.image || '/images/placeholder.jpg'" 
                    :alt="product.name"
                  )
                  .flex-1.min-w-0
                    .font-medium.text-sm.truncate {{ product.name }}
                    p.text-xs(class="text-base-content/70") {{ product.category || '' }}
                    .text-sm.font-bold.text-sky-600.mt-1 {{ formatPrice(product.price) }}
                  .flex.flex-col.gap-1
                    button.btn.btn-ghost.btn-xs(
                      @click.stop="addToCart(product)"
                      title="В корзину"
                    )
                      svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                        path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
                    button.btn.btn-ghost.btn-xs.text-error(
                      @click.stop="removeFavorite(product)"
                      title="Удалить"
                    )
                      svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor")
                        path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")

  //- МОБИЛЬНЫЙ ФУТЕР
  MobileNavFooter(class="lg:hidden")
</template>

<script setup>
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

definePageMeta({
  middleware: 'user-auth'
})

const { $notify } = useNuxtApp()
const appState = useAppState()
const { addToCart: addToCartCart } = useCart()

// Состояние загрузки
const loading = ref(true)
const isAuthenticated = ref(false)
const updatingProfile = ref(false)
const currentUser = ref(null)

// Раскрытые заказы
const expandedOrders = ref([])

// Заказы
const orders = ref([])

// Избранное
const localFavoriteProducts = ref([])

// Загрузка данных пользователя
const loadUserData = async () => {
  try {
    loading.value = true
    isAuthenticated.value = appState.isAuthenticated?.value || false
    
    if (!isAuthenticated.value) {
      loading.value = false
      return
    }

    // Ждем загрузки пользователя
    let attempts = 0
    while (!appState.user?.value && attempts < 30) {
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }
    
    currentUser.value = appState.user?.value || null
    loadOrders()
    loadFavorites()
  } catch (error) {
    console.error('Ошибка загрузки:', error)
  } finally {
    loading.value = false
  }
}

// Загрузка заказов
const loadOrders = () => {
  if (process.client) {
    try {
      const saved = localStorage.getItem('userOrders')
      if (saved) orders.value = JSON.parse(saved)
    } catch (e) {
      orders.value = []
    }
  }
}

// Загрузка избранного
const loadFavorites = () => {
  if (process.client) {
    try {
      const saved = localStorage.getItem('favoriteProducts')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          localFavoriteProducts.value = typeof parsed[0] === 'object' ? parsed : []
        }
      }
    } catch (e) {
      localFavoriteProducts.value = []
    }
  }
}

const toggleOrderDetails = (orderId) => {
  const index = expandedOrders.value.indexOf(orderId)
  if (index === -1) expandedOrders.value.push(orderId)
  else expandedOrders.value.splice(index, 1)
}

const getStatusText = (status) => ({ pending: 'Ожидает', processing: 'В обработке', completed: 'Выполнен', cancelled: 'Отменён' }[status] || status)
const getDeliveryText = (method) => ({ courier: 'Курьер', pickup: 'Самовывоз', post: 'Почта' }[method] || method)
const getPaymentText = (method) => ({ card: 'Карта', cash: 'Наличные', online: 'Онлайн' }[method] || method)

const goToProduct = (product) => {
  if (product.slug) return navigateTo(`/product/${product.slug}`)
  if (product.categorySlug && product.id) return navigateTo(`/${product.categorySlug}/${product.id}`)
  if (product.category && product.id) {
    const cat = product.category.toLowerCase().replace(/\s+/g, '-')
    return navigateTo(`/${cat}/${product.id}`)
  }
  if (product.id) return navigateTo(`/product/${product.id}`)
  $notify.error('Товар недоступен')
}

const logout = async () => {
  if (!confirm('Выйти из системы?')) return
  try {
    const result = await appState.logout()
    if (result.success) {
      $notify.success('Вы вышли из системы')
      await navigateTo('/')
      if (process.client) setTimeout(() => location.reload(), 100)
    }
  } catch (e) {
    $notify.error('Ошибка при выходе')
  }
}

// Обновление профиля
const updateProfile = async () => {
  try {
    updatingProfile.value = true
    
    const data = await $fetch('/api/auth/profile', {
      method: 'PUT',
      body: {
        name: profileForm.value.name,
        phone: profileForm.value.phone,
        address: profileForm.value.address
      }
    })

    if (data?.success) {
      // Обновляем локальное состояние
      currentUser.value = { ...currentUser.value, ...data.user }
      
      // Обновляем appState
      if (appState.user?.value) {
        appState.user.value = { ...appState.user.value, ...data.user }
      }
      
      // Перезагружаем данные с сервера для синхронизации
      if (appState.checkAuth) {
        await appState.checkAuth()
      }
      
      $notify.success('Профиль обновлен')
    } else {
      throw new Error(data?.message || 'Ошибка')
    }
  } catch (error) {
    console.error('Ошибка:', error)
    $notify.error(error.data?.statusMessage || error.message || 'Ошибка обновления')
  } finally {
    updatingProfile.value = false
  }
}

const addToCart = (product) => {
  addToCartCart(product)
  $notify.success('Добавлено в корзину')
}

const removeFavorite = async (product) => {
  localFavoriteProducts.value = localFavoriteProducts.value.filter(p => p.id !== product.id)
  localStorage.setItem('favoriteProducts', JSON.stringify(localFavoriteProducts.value))
  if (appState.removeFromFavorites) await appState.removeFromFavorites(product.id)
  window.dispatchEvent(new CustomEvent('favorites-updated'))
  $notify.info('Удалено из избранного')
}

onMounted(async () => {
  await loadUserData()
  if (process.client) {
    window.addEventListener('favorites-updated', loadFavorites)
    window.addEventListener('storage', e => { if (e.key === 'favoriteProducts') loadFavorites() })
  }
})

onUnmounted(() => {
  if (process.client) window.removeEventListener('favorites-updated', loadFavorites)
})

// Вычисляемые свойства
const userInitials = computed(() => currentUser.value?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U')
const userName = computed(() => currentUser.value?.name || 'Пользователь')
const userEmail = computed(() => currentUser.value?.email || '')
const userRole = computed(() => currentUser.value?.role || 'user')

const profileForm = ref({ name: '', email: '', phone: '', address: '' })

watchEffect(() => {
  if (currentUser.value) {
    profileForm.value = {
      name: currentUser.value.name || '',
      email: currentUser.value.email || '',
      phone: currentUser.value.phone || '',
      address: currentUser.value.address || ''
    }
  }
})

const activeOrdersCount = computed(() => orders.value.filter(o => o.status === 'processing' || o.status === 'pending').length)
const completedOrdersCount = computed(() => orders.value.filter(o => o.status === 'completed').length)
const favoriteProducts = computed(() => localFavoriteProducts.value)
const favoritesCount = computed(() => localFavoriteProducts.value.length)

const formatDate = (date) => new Date(date).toLocaleDateString('ru-RU')
const formatPrice = (price) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(price || 0)
const getStatusBadgeClass = (status) => ({ pending: 'badge-warning', processing: 'badge-info', completed: 'badge-success', cancelled: 'badge-error' }[status] || 'badge-neutral')
</script>