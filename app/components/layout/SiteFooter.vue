<!-- app/components/layout/SiteFooter.vue -->
<!-- ============================================
  Компонент: SiteFooter
  Назначение: десктопный футер витрины (аудит F16) — навигация,
  покупателям, контакты, копирайт. Только ≥1024px: на мобильных
  навигацию держит нижнее меню, дублировать её не нужно.
  Контакты — из /api/content (админка → «Контент»), фолбэк —
  дефолты shared/siteContent; сбой сети футер не ломает.
============================================ -->
<template lang="pug">
footer.site-footer.hidden.border-t.border-base-300(class="bg-base-200/40 lg:block")
  .container.mx-auto.px-6.py-10
    .grid.gap-8(class="grid-cols-2 lg:grid-cols-4")

      //- Бренд
      div
        .flex.items-center.gap-2.mb-3
          span.size-9.rounded-xl.bg-primary.text-primary-content.flex.items-center.justify-center.font-bold {{ $t('nav.brandInitial') }}
          span.font-semibold.text-lg {{ $t('nav.brand') }}
        p.text-sm.leading-relaxed(class="text-base-content/65") {{ $t('footer.tagline') }}

      //- Разделы
      nav(:aria-label="$t('footer.sections')")
        h3.footer-heading {{ $t('footer.sections') }}
        ul.space-y-2.text-sm
          li
            NuxtLink.footer-link(:to="$localePath('/')" prefetch) {{ $t('nav.home') }}
          li
            NuxtLink.footer-link(:to="$localePath('/news')" prefetch) {{ $t('nav.news') }}
          li
            NuxtLink.footer-link(:to="$localePath('/about')" prefetch) {{ $t('nav.about') }}
          li
            NuxtLink.footer-link(:to="$localePath('/contacts')" prefetch) {{ $t('nav.contacts') }}

      //- Покупателям
      nav(:aria-label="$t('footer.buyers')")
        h3.footer-heading {{ $t('footer.buyers') }}
        ul.space-y-2.text-sm
          li
            NuxtLink.footer-link(:to="$localePath('/')" prefetch) {{ $t('catalog.title') }}
          li
            NuxtLink.footer-link(:to="$localePath('/favorites')" prefetch) {{ $t('nav.favorites') }}
          li
            NuxtLink.footer-link(:to="$localePath('/compare')" prefetch) {{ $t('nav.compare') }}
          li
            NuxtLink.footer-link(:to="$localePath('/cart')" prefetch) {{ $t('nav.cart') }}

      //- Контакты (актуальные — из админки, фолбэк — дефолты shared)
      div
        h3.footer-heading {{ $t('footer.contacts') }}
        ul.space-y-2.text-sm
          li
            a.footer-link(:href="`tel:${phoneHref}`") {{ contacts.phone }}
          li
            a.footer-link(:href="`mailto:${contacts.email}`") {{ contacts.email }}
          li(class="text-base-content/65") {{ $t('footer.workingHours') }}: {{ contacts.hoursWeek }}

    .footer-bottom.mt-8.pt-6.border-t.border-base-300.flex.items-center.justify-between.text-sm(class="text-base-content/55")
      span © {{ year }} {{ $t('nav.brand') }}. {{ $t('footer.rights') }}
      NuxtLink.footer-link(:to="$localePath('/auth/login')" prefetch) {{ $t('nav.login') }}
</template>

<script setup>
import {
  DEFAULT_SITE_CONTENT,
  normalizePhoneHref,
} from '#shared/siteContent'

const { data: contentResp } = await useAsyncData(
  'site-content-footer',
  () => $fetch('/api/content').catch(() => null),
  { default: () => null },
)

const content = computed(() => contentResp.value?.content ?? DEFAULT_SITE_CONTENT)
const contacts = computed(() => content.value.contacts)

// Тот же href, что на странице «Контакты» (normalizePhoneHref из shared)
const phoneHref = computed(() => normalizePhoneHref(contacts.value.phone))

const year = new Date().getFullYear()
</script>

<style scoped>
.footer-heading {
  font-weight: 600;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-base-content);
  opacity: 0.75;
}

.footer-link {
  color: var(--color-base-content);
  opacity: 0.7;
  transition:
    opacity 0.15s ease,
    color 0.15s ease;
}

@media (hover: hover) {
  .footer-link:hover {
    color: var(--color-primary);
    opacity: 1;
  }
}
</style>
