<template lang="pug">
.install-prompt(v-if="showPrompt")
  Transition(name="slide-up")
    .install-card.card.shadow-xl(
      v-if="!isDismissedRef"
    )
      .card-body.p-4
        .flex.items-start.gap-3
          .app-icon
            img(
              :src="'/pwa-192x192.png'"
              alt="App"
              width="48"
              height="48"
            )
          
          .flex-1
            h3.card-title.text-base Установить приложение?
            p.text-sm.opacity-70.mt-1
              | Работает оффлайн, быстрый доступ
          
          button.btn.btn-ghost.btn-xs.btn-circle(
            @click="dismiss"
          )
            Icon(name="mdi:close" size="16")

        .card-actions.justify-end.mt-3.gap-2
          button.btn.btn-ghost.btn-sm(
            @click="dismiss"
          ) Позже
          button.btn.btn-primary.btn-sm(
            @click="install"
          )
            Icon(name="mdi:download" size="16")
            span.ml-1 Установить

  .mini-prompt(
    v-if="showMiniPrompt"
    @click="showFullPrompt"
  )
    Icon(name="mdi:download" size="20")
    span Установить приложение
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

// State
const showPrompt = ref(false)
const showMiniPrompt = ref(false)
const deferredPrompt = ref(null)
const isDismissedRef = ref(false)

// Computed
const isStandalone = computed(() => {
  if (!process.client) return false
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
})

// Methods
const showFullPrompt = () => {
  showMiniPrompt.value = false
  showPrompt.value = true
}

const install = async () => {
  if (!deferredPrompt.value) return

  try {
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    
    if (outcome === 'accepted') {
      showPrompt.value = false
      showMiniPrompt.value = false
    }
  } finally {
    deferredPrompt.value = null
  }
}

const dismiss = () => {
  showPrompt.value = false
  showMiniPrompt.value = false
  isDismissedRef.value = true
  
  if (process.client) {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }
}

const wasDismissed = () => {
  if (!process.client) return false
  const dismissed = localStorage.getItem('pwa-install-dismissed')
  if (!dismissed) return false
  
  const dismissedTime = parseInt(dismissed)
  const weekInMs = 7 * 24 * 60 * 60 * 1000
  return Date.now() - dismissedTime < weekInMs
}

// Lifecycle
onMounted(() => {
  if (!process.client) return

  // Проверяем отклонён ли ранее
  isDismissedRef.value = wasDismissed()

  if (isStandalone.value || isDismissedRef.value) {
    return
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    
    // Показать через 60 секунд
    setTimeout(() => {
      if (!wasDismissed() && !isStandalone.value) {
        showMiniPrompt.value = true
      }
    }, 60000)
  })

  window.addEventListener('appinstalled', () => {
    showPrompt.value = false
    showMiniPrompt.value = false
    deferredPrompt.value = null
  })
})
</script>

<style scoped>
.install-prompt {
  position: fixed;
  z-index: 60;
}

.install-card {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  width: 380px;
  background: white;
  border-radius: 16px;
  z-index: 60;
}

.app-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;
}

.app-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-prompt {
  position: fixed;
  bottom: 80px;
  right: 16px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 12px 16px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transition: transform 0.2s ease;
  z-index: 55;
}

.mini-prompt:hover {
  transform: scale(1.02);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}

@media (max-width: 480px) {
  .install-card {
    bottom: 70px;
    width: calc(100% - 16px);
  }
  
  .mini-prompt {
    bottom: 70px;
    right: 8px;
    font-size: 13px;
    padding: 10px 14px;
  }
}
</style>