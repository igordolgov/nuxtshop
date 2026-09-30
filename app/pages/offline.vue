<!-- app/pages/offline.vue -->
<!-- ============================================
  Страница: offline
  Офлайн-фолбэк PWA: service worker отдаёт её вместо непрокэшированных
  URL, когда нет сети (navigateFallback в конфиге pwa).
  Пререндерится на билде → доступна мгновенно из precache.
============================================ -->
<template lang="pug">
.flex.items-center.justify-center.bg-base-100(class="min-h-[70dvh]")
  .text-center.max-w-md.px-4
    .size-18.rounded-full.flex.items-center.justify-center.mx-auto.mb-4(
      class="bg-base-200 text-base-content/40"
    )
      svg.size-8(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5")
        path(stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z")
    h1.text-2xl.font-semibold.text-base-content Нет подключения
    p.text-base-content/60.mt-2
      | Проверь интернет-соединение. Корзина и избранное сохранены
      | на устройстве и никуда не денутся.
    button.btn.btn-primary.mt-6(@click="reload") Обновить
</template>

<script setup>
useSeoMeta({
  title: 'Нет соединения — Магазин',
  robots: 'noindex, nofollow',
})

const reload = () => {
  if (import.meta.client) window.location.reload()
}
</script>