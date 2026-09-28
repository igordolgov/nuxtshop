<template lang="pug">
.offline-indicator
  //- Оффлайн баннер
  Transition(name="slide-down")
    .offline-banner(
      v-if="isOffline"
    )
      .banner-content
        Icon(name="mdi:wifi-off" size="20")
        span Нет подключения к интернету

  //- Баннер восстановления
  Transition(name="slide-down")
    .online-restored-banner(
      v-if="showRestoredMessage && isOnline"
    )
      .banner-content
        Icon(name="mdi:wifi" size="20")
        span Подключение восстановлено
</template>

<script setup>
import { useOffline } from '@/composables/useOffline'

const { isOnline, isOffline, showRestoredMessage } = useOffline()

// Добавляем класс на body
watch(isOffline, (offline) => {
  if (process.client) {
    document.body.style.paddingTop = offline ? '42px' : ''
  }
}, { immediate: true })
</script>

<style scoped>
.offline-indicator {
  position: relative;
  z-index: 100;
}

.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: white;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  z-index: 100;
}

.online-restored-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  z-index: 100;
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>