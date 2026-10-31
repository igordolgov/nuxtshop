<!-- app/pages/user/orders.vue — «Мои заказы»: список заказов текущего
    пользователя с актуальными статусами (источник — сервер, не
    localStorage-зеркало). Повторная загрузка — pull-refresh кнопкой. -->
<template lang="pug">
.my-orders-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.flex.flex-col.max-w-4xl.w-full.mx-auto.px-3.py-4(class="lg:px-6")
    //- Заголовок + обновление
    .flex.items-center.justify-between.mb-4
      h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") Мои заказы
      button.btn.btn-ghost.btn-sm.rounded-xl(
        type="button"
        :disabled="isLoading"
        aria-label="Обновить"
        @click="loadOrders"
      )
        svg.w-4.h-4(
          :class="{ 'animate-spin': isLoading }"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        )
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")

    //- Скелетон первой загрузки
    .space-y-3(v-if="isLoading && !orders.length")
      .skeleton.h-40.rounded-2xl(v-for="i in 3" :key="i")

    //- Пустое состояние
    .text-center.py-20.flex.flex-col.items-center(
      v-else-if="!isLoading && !orders.length"
    )
      .size-18.rounded-full.flex.items-center.justify-center.mb-5(
        class="bg-base-200 text-base-content/50"
      )
        svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
          path(d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4")
      h2.text-lg.font-semibold.text-base-content Заказов пока нет
      p.text-sm.mb-5.max-w-sm.mx-auto(class="text-base-content/50")
        | Оформите первый заказ — он появится здесь вместе со статусом обработки
      NuxtLink.btn.btn-primary.rounded-xl(to="/") Перейти в каталог

    //- Список заказов
    .space-y-4(v-else)
      .order-card.bg-base-100.border.rounded-2xl.overflow-hidden(
        v-for="order in orders"
        :key="order.id"
        class="border-base-300"
      )
        //- Шапка карточки: номер + статус
        .flex.items-center.justify-between.gap-2.px-4.py-3.border-b(
          class="bg-base-200/50 border-base-300"
        )
          .font-mono.font-semibold.text-sm {{ order.id }}
          span.badge.badge-sm.rounded-full(
            :class="statusBadgeClass(order.status)"
          ) {{ statusLabel(order.status) }}

        //- Состав заказа (свёрнут/развёрнут)
        button.w-full.text-left.px-4.py-3.flex.items-center.justify-between(
          type="button"
          :aria-expanded="expanded.has(order.id)"
          @click="toggleExpand(order.id)"
        )
          .flex-1.min-w-0
            .text-sm.font-medium
              | {{ order.items[0]?.name }}
              span(v-if="order.items.length > 1" class="text-base-content/50")
                | &nbsp;и ещё {{ order.items.length - 1 }}
            .text-xs.mt-1(class="text-base-content/50")
              | {{ formatDate(order.createdAt) }} · {{ order.items.reduce((n, i) => n + i.quantity, 0) }} шт. · {{ deliveryLabel(order.deliveryMethod) }}
          svg.w-5.h-5.shrink-0.transition-transform(
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="text-base-content/40"
            :class="{ 'rotate-180': expanded.has(order.id) }"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7")

        //- Детали (развёрнутое состояние)
        .px-4.pb-4.space-y-3(v-if="expanded.has(order.id)")
          //- Позиции
          .space-y-2
            .flex.items-center.gap-3.p-2.rounded-xl.bg-base-200(
              v-for="item in order.items"
              :key="item.id"
            )
              .w-12.h-12.rounded-lg.overflow-hidden.flex-shrink-0.bg-base-300
                //- width/height = 48px (w-12 h-12) + decoding=async
                NuxtImg.w-full.h-full.object-cover(
                  :src="item.image || '/images/placeholder.jpg'"
                  :alt="item.name"
                  width="48"
                  height="48"
                  loading="lazy"
                  decoding="async"
                )
              .flex-1.min-w-0
                .text-sm.font-medium.truncate {{ item.name }}
                .text-xs(class="text-base-content/50") {{ item.quantity }} × {{ formatPrice(item.price) }}
              .text-sm.font-semibold {{ formatPrice(item.price * item.quantity) }}

          //- Суммы
          .space-y-1.text-sm.pt-2.border-t.border-base-300
            .flex.justify-between
              span(class="text-base-content/50") Товары
              span {{ formatPrice(order.subtotal) }}
            .flex.justify-between(v-if="order.discount > 0")
              span(class="text-base-content/50") Скидка {{ order.promoCode ? `(${order.promoCode})` : '' }}
              span.text-error -{{ formatPrice(order.discount) }}
            .flex.justify-between
              span(class="text-base-content/50") Доставка
              span {{ order.deliveryPrice === 0 ? 'Бесплатно' : formatPrice(order.deliveryPrice) }}
            .flex.justify-between.items-baseline.pt-2.border-t.border-base-300
              span.font-semibold Итого
              span.text-lg.font-bold {{ formatPrice(order.total) }}

          //- История статусов
          .pt-2.border-t.border-base-300
            .text-xs.font-medium.mb-2(class="text-base-content/50") История статусов
            .space-y-1
              .flex.items-center.gap-2.text-xs(
                v-for="h in order.statusHistory"
                :key="h.at"
              )
                span.w-2.h-2.rounded-full.flex-shrink-0(:class="statusDotClass(h.status)")
                span.font-medium {{ statusLabel(h.status) }}
                span(class="text-base-content/50") {{ formatDateTime(h.at) }}

          //- Действия
          .flex.gap-2.pt-1
            NuxtLink.btn.btn-outline.btn-sm.rounded-xl.flex-1(
              :to="`/product/${order.items[0]?.slug || ''}`"
              v-if="order.items.length === 1"
            ) Повторить заказ
            button.btn.btn-outline.btn-sm.rounded-xl.flex-1(
              type="button"
              @click="repeatOrder(order)"
              v-else
            ) Повторить заказ

  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
//- Страница «Мои заказы». Header/MobileNavFooter/композаблы — автоимпорт Nuxt

const { $notify } = useNuxtApp()
const { isMobile } = useMobileDetection()
const { addToCart } = useCart()

const orders = ref([])
const isLoading = ref(true)
//- Развёрнутые карточки: Set id (реактивный — используем ref c Set и
//- пересозданием, чтобы Vue видел изменения)
const expanded = ref(new Set())

const loadOrders = async () => {
  isLoading.value = true
  try {
    const response = await $fetch('/api/my/orders')
    if (response.success) {
      orders.value = response.orders
    }
  } catch (err) {
    // 401 — не авторизован: middleware всё равно не пустит на страницу,
    // но на случай протухшей сессии — показываем тост, а не падаем
    console.error('[my-orders] Ошибка загрузки:', err?.data?.message || err?.message)
    $notify.error('Не удалось загрузить заказы')
  } finally {
    isLoading.value = false
  }
}

//- Раскрыть/свернуть карточку заказа
const toggleExpand = (id) => {
  const next = new Set(expanded.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expanded.value = next
}

const formatPrice = (price) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price ?? 0)

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

//- Подписи статусов: зеркалим ORDER_STATUS_LABELS сервера
const STATUS_LABELS = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  shipped: 'В доставке',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}
const statusLabel = (s) => STATUS_LABELS[s] ?? s

const statusBadgeClass = (s) => ({
  new: 'badge-primary',
  confirmed: 'badge-success',
  shipped: 'badge-warning',
  delivered: 'badge-accent',
  cancelled: 'badge-error',
})

const statusDotClass = (s) => ({
  new: 'bg-primary',
  confirmed: 'bg-success',
  shipped: 'bg-warning',
  delivered: 'bg-accent',
  cancelled: 'bg-error',
})

const deliveryLabel = (m) =>
  m === 'courier' ? 'Курьером' : m === 'post' ? 'Почтой' : 'Самовывоз'

//- «Повторить заказ»: кладём все позиции в корзину (что есть на складе).
//- Уведомление подскажет, если что-то не добавилось
const repeatOrder = async (order) => {
  let added = 0
  for (const item of order.items) {
    try {
      await addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image ?? '',
        slug: item.slug ?? undefined,
        categories: item.category ? [item.category] : [],
        // Склад неизвестен из снапшота — берём как есть;
        // addToCart проверит лимит через stockQuantity товара при наличии
        stockQuantity: 999,
      })
      added++
    } catch {
      // позиция могла закончиться — идём дальше
    }
  }
  if (added === order.items.length) {
    $notify.success('Товары добавлены в корзину')
    await navigateTo('/cart')
  } else if (added > 0) {
    $notify.info(`Добавлено ${added} из ${order.items.length} — остальное закончилось`)
    await navigateTo('/cart')
  } else {
    $notify.error('Не удалось добавить: товары закончились')
  }
}

onMounted(() => {
  window.scrollTo(0, 0)
  loadOrders()
})

useHead({ title: 'Мои заказы' })

//- Страница только для авторизованных
definePageMeta({
  middleware: 'user-auth',
})
</script>