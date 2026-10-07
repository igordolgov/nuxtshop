<!-- app/components/FullScreenToggle.vue -->
<!-- ============================================
  Компонент: FullScreenToggle
  Назначение: кнопка переключения полноэкранного режима
  Работает во всех современных браузерах
============================================ -->
<template lang="pug">
button.btn.btn-circle.transition-transform.duration-200(
  v-if="isSupported"
  @click="toggleFullscreen"
  :class="isFullscreen ? 'btn-primary' : 'btn-ghost bg-base-200/50'"
  class="w-8 h-8 hover:scale-110 lg:w-10 lg:h-10"
  :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'"
  aria-label="Переключить полноэкранный режим"
)
  //- Иконка "развернуть" (когда не в полноэкранном режиме)
  svg.w-4.h-4(
    class="lg:w-5 lg:h-5"
    v-if="!isFullscreen"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  )
    path(
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
    )
  
  //- Иконка "свернуть" (когда в полноэкранном режиме)
  svg.w-4.h-4(
    class="lg:w-5 lg:h-5"
    v-else
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  )
    path(
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
    )
</template>

<script setup>
// ============================================
// Реактивное состояние
// ============================================
const isFullscreen = ref(false)
const isSupported = ref(false)

// ============================================
// Методы
// ============================================
const checkSupport = () => {
  isSupported.value = !!(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled
  )
}

const checkStatus = () => {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  )
}

const toggleFullscreen = async () => {
  if (!isSupported.value) return
  
  try {
    if (!isFullscreen.value) {
      // Входим в полноэкранный режим
      const element = document.documentElement
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen()
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen()
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen()
      }
    } else {
      // Выходим из полноэкранного режима
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen()
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen()
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen()
      }
    }
  } catch (error) {
    console.warn('Fullscreen toggle error:', error)
  }
}

const handleFullscreenChange = () => {
  checkStatus()
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  if (process.client) {
    checkSupport()
    checkStatus()
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
  }
})

onUnmounted(() => {
  if (process.client) {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
  }
})
</script>