<!-- app\pages\news.vue -->
<template lang="pug">
.news-page.min-h-100dvh.bg-base-100.flex.flex-col
  Header
  .content-wrapper.flex-1.flex
    .main-content.bg-base-100.flex-1(
      :class="{ 'horizontal-orientation': isHorizontal }"
    )
      .container.mx-auto.p-6
        .text-center
          h1.text-3xl.font-bold.mb-4 Новости
          p.text-base-content.opacity-70.mb-4 Наши новости (в разработке)
          NuxtLink.btn.btn-primary(to="/") Вернуться на главную

  //- Мобильный футер
  ClientOnly
    MobileNavFooter(v-if="isMobile")
</template>

<style scoped>
/* Стили для горизонтальной ориентации */
.main-content.horizontal-orientation {
  margin-left: 14px;
}

/* Для горизонтальной ориентации на мобильных */
@media (max-width: 768px) {
  .main-content.horizontal-orientation {
    margin-left: 60px;
  }
}

/* Для очень маленьких экранов в горизонтальной ориентации */
@media (max-width: 740px) and (orientation: landscape) {
  .main-content.horizontal-orientation {
    margin-left: 60px;
  }
}
</style>

<script setup>
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import { useMobileDetection } from '@/composables/useMobileDetection'

const { isMobile } = useMobileDetection()

// Определяем горизонтальную ориентацию
const isHorizontal = ref(false)

const checkOrientation = () => {
  if (process.client) {
    isHorizontal.value = window.innerWidth > window.innerHeight && window.innerWidth <= 926
  }
}

// Инициализация ориентации
onMounted(() => {
  if (process.client) {
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
  }
})

onUnmounted(() => {
  if (process.client) {
    window.removeEventListener('resize', checkOrientation)
    window.removeEventListener('orientationchange', checkOrientation)
  }
})

definePageMeta({
  layout: 'default'
})
</script>