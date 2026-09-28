<!-- app\components\ui\Modal.vue -->
<template>
  <div v-if="isOpen" class="modal modal-open">
    <div class="modal-box" :class="sizeClasses">
      <h3 class="font-bold text-lg mb-4">{{ title }}</h3>
      <slot />
    </div>
    <div class="modal-backdrop" @click="isOpen = false"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.isOpen,
  set: (value) => emit('update:isOpen', value)
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'max-w-sm'
    case 'md': return 'max-w-md'
    case 'lg': return 'max-w-lg'
    case 'xl': return 'max-w-xl'
    default: return 'max-w-md'
  }
})
</script>