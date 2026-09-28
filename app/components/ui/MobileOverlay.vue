<template lang="pug">
.mobile-overlay.fixed.inset-0.bg-black.bg-opacity-50.z-20(
  @click="$emit('close')"
  class="lg:hidden"
)
</template>

<script setup>
defineEmits(['close'])
</script>

<style scoped>
.mobile-overlay {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 0.5; }
}
</style>