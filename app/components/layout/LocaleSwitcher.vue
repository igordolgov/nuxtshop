<!-- app/components/layout/LocaleSwitcher.vue — переключатель языка витрины.
     switchLocalePath() из @nuxtjs/i18n сохраняет текущий маршрут, подставляя
     локализованный префикс (/en, /es; ru — без префикса).
     Язык определяется ТОЛЬКО URL — детерминированный SSR, без hydration mismatch.
     ⚠️ Обычный <a>, а НЕ NuxtLink: полный page load. Причина: резолвер
     маршрутов @nuxtjs/i18n (runtime/routing/navigation.js → resolveNavigation)
     перехватывает клиентскую навигацию на корень «/» и возвращает её в
     текущую локаль (URL-локаль обязана совпадать с композером) — иначе
     уход на русский с /en и /es невозможен. Полная загрузка обходит
     клиентский резолвер целиком, SSR отдаёт целевую локаль по URL. -->
<template lang="pug">
.relative(ref="rootRef" v-if="locales.length > 1")
  button.btn.btn-ghost.btn-circle(
    type="button"
    :aria-label="$t('header.language')"
    :aria-expanded="isOpen"
    aria-haspopup="menu"
    class="w-11 h-11 min-h-0"
    @click="toggle"
  )
    span.flex.flex-col.items-center.justify-center.gap-0
      svg.w-5.h-5(
        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" stroke-width="1.75" class="text-base-content/85"
      )
        path(stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3 7.5 7.03 7.5 12s2.015 9 4.5 9zM3.6 9h16.8M3.6 15h16.8")
      span.font-bold.uppercase.leading-none(class="text-[0.6rem] text-base-content/70") {{ locale }}
  ul.locale-menu.absolute.top-full.right-0.mt-2.z-50(
    v-show="isOpen"
    class="bg-base-100 shadow-lg border border-base-300 rounded-xl min-w-36 overflow-hidden"
  )
    li(v-for="l in locales" :key="l.code")
      a.flex.items-center.justify-between.px-4.text-sm.font-medium(
        class="py-2.5"
        :href="switchLocalePath(l.code)"
        :class="l.code === locale ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-base-200 text-base-content'"
        @click="close"
      )
        | {{ l.name }}
        span.text-xs(v-if="l.code === locale") ✓
</template>

<style scoped>
.locale-menu {
  animation: localeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top right;
}

@keyframes localeIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .locale-menu {
    animation: none;
  }
}
</style>

<script setup>
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const isOpen = ref(false)
const rootRef = ref(null)

const toggle = () => { isOpen.value = !isOpen.value }
const close = () => { isOpen.value = false }

const onClickOutside = (event) => {
  if (isOpen.value && !rootRef.value?.contains(event.target)) close()
}

const onKeydown = (event) => {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})

//- Смена языка = смена маршрута: закрываем меню
const route = useRoute()
watch(() => route.path, () => close())
</script>
