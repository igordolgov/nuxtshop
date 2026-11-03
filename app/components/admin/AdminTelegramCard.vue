<!-- app/components/admin/AdminTelegramCard.vue — статус Telegram-бота
     и подключение вебхука кнопкой (POST /api/telegram/webhook/setup).
     Заменяет ручной curl из README; при смене домена — та же кнопка. -->
<template lang="pug">
.telegram-card.bg-base-100.border.rounded-2xl.p-4(class="border-base-300")
  //- Скелетон первой загрузки
  .skeleton.h-10.rounded-xl(v-if="isLoading")

  template(v-else)
    .flex.items-center.justify-between.gap-3
      .flex.items-center.gap-2.min-w-0
        .size-9.rounded-xl.flex.items-center.justify-center.shrink-0(
          class="bg-base-200 text-base-content/70"
        )
          svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5")
        .min-w-0
          .flex.items-center.gap-2.flex-wrap
            span.text-sm.font-medium {{ $t('admin.telegram.title') }}
            span.badge.badge-sm.rounded-full(:class="badgeClass") {{ badgeText }}
      button.btn.btn-sm.rounded-lg(
        type="button"
        :class="connected ? 'btn-ghost' : 'btn-primary'"
        :disabled="busy"
        @click="connect"
      )
        span.loading.loading-spinner.loading-xs(v-if="busy")
        | {{ connected ? $t('admin.telegram.reconnect') : $t('admin.telegram.connect') }}

    //- Статусная строка: подсказка/ошибка/адрес вебхука
    p.text-xs.mt-2(class="text-base-content/50" :class="{ 'text-error': isStatusError }")
      | {{ statusText }}

    //- Детали: адрес, очередь, последняя ошибка доставки Telegram
    .mt-2.space-y-1.text-xs(v-if="connected || pendingCount > 0 || lastErrorText")
      .flex.gap-1.min-w-0(v-if="connected")
        span.shrink-0(class="text-base-content/50") {{ $t('admin.telegram.urlLabel') }}:
        span.font-mono.truncate {{ webhookUrl }}
      .flex.gap-1(v-if="pendingCount > 0")
        span.shrink-0(class="text-base-content/50") {{ $t('admin.telegram.pendingLabel') }}:
        span {{ pendingCount }}
      .flex.gap-1.min-w-0(v-if="lastErrorText")
        span.shrink-0.text-error {{ $t('admin.telegram.lastErrorLabel') }}:
        span.text-error.truncate {{ lastErrorText }}
</template>

<script setup>
const { $notify } = useNuxtApp()
const { t } = useI18n()

//- ─── Состояние (GET /api/telegram/webhook/setup) ────────────────────
const isLoading = ref(true)
const configured = ref(false)
//- WebhookInfo от Telegram: { url, pending_update_count, last_error_* }
const webhook = ref(null)
//- Ошибка GET-запроса (сеть/500) — отличается от apiError (ответ Telegram)
const loadError = ref(null)
//- Ошибка из ответа сервера: Telegram недоступен / битый токен
const apiError = ref(null)

const load = async () => {
  isLoading.value = true
  loadError.value = null
  try {
    const resp = await $fetch('/api/telegram/webhook/setup')
    configured.value = Boolean(resp.configured)
    webhook.value = resp.webhook
    apiError.value = resp.error
  } catch (err) {
    loadError.value = err?.data?.message || err?.message || 'error'
    console.error('[telegram-card] Ошибка статуса:', loadError.value)
  } finally {
    isLoading.value = false
  }
}
onMounted(load)

//- ─── Производные состояния ──────────────────────────────────────────
const webhookUrl = computed(() => webhook.value?.url || '')
const connected = computed(() => configured.value && Boolean(webhookUrl.value))
const pendingCount = computed(() => webhook.value?.pending_update_count ?? 0)

const lastErrorText = computed(() => {
  const message = webhook.value?.last_error_message
  if (!message) return ''
  const at = webhook.value?.last_error_date
  return at ? `${message} (${new Date(at * 1000).toLocaleString()})` : message
})

const badgeClass = computed(() => {
  if (!configured.value) return 'badge-neutral'
  if (loadError.value) return 'badge-error'
  return connected.value ? 'badge-success' : 'badge-warning'
})

const badgeText = computed(() => {
  if (!configured.value) return t('admin.telegram.notConfigured')
  if (loadError.value) return t('admin.telegram.loadError')
  return connected.value ? t('admin.telegram.connected') : t('admin.telegram.disconnected')
})

const isStatusError = computed(() => Boolean(loadError.value || apiError.value))

const statusText = computed(() => {
  if (loadError.value) return loadError.value
  if (!configured.value) return t('admin.telegram.hintNotConfigured')
  if (apiError.value) return apiError.value
  if (connected.value) return t('admin.telegram.hintConnected')
  return t('admin.telegram.hintDisconnected')
})

//- ─── Подключение (POST /api/telegram/webhook/setup) ─────────────────
const busy = ref(false)
const connect = async () => {
  if (busy.value) return
  busy.value = true
  try {
    const resp = await $fetch('/api/telegram/webhook/setup', { method: 'POST' })
    if (resp.success) {
      configured.value = true
      webhook.value = resp.webhook
      apiError.value = null
      $notify.success(t('admin.telegram.connectSuccess'))
    }
  } catch (err) {
    console.error('[telegram-card] Ошибка подключения:', err?.data?.message || err?.message)
    $notify.error(err?.data?.message || t('admin.telegram.connectFailed'))
  } finally {
    busy.value = false
  }
}
</script>
