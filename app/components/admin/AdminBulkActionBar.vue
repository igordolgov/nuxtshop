<!-- app/components/admin/AdminBulkActionBar.vue -->
<!-- Плавающая панель групповых операций над выбранными товарами.
     Появляется только при выделении; на мобильных висит над нижней
     навигацией (bottom-20), на десктопе — над нижним краем экрана.
     transform держим целиком в CSS (не через TW-утилиты translate),
     чтобы анимация появления не боролась с центрированием за одно свойство. -->
<template lang="pug">
Transition(name="bulk-bar")
  .bulk-bar.fixed.z-30(
    v-if="count > 0"
    role="toolbar"
    :aria-label="$t('admin.bulkBar.aria')"
  )
    .flex.items-center.gap-1.bg-neutral.text-neutral-content.rounded-2xl.shadow-xl.px-2.py-2(
      class="sm:gap-2 sm:px-3"
    )
      span.badge.badge-primary.badge-sm.font-bold {{ count }}
      span.text-sm.whitespace-nowrap.hidden(class="sm:inline") {{ $t('admin.bulkBar.selected') }}

      .w-px.h-6(class="bg-white/20")

      button.btn.btn-sm.btn-primary(
        @click="$emit('edit')"
        type="button"
        :title="$t('admin.bulkBar.editTitle')"
      )
        icon(name="heroicons:adjustments-horizontal" size="16")
        span {{ $t('admin.common.edit') }}

      button.btn.btn-sm.btn-error(
        @click="$emit('remove')"
        type="button"
        :title="$t('admin.bulkBar.deleteTitle')"
      )
        icon(name="heroicons:trash" size="16")
        span.hidden(class="sm:inline") {{ $t('admin.common.delete') }}

      button.btn.btn-sm.btn-ghost.btn-square(
        @click="$emit('clear')"
        type="button"
        :title="$t('admin.bulkBar.clearTitle')"
        :aria-label="$t('admin.bulkBar.clearAria')"
      )
        icon(name="heroicons:x-mark" size="18")
</template>

<script setup>
defineProps({
  // Количество выбранных товаров; 0 — панель скрыта
  count: { type: Number, default: 0 }
})

defineEmits(['edit', 'remove', 'clear'])
</script>

<style scoped>
.bulk-bar {
  left: 50%;
  bottom: 5rem; /* мобильные: над нижней навигацией */
  transform: translateX(-50%);
}

@media (min-width: 640px) {
  .bulk-bar {
    bottom: 1rem;
  }
}

.bulk-bar-enter-active,
.bulk-bar-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.bulk-bar-enter-from,
.bulk-bar-leave-to {
  transform: translate(-50%, 8px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .bulk-bar-enter-active,
  .bulk-bar-leave-active {
    transition: none;
  }
}
</style>
