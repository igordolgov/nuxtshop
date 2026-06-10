<!-- components/OrderModal.vue -->
<template lang="pug">
dialog.modal(:class="{ 'modal-open': modelValue }")
  .modal-box
    h3.text-lg.font-bold Детали заказа #{{ order.id }}
    .divider
    .space-y-3
      .flex.justify-between
        span Статус:
        .badge(:class="getStatusBadgeClass(order.status)") 
          | {{ getStatusText(order.status) }}
      .flex.justify-between
        span Дата заказа:
        span {{ formatDate(order.createdAt) }}
      .flex.justify-between
        span Сумма:
        span.font-bold {{ formatPrice(order.total) }}
    .divider
    h4.font-bold.mb-3 Товары:
    .space-y-2
      .flex.justify-between(v-for="item in order.items" :key="item.name")
        span {{ item.name }} × {{ item.quantity }}
        span {{ formatPrice(item.price * item.quantity) }}
    .modal-action
      button.btn(@click="$emit('update:modelValue', false)") Закрыть
</template>

<script setup>
defineProps({
  modelValue: Boolean,
  order: Object
})

defineEmits(['update:modelValue'])

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('ru-RU')
}

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(price)
}

const getStatusBadgeClass = (status) => {
  const classes = {
    pending: 'badge-warning',
    processing: 'badge-info', 
    completed: 'badge-success',
    cancelled: 'badge-error'
  }
  return classes[status] || 'badge-neutral'
}

const getStatusText = (status) => {
  const texts = {
    pending: 'Ожидает',
    processing: 'В обработке',
    completed: 'Завершен',
    cancelled: 'Отменен'
  }
  return texts[status] || status
}
</script>