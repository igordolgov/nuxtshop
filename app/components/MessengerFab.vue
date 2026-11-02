<!-- app/components/MessengerFab.vue — плавающая кнопка «написать нам».
     Собирает мессенджеры из редактируемого контента (админка → Контент,
     /api/content) и превращает пары { name, handle } в глубокие ссылки
     (shared/messengerLinks): Telegram/VK/WhatsApp/Viber открываются
     в приложении на телефоне. Плюс кнопка звонка по телефону магазина.
     Прячется в /admin; данных нет — не рендерится вовсе. -->
<template lang="pug">
.messenger-fab(v-if="rows.length")
  Transition(name="fab")
    nav.fab-menu(
      v-if="open"
      :aria-label="$t('contacts.fabAria')"
    )
      a.fab-row(
        v-for="row in rows"
        :key="row.key"
        :href="row.href"
        target="_blank"
        rel="noopener"
      )
        span.fab-ico(:style="{ background: row.color }" v-html="row.icon")
        span.fab-name {{ row.name }}

  button.fab-toggle(
    type="button"
    :aria-expanded="open ? 'true' : 'false'"
    :aria-label="$t('contacts.fabAria')"
    @click="open = !open"
  )
    svg(v-if="!open" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true")
      path(d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z")
    svg(v-else viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true")
      path(d="M6 6l12 12M18 6L6 18")
</template>

<script setup>
import {
  DEFAULT_SITE_CONTENT,
  localizedSiteContent,
  normalizePhoneHref,
} from '#shared/siteContent'
import { messengerLink } from '#shared/messengerLinks'

const route = useRoute()
const { t } = useI18n()

/* Тот же ключ useAsyncData, что на странице контактов: данные грузятся
   один раз и переиспользуются из payload (без повторного запроса). */
const { data: contentResp } = useAsyncData(
  'site-content',
  () => $fetch('/api/content').catch(() => null),
  { default: () => null },
)

const locale = useStoreLocale()

const content = computed(() => {
  const stored = contentResp.value?.content ?? DEFAULT_SITE_CONTENT
  return localizedSiteContent(stored, locale.value)
})

/* Брендовые цвета и глифы (fill white) — inline, без ассетов */
const BRAND_ICONS = {
  telegram: {
    color: '#229ED9',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M9.04 15.51 8.9 19.1c.4 0 .57-.17.78-.38l1.87-1.8 3.88 2.85c.71.4 1.22.19 1.41-.66l2.56-12.02c.23-1.06-.38-1.48-1.08-1.22L3.36 11.4c-1.03.4-1.02.98-.18 1.24l3.79 1.18 8.8-5.55c.41-.25.79-.11.48.14L9.04 15.5z"/></svg>',
  },
  whatsapp: {
    color: '#25D366',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.18-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.44h0c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41"/></svg>',
  },
  vk: {
    color: '#0077FF',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14c5.6 0 6.93-1.33 6.93-6.93V8.93C22 3.33 20.67 2 15.07 2m3.15 14.27h-1.46c-.55 0-.72-.44-1.69-1.42-.85-.82-1.22-.93-1.42-.93-.29 0-.37.08-.37.48v1.3c0 .34-.11.55-1 .55-1.47 0-3.11-.9-4.26-2.56-1.73-2.43-2.2-4.26-2.2-4.63 0-.2.08-.39.48-.39h1.46c.36 0 .5.17.63.57.7 2.01 1.88 3.77 2.37 3.77.18 0 .26-.08.26-.55V10.8c-.06-1-.58-1.08-.58-1.43 0-.17.14-.34.34-.34h2.29c.3 0 .41.16.41.52v2.65c0 .28.13.38.21.38.18 0 .32-.1.65-.44 1-1.12 1.72-2.85 1.72-2.85.09-.2.25-.39.61-.39h1.46c.44 0 .53.22.44.52-.18.85-1.97 3.37-1.97 3.37-.15.25-.21.36 0 .64.15.21.66.64 1 1.04.62.7 1.1 1.29 1.23 1.7.11.41-.1.62-.52.62"/></svg>',
  },
  viber: {
    color: '#7360F2',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/></svg>',
  },
}

const FALLBACK_ICON = BRAND_ICONS.viber.icon

const brand = (name) => {
  const n = String(name ?? '').toLowerCase()
  if (n.includes('telegram') || n === 'tg') return 'telegram'
  if (n.includes('whats') || n === 'wa') return 'whatsapp'
  if (n === 'vk' || n.includes('вк')) return 'vk'
  if (n.includes('viber')) return 'viber'
  return null
}

/* Строки меню: распознанные мессенджеры + звонок. Никакой ссылки
   (messengerLink → null) — строка не показывается. */
const rows = computed(() => {
  if (route.path.includes('/admin')) return []

  const out = []
  for (const m of content.value.contacts.messengers ?? []) {
    const href = messengerLink(m?.name, m?.handle)
    if (!href) continue
    const kind = brand(m?.name)
    out.push({
      key: String(m.name),
      name: m.name,
      href,
      color: kind ? BRAND_ICONS[kind].color : 'var(--color-primary)',
      icon: kind ? BRAND_ICONS[kind].icon : FALLBACK_ICON,
    })
  }

  const phone = content.value.contacts.phone
  if (phone) {
    out.push({
      key: 'phone',
      name: phone,
      href: `tel:${normalizePhoneHref(phone)}`,
      color: 'var(--color-primary)',
      icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.24 1.01l-2.2 2.2z"/></svg>',
    })
  }
  return out
})

const open = ref(false)
watch(() => route.path, () => {
  open.value = false
})
</script>

<style scoped>
.messenger-fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.fab-menu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.fab-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-base-content);
  text-decoration: none;
}

.fab-ico {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  color: #ffffff;
  flex: none;
}

.fab-name {
  padding-right: 0.25rem;
  white-space: nowrap;
}

.fab-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  background: var(--color-primary);
  color: var(--color-primary-content);
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.fab-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.25);
}

.fab-toggle:active {
  transform: scale(0.95);
}

/* Анимация раскрытия меню */
.fab-enter-active,
.fab-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Над мобильной навигацией (та же полка, где жил scroll-to-top) */
@media (max-width: 768px) {
  .messenger-fab {
    right: 16px;
    bottom: 92px;
  }
}

@media (min-width: 1440px) {
  .messenger-fab {
    right: 32px;
    bottom: 32px;
  }

  .fab-toggle {
    width: 3.5rem;
    height: 3.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fab-enter-active,
  .fab-leave-active,
  .fab-toggle {
    transition-duration: 0.01ms;
  }
}
</style>
