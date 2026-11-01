<!-- app/pages/contacts.vue — страница «Контакты».
     Витрина связи в стиле крупных маркетплейсов: карточки контактов
     с копированием в один тап, оффлайн-точки, карта (OpenStreetMap,
     без API-ключей), форма обратной связи (сбор письма в почтовый
     клиент через mailto — честная работа без бэкенда) и FAQ.
     Контент статический (SSR-friendly). -->
<template lang="pug">
.contacts-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.flex.flex-col.max-w-7xl.w-full.mx-auto.px-3.py-4(class="lg:px-6 lg:py-8")
    //- Хлебные крошки
    nav.breadcrumbs.text-sm.mb-3(:aria-label="$t('catalog.breadcrumbs')")
      ul
        li
          NuxtLink(class="text-base-content/60 hover:text-primary" to="/" prefetch) {{ $t('nav.home') }}
        li {{ $t('nav.contacts') }}

    //- Заголовок
    .mb-5(class="lg:mb-8")
      h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") {{ $t('nav.contacts') }}
      p.text-sm.mt-1(class="text-base-content/50 lg:text-base")
        | {{ $t('contacts.subtitle') }}

    //- Карточки связи
    .grid.grid-cols-1.gap-4.mb-8(class="sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:mb-12")
      .contact-card
        .contact-icon(v-html="icons.phone")
        h3.contact-title {{ $t('contacts.phone') }}
        a.contact-value(:href="`tel:${phoneHref}`") {{ contacts.phone }}
        p.contact-note {{ $t('contacts.daily', { hours: contacts.hoursWeek }) }}
        button.copy-btn(type="button" @click="copy('phone')") {{ copied === 'phone' ? $t('contacts.copied') : $t('contacts.copy') }}

      .contact-card
        .contact-icon(v-html="icons.mail")
        h3.contact-title {{ $t('contacts.email') }}
        a.contact-value(:href="`mailto:${contacts.email}`") {{ contacts.email }}
        p.contact-note {{ $t('contacts.replyDay') }}
        button.copy-btn(type="button" @click="copy('email')") {{ copied === 'email' ? $t('contacts.copied') : $t('contacts.copy') }}

      .contact-card
        .contact-icon(v-html="icons.clock")
        h3.contact-title {{ $t('contacts.hours') }}
        .contact-note.text-left.mt-2
          .flex.justify-between.gap-4
            span {{ $t('contacts.weekdays') }}
            span {{ contacts.hoursWeek }}
          .flex.justify-between.gap-4.mt-1
            span {{ $t('contacts.weekend') }}
            span {{ contacts.hoursWeekend }}

      .contact-card
        .contact-icon(v-html="icons.chat")
        h3.contact-title {{ $t('contacts.messengers') }}
        p.contact-note.mb-2 {{ $t('contacts.reply15') }}
        .flex.flex-col.gap-2
          button.messenger-btn(type="button" v-for="m in messengers" :key="m.name" @click="copy(m.name)")
            span {{ m.name }}
            span.messenger-handle {{ m.handle }}

    //- Оффлайн-точки
    section.mb-8(class="lg:mb-12")
      h2.section-title {{ $t('contacts.stores') }}
      p.section-sub {{ $t('contacts.storesSub') }}
      .stores-grid
        .store-card(v-for="store in stores" :key="store.city")
          .flex.items-center.justify-between.gap-2.flex-wrap
            h3.font-semibold.text-base-content {{ store.city }}
            span.store-badge {{ store.badge }}
          p.text-sm.mt-2(class="text-base-content/70") {{ store.address }}
          .text-sm.mt-1(class="text-base-content/50") {{ store.hours }}
          a.text-sm.text-primary.font-medium.mt-2.inline-block(:href="`tel:${store.phoneHref}`") {{ store.phone }}

      //- Карта (OpenStreetMap, без API-ключа; ленивый iframe).
      //- Ссылка — редактируемая (админка → Контент), по умолчанию — Москва.
      .map-wrap.mt-4(class="lg:mt-6")
        iframe.map-frame(
          :src="mapSrc"
          :title="$t('contacts.mapTitle')"
          loading="lazy"
        )

    //- Форма обратной связи
    section.mb-8(class="lg:mb-12")
      h2.section-title {{ $t('contacts.writeUs') }}
      p.section-sub {{ $t('contacts.formSub') }}
      .form-wrap
        form(@submit.prevent="submitForm" novalidate)
          .form-grid
            label.form-field
              span.form-label {{ $t('auth.name') }}
              input.input.input-bordered.rounded-xl(
                type="text"
                v-model.trim="form.name"
                :placeholder="$t('contacts.namePh')"
                maxlength="60"
              )
            label.form-field
              span.form-label Email
              input.input.input-bordered.rounded-xl(
                type="email"
                v-model.trim="form.email"
                placeholder="for-reply@example.ru"
                maxlength="80"
              )
          label.form-field.block.mt-3
            span.form-label {{ $t('contacts.topic') }}
            select.select.select-bordered.rounded-xl.w-full(v-model="form.topic")
              option(value="Вопрос по заказу") {{ $t('contacts.topicOrder') }}
              option(value="Гарантия и сервис") {{ $t('contacts.topicWarranty') }}
              option(value="Возврат") {{ $t('contacts.topicReturn') }}
              option(value="Сотрудничество") {{ $t('contacts.topicCoop') }}
              option(value="Другое") {{ $t('contacts.topicOther') }}
          label.form-field.block.mt-3
            span.form-label {{ $t('reviews.review') }}
            textarea.textarea.textarea-bordered.rounded-xl.w-full(
              v-model.trim="form.message"
              rows="4"
              :placeholder="$t('contacts.messagePh')"
              maxlength="2000"
            )
          .form-error(v-if="formError" role="alert") {{ formError }}
          .flex.items-center.gap-4.mt-4.flex-wrap
            button.btn.btn-primary.rounded-xl(type="submit") {{ $t('contacts.send') }}
            p.text-xs(class="text-base-content/60")
              | {{ $t('contacts.privacyNote') }}

    //- FAQ
    section(class="pb-2")
      h2.section-title {{ $t('contacts.faq') }}
      .faq-list
        details.collapse.collapse-arrow.faq-item(v-for="faq in faq" :key="faq.q")
          summary.collapse-title.text-base.font-medium {{ faq.q }}
          .collapse-content
            p.text-sm.leading-relaxed(class="text-base-content/70") {{ faq.a }}

  MobileNavFooter
</template>

<script setup>
const { isMobile } = useMobileDetection()
const { t } = useI18n()

/* ─── Контент из KV через /api/content (админка → «Контент») ──
   Дефолты — shared/siteContent (те же значения, что раньше были
   захардкожены здесь). Сбой /api/content не роняет страницу: ── */
import { DEFAULT_SITE_CONTENT, normalizePhoneHref } from '#shared/siteContent'

const { data: contentResp } = await useAsyncData(
  'site-content',
  () => $fetch('/api/content').catch(() => null),
  { default: () => null },
)

const content = computed(() => contentResp.value?.content ?? DEFAULT_SITE_CONTENT)
const contacts = computed(() => content.value.contacts)
const messengers = computed(() => contacts.value.messengers)
const faq = computed(() => contacts.value.faq)
const mapSrc = computed(() => contacts.value.mapSrc || DEFAULT_SITE_CONTENT.contacts.mapSrc)
const phoneHref = computed(() => normalizePhoneHref(contacts.value.phone))

/* Магазины: href tel:-ссылки выводится из редактируемого телефона */
const stores = computed(() =>
  contacts.value.stores.map((s) => ({ ...s, phoneHref: normalizePhoneHref(s.phone) })),
)

/* ─── Копирование в буфер (с фолбэком для http/старых браузеров) ── */
const copied = ref(null)
let copyTimer = null

const copy = async (key) => {
  const value =
    key === 'phone' ? contacts.value.phone
    : key === 'email' ? contacts.value.email
    : (messengers.value.find((m) => m.name === key)?.handle ?? '')

  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  copied.value = key
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = null), 2000)
}

/* ─── Форма: валидация + сбор письма в почтовый клиент (mailto) ── */
const form = reactive({ name: '', email: '', topic: 'Вопрос по заказу', message: '' })
const formError = ref('')

const submitForm = () => {
  if (!form.name || form.name.length < 2) {
    formError.value = t('contacts.errName')
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    formError.value = t('contacts.errEmail')
    return
  }
  if (!form.message || form.message.length < 10) {
    formError.value = t('contacts.errMessage')
    return
  }

  formError.value = ''
  const subject = encodeURIComponent(`${form.topic} — форма с сайта`)
  const body = encodeURIComponent(
    `Имя: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
  )
  window.location.href = `mailto:${contacts.value.email}?subject=${subject}&body=${body}`
}

/* ─── Иконки карточек (inline SVG, без ассетов) ───────────── */
const iconWrap = (paths) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const icons = {
  phone: iconWrap('<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.13.96.36 1.9.7 2.8a2 2 0 01-.45 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0122 16.9z"/>'),
  mail: iconWrap('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>'),
  clock: iconWrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  chat: iconWrap('<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/>'),
}

useHead(() => ({ title: t('nav.contacts') }))
useSeoMeta({
  title: () => t('nav.contacts'),
  // Реактивно: описание подхватывает телефон/адреса из редактируемого контента
  description: () =>
    () =>
      t('contacts.metaDescription', {
        phone: contacts.value.phone,
        cities: stores.value.length ? ` (${stores.value.map((s) => s.city).join(', ')})` : '',
      }),
})
</script>

<style scoped>
.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-base-content);
  margin-bottom: 0.375rem;
}

@media (min-width: 1024px) {
  .section-title {
    font-size: 1.5rem;
  }
}

.section-sub {
  font-size: 0.875rem;
  color: var(--color-base-content);
  opacity: 0.55;
  margin-bottom: 1.25rem;
}

/* ─── Карточки контактов ──────────────────────────────────── */
.contact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  padding: 1.5rem 1.25rem;
  background: var(--color-base-100);
  height: 100%;
}

.contact-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.875rem;
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.contact-title {
  font-weight: 600;
  color: var(--color-base-content);
}

.contact-value {
  margin-top: 0.375rem;
  font-weight: 600;
  color: var(--color-primary);
  font-size: 1.0625rem;
}

.contact-note {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: var(--color-base-content);
  opacity: 0.55;
  width: 100%;
}

.copy-btn {
  margin-top: 0.875rem;
  padding: 0.3125rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid var(--color-base-300);
  background: transparent;
  color: var(--color-base-content);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

@media (hover: hover) {
  .copy-btn:hover {
    border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
    color: var(--color-primary);
  }
}

.messenger-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--color-base-300);
  border-radius: 0.75rem;
  background: transparent;
  font-size: 0.875rem;
  color: var(--color-base-content);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

@media (hover: hover) {
  .messenger-btn:hover {
    border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
  }
}

.messenger-handle {
  color: var(--color-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── Магазины и карта ────────────────────────────────────── */
.stores-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .stores-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.store-card {
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  padding: 1.25rem;
  background: var(--color-base-100);
  height: 100%;
}

.store-badge {
  display: inline-flex;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: color-mix(in oklab, var(--color-success) 14%, transparent);
  color: var(--color-success);
}

.map-wrap {
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  overflow: hidden;
  background: var(--color-base-200);
}

.map-frame {
  display: block;
  width: 100%;
  height: 320px;
  border: 0;
}

@media (min-width: 1024px) {
  .map-frame {
    height: 400px;
  }
}

/* ─── Форма ───────────────────────────────────────────────── */
.form-wrap {
  border: 1px solid var(--color-base-300);
  border-radius: 1.25rem;
  padding: 1.5rem;
  background: var(--color-base-100);
}

@media (min-width: 1024px) {
  .form-wrap {
    padding: 2rem;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.875rem;
}

@media (min-width: 640px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-base-content);
  margin-bottom: 0.375rem;
}

.form-error {
  margin-top: 0.875rem;
  font-size: 0.875rem;
  color: var(--color-error);
}

/* ─── FAQ ─────────────────────────────────────────────────── */
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.faq-item {
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  background: var(--color-base-100);
}
</style>
