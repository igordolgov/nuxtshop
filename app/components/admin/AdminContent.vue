<!-- ~/components/admin/AdminContent.vue — редактор контента сайта.
     «Контакты» и «О магазине»: телефон/почта/режим, мессенджеры,
     магазины, FAQ, цифры и история. Данные в KV (data:content) через
     /api/content (GET публичный, PUT только админ). Витрины —
     /contacts и /about читают тот же контент с фолбэком на дефолты. -->
<template lang="pug">
.admin-content
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content Контент сайта
      p.text-sm(class="mt-0.5 text-base-content/60")
        | {{ isLoading ? 'Загрузка…' : lastSavedLabel }}

    .flex.gap-2
      button.btn.btn-ghost.btn-sm.rounded-xl(
        type="button"
        :disabled="isLoading || saving"
        aria-label="Перечитать с сервера"
        @click="load"
      )
        svg.w-4.h-4(:class="{ 'animate-spin': isLoading }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")
      button.btn.btn-primary.btn-sm.rounded-xl(type="button" :disabled="isLoading || saving" @click="save")
        span.loading.loading-spinner.loading-xs(v-if="saving")
        | Сохранить

  //- Скелетон / ошибка
  .space-y-3(v-if="isLoading && !loaded")
    .skeleton.h-24.rounded-2xl(v-for="i in 3" :key="i")
  .text-center.py-12(v-else-if="loadError")
    p(class="text-base-content/50 mb-4") Не удалось загрузить контент
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") Повторить

  form(v-else @submit.prevent="save" novalidate)
    //- ─── Контакты ──────────────────────────────────────────────────────
    section.editor-card
      h3.card-title Связь
      .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
        label.block
          span.form-label Телефон
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="form.contacts.phone" :maxlength="LIMITS.phone" placeholder="8 (800) 555-35-35")
          p.field-hint tel:-ссылка на витрине: {{ telHref || '—' }}
        label.block
          span.form-label Email
          input.input.input-bordered.rounded-xl.w-full(type="email" v-model.trim="form.contacts.email" :maxlength="LIMITS.email" placeholder="support@shop.ru")
        label.block
          span.form-label Режим — будни
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="form.contacts.hoursWeek" :maxlength="LIMITS.hours" placeholder="9:00–20:00")
        label.block
          span.form-label Режим — выходные
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="form.contacts.hoursWeekend" :maxlength="LIMITS.hours" placeholder="10:00–18:00")
      label.block.mt-3
        span.form-label Карта (OpenStreetMap)
        input.input.input-bordered.rounded-xl.w-full(type="url" v-model.trim="form.contacts.mapSrc" :maxlength="LIMITS.mapSrc" placeholder="https://www.openstreetmap.org/export/embed.html?…")
        p.field-hint
          | С openstreetmap.org: «Экспорт» → «Поделиться картой» → скопировать src ифрейма. Пусто — карта по умолчанию.

    //- ─── Мессенджеры ───────────────────────────────────────────────────
    section.editor-card
      .flex.items-center.justify-between.gap-2.mb-3
        h3.card-title Мессенджеры
        span.counter {{ form.contacts.messengers.length }} из {{ LIMITS.messengers }}
      .list-row(v-for="(m, i) in form.contacts.messengers" :key="`msgr-${i}`")
        label.block.flex-1.min-w-0
          span.form-label Название
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="m.name" :maxlength="LIMITS.messengerName" placeholder="Telegram")
        label.block.flex-1.min-w-0
          span.form-label Ник или ссылка
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="m.handle" :maxlength="LIMITS.messengerHandle" placeholder="@shop")
        button.row-remove(type="button" :aria-label="`Убрать мессенджер ${m.name || i + 1}`" @click="form.contacts.messengers.splice(i, 1)") ✕
      button.btn.btn-outline.btn-sm.rounded-xl.mt-2(
        type="button"
        :disabled="form.contacts.messengers.length >= LIMITS.messengers"
        @click="addMessenger"
      ) + Добавить мессенджер

    //- ─── Магазины ──────────────────────────────────────────────────────
    section.editor-card
      .flex.items-center.justify-between.gap-2.mb-3
        h3.card-title Магазины и пункты выдачи
        span.counter {{ form.contacts.stores.length }} из {{ LIMITS.stores }}
      .store-block(v-for="(s, i) in form.contacts.stores" :key="`store-${i}`")
        .list-row
          label.block.flex-1.min-w-0
            span.form-label Город
            input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="s.city" :maxlength="LIMITS.city" placeholder="Москва")
          label.block.flex-1.min-w-0
            span.form-label Бейдж
            input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="s.badge" :maxlength="LIMITS.badge" placeholder="Флагман")
          button.row-remove(type="button" :aria-label="`Убрать магазин ${s.city || i + 1}`" @click="form.contacts.stores.splice(i, 1)") ✕
        .list-row.mt-2
          label.block.flex-1.min-w-0
            span.form-label Адрес
            input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="s.address" :maxlength="LIMITS.address" placeholder="ул. Тверская, 12")
          label.block.flex-1.min-w-0
            span.form-label Часы
            input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="s.hours" :maxlength="LIMITS.storeHours" placeholder="Ежедневно 10:00–21:00")
          label.block.flex-1.min-w-0
            span.form-label Телефон
            input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="s.phone" :maxlength="LIMITS.storePhone" placeholder="8 (495) …")
      button.btn.btn-outline.btn-sm.rounded-xl.mt-2(
        type="button"
        :disabled="form.contacts.stores.length >= LIMITS.stores"
        @click="addStore"
      ) + Добавить магазин

    //- ─── FAQ ───────────────────────────────────────────────────────────
    section.editor-card
      .flex.items-center.justify-between.gap-2.mb-3
        h3.card-title Частые вопросы (страница «Контакты»)
        span.counter {{ form.contacts.faq.length }} из {{ LIMITS.faq }}
      .faq-block(v-for="(f, i) in form.contacts.faq" :key="`faq-${i}`")
        .list-row
          label.block.flex-1.min-w-0
            span.form-label Вопрос {{ i + 1 }}
            input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="f.q" :maxlength="LIMITS.faqQ" placeholder="Как быстро вы доставляете?")
          button.row-remove(type="button" :aria-label="`Убрать вопрос ${i + 1}`" @click="form.contacts.faq.splice(i, 1)") ✕
        label.block.mt-2
          span.form-label Ответ
          textarea.textarea.textarea-bordered.rounded-xl.w-full.leading-relaxed(v-model="f.a" rows="3" :maxlength="LIMITS.faqA")
      button.btn.btn-outline.btn-sm.rounded-xl.mt-2(
        type="button"
        :disabled="form.contacts.faq.length >= LIMITS.faq"
        @click="addFaq"
      ) + Добавить вопрос

    //- ─── О магазине: цифры ─────────────────────────────────────────────
    section.editor-card
      .flex.items-center.justify-between.gap-2.mb-3
        h3.card-title «О магазине» — цифры
        span.counter {{ form.about.stats.length }} из {{ LIMITS.stats }}
      .list-row(v-for="(st, i) in form.about.stats" :key="`stat-${i}`")
        label.block.w-36.flex-shrink-0
          span.form-label Значение
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="st.value" :maxlength="LIMITS.statValue" placeholder="8 лет")
        label.block.flex-1.min-w-0
          span.form-label Подпись
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="st.label" :maxlength="LIMITS.statLabel" placeholder="на рынке техники")
        button.row-remove(type="button" :aria-label="`Убрать цифру ${i + 1}`" @click="form.about.stats.splice(i, 1)") ✕
      button.btn.btn-outline.btn-sm.rounded-xl.mt-2(
        type="button"
        :disabled="form.about.stats.length >= LIMITS.stats"
        @click="addStat"
      ) + Добавить цифру

    //- ─── О магазине: история ───────────────────────────────────────────
    section.editor-card
      .flex.items-center.justify-between.gap-2.mb-3
        h3.card-title «О магазине» — история
        span.counter {{ form.about.history.length }} из {{ LIMITS.history }}
      .list-row(v-for="(h, i) in form.about.history" :key="`hist-${i}`")
        label.block.w-28.flex-shrink-0
          span.form-label Год
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="h.year" :maxlength="LIMITS.year" placeholder="2026")
        label.block.flex-1.min-w-0
          span.form-label Событие
          input.input.input-bordered.rounded-xl.w-full(type="text" v-model.trim="h.text" :maxlength="LIMITS.historyText" placeholder="Открыли первый магазин…")
        button.row-remove(type="button" :aria-label="`Убрать событие ${i + 1}`" @click="form.about.history.splice(i, 1)") ✕
      button.btn.btn-outline.btn-sm.rounded-xl.mt-2(
        type="button"
        :disabled="form.about.history.length >= LIMITS.history"
        @click="addHistory"
      ) + Добавить событие

    //- ─── Низ формы ─────────────────────────────────────────────────────
    p.form-error(v-if="formError" role="alert") {{ formError }}
    .flex.gap-2.justify-end.flex-wrap.mt-4
      button.btn.rounded-xl(type="button" :disabled="saving" @click="load") Отменить правки
      button.btn.btn-primary.rounded-xl(type="submit" :disabled="saving")
        span.loading.loading-spinner.loading-xs(v-if="saving")
        | Сохранить контент
    p.text-xs(class="mt-2 text-base-content/50")
      | Изменения появляются на /contacts и /about сразу после сохранения (страницы читают /api/content).
</template>

<script setup>
import { CONTENT_LIMITS, normalizePhoneHref } from '#shared/siteContent'

const { $notify } = useNuxtApp()

const LIMITS = CONTENT_LIMITS

const isLoading = ref(false)
const loaded = ref(false)
const loadError = ref(false)
const saving = ref(false)
const formError = ref('')

const blankForm = () => ({
  contacts: {
    phone: '',
    email: '',
    hoursWeek: '',
    hoursWeekend: '',
    mapSrc: '',
    messengers: [],
    stores: [],
    faq: [],
  },
  about: { stats: [], history: [] },
  updatedAt: '',
})

const form = reactive(blankForm())

const telHref = computed(() =>
  form.contacts.phone ? normalizePhoneHref(form.contacts.phone) : '',
)

const lastSavedLabel = computed(() => {
  if (!form.updatedAt) return 'Сохранённых правок нет — показываются дефолты'
  const d = new Date(form.updatedAt)
  const when = Number.isNaN(d.getTime())
    ? form.updatedAt
    : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return `Сохранено: ${when}`
})

const applyContent = (content) => {
  const c = content?.contacts ?? {}
  const a = content?.about ?? {}
  form.contacts.phone = c.phone ?? ''
  form.contacts.email = c.email ?? ''
  form.contacts.hoursWeek = c.hoursWeek ?? ''
  form.contacts.hoursWeekend = c.hoursWeekend ?? ''
  form.contacts.mapSrc = c.mapSrc ?? ''
  form.contacts.messengers = (c.messengers ?? []).map((m) => ({ name: m.name, handle: m.handle }))
  form.contacts.stores = (c.stores ?? []).map((s) => ({
    city: s.city, badge: s.badge, address: s.address, hours: s.hours, phone: s.phone,
  }))
  form.contacts.faq = (c.faq ?? []).map((f) => ({ q: f.q, a: f.a }))
  form.about.stats = (a.stats ?? []).map((s) => ({ value: s.value, label: s.label }))
  form.about.history = (a.history ?? []).map((h) => ({ year: h.year, text: h.text }))
  form.updatedAt = content?.updatedAt ?? ''
}

const load = async () => {
  if (saving.value) return
  isLoading.value = true
  loadError.value = false
  formError.value = ''
  try {
    const resp = await $fetch('/api/content')
    applyContent(resp?.content)
    loaded.value = true
  } catch {
    loadError.value = true
    $notify.error('Не удалось загрузить контент')
  } finally {
    isLoading.value = false
  }
}

/* ─── Добавление в списки (с лимитами) ─────────────────────────────── */
const addMessenger = () => {
  if (form.contacts.messengers.length >= LIMITS.messengers) return
  form.contacts.messengers.push({ name: '', handle: '' })
}
const addStore = () => {
  if (form.contacts.stores.length >= LIMITS.stores) return
  form.contacts.stores.push({ city: '', badge: '', address: '', hours: '', phone: '' })
}
const addFaq = () => {
  if (form.contacts.faq.length >= LIMITS.faq) return
  form.contacts.faq.push({ q: '', a: '' })
}
const addStat = () => {
  if (form.about.stats.length >= LIMITS.stats) return
  form.about.stats.push({ value: '', label: '' })
}
const addHistory = () => {
  if (form.about.history.length >= LIMITS.history) return
  form.about.history.push({ year: '', text: '' })
}

const save = async () => {
  formError.value = ''
  saving.value = true
  try {
    const resp = await $fetch('/api/content', { method: 'PUT', body: form })
    applyContent(resp?.content)
    $notify.success(resp?.message || 'Контент сохранён')
    // Витрины держат этот же ключ useAsyncData — обновим, чтобы клиентский
    // переход на /contacts или /about увидел свежий контент без F5.
    refreshNuxtData('site-content').catch(() => {})
  } catch (error) {
    const message = error?.data?.message || error?.message || 'Не удалось сохранить контент'
    formError.value = message
    $notify.error(message)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.editor-card {
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  background: var(--color-base-100);
  padding: 1rem 1.125rem;
  margin-bottom: 0.875rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-base-content);
  margin-bottom: 0.75rem;
}

.counter {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--color-base-content);
  opacity: 0.55;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-base-content);
  margin-bottom: 0.375rem;
}

.field-hint {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-base-content);
  opacity: 0.55;
}

.list-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.store-block,
.faq-block {
  padding: 0.625rem;
  border: 1px dashed var(--color-base-300);
  border-radius: 0.75rem;
  margin-bottom: 0.5rem;
}

.row-remove {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  margin-top: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid var(--color-base-300);
  background: transparent;
  color: var(--color-base-content);
  opacity: 0.55;
  cursor: pointer;
  font-size: 0.75rem;
}

.row-remove:hover {
  background: color-mix(in oklab, var(--color-error) 15%, transparent);
  border-color: var(--color-error);
  color: var(--color-error);
  opacity: 1;
}

.form-error {
  margin-top: 0.875rem;
  font-size: 0.875rem;
  color: var(--color-error);
}
</style>
