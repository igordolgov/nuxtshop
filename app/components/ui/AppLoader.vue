<!-- AppLoader -->
<template lang="pug">
  #style-loading.fixed.inset-0.bg-base-100.z-50.flex.items-center.justify-center(
    v-if="show"
    :class="overlayClass"
  )
    .loading.loading-spinner(
      :class="spinnerClass"
      :class="sizeClass"
    )
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'lg', // sm, md, lg
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  overlay: {
    type: Boolean,
    default: true
  }
})

const sizeClass = computed(() => {
  const sizes = {
    sm: 'loading-sm',
    md: 'loading-md', 
    lg: 'loading-lg'
  }
  return sizes[props.size]
})

const overlayClass = computed(() => ({
  'bg-base-100': props.overlay,
  'bg-transparent': !props.overlay
}))

const spinnerClass = computed(() => ({
  'text-primary': true
}))
</script>