<!-- app/components/store/StoreReviews.vue — отзывы о магазине на /about.
     Данные приходят с /api/store-reviews (approved + summary), SSR-friendly.
     Отправка: POST /api/store-reviews → модерация в /admin/reviews
     (вкладка «О магазине»). Паттерн ProductReviews, но без товара и фото. -->
<template lang="pug">
.store-reviews
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-3
    .flex.items-center.gap-2.flex-wrap
      h2.text-xl.font-semibold(class="lg:text-2xl") {{ $t('storeReviews.title') }}
      //- Сводка: средняя оценка и количество
      .flex.items-center.gap-1.text-sm(v-if="summary.count > 0")
        span.text-warning ★
        span.font-medium {{ formatAverage }}
        span(class="text-base-content/50") · {{ countLabel }}

    button.btn.btn-outline.btn-sm.rounded-xl(type="button" @click="toggleForm")
      | {{ showForm ? $t('reviews.cancel') : $t('storeReviews.write') }}

  //- Форма (скрытое поле website — honeypot для ботов)
  form.store-review-form.card.bg-base-100.shadow-sm.mb-4(
    v-if="showForm"
    @submit.prevent="submit"
    novalidate
  )
    .card-body.p-4.gap-3
      div
        span.review-label {{ $t('reviews.yourRating') }}
        .flex.gap-1
          button.star-btn(type="button" v-for="i in 5" :key="i" :aria-label="$t('reviews.rateN', { n: i })" @click="form.rating = i")
            svg.w-7.h-7(:class="i <= form.rating ? 'fill-warning text-warning' : 'fill-none text-base-content/40'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5")
              path(stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z")
      label.block
        span.review-label {{ $t('reviews.name') }}
        input.input.input-bordered.rounded-xl.w-full(
          type="text"
          v-model.trim="form.author"
          :placeholder="$t('reviews.namePlaceholder')"
          maxlength="40"
        )
      label.block
        span.review-label {{ $t('reviews.review') }}
        textarea.textarea.textarea-bordered.w-full.leading-relaxed(
          v-model.trim="form.text"
          rows="4"
          :placeholder="$t('reviews.reviewPlaceholder')"
          maxlength="600"
        )
        span.text-xs(class="mt-1 inline-block text-base-content/50") {{ (form.text || '').length }}/600
      //- Honeypot: обычному покупателю не виден
      input.hidden(type="text" tabindex="-1" autocomplete="off" v-model="form.website" aria-hidden="true")
      p.form-error(v-if="formError" role="alert") {{ formError }}
      .flex.justify-end
        button.btn.btn-primary.btn-sm.rounded-xl(type="submit" :disabled="sending")
          span.loading.loading-spinner.loading-xs(v-if="sending")
          | {{ $t('reviews.submit') }}

  //- Список одобренных отзывов
  .grid.gap-3(class="sm:grid-cols-2 lg:grid-cols-3" v-if="reviews.length > 0")
    .review-card.card.bg-base-100.shadow-sm(v-for="r in reviews" :key="r.id")
      .card-body.p-4(class="gap-1.5")
        .flex.items-center.gap-2.flex-wrap
          .flex(class="gap-0.5")
            svg.w-4.h-4(v-for="i in 5" :key="i" :class="i <= r.rating ? 'fill-warning text-warning' : 'fill-none text-base-content/30'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5")
              path(stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z")
          span.font-medium.text-sm {{ r.author }}
        p.text-sm.leading-relaxed(class="text-base-content/85") {{ r.text }}
        span.text-xs(class="text-base-content/50") {{ formatDate(r.createdAt) }}

  //- Пусто: приглашение
  .text-center.py-6(v-else)
    p(class="text-base-content/50 text-sm mb-3") {{ $t('storeReviews.empty') }}
</template>

<script setup>
import { formatNewsDate } from '~/utils/news'

const { t, locale } = useI18n()

const props = defineProps({
  reviews: { type: Array, default: () => [] },
  summary: { type: Object, default: () => ({ count: 0, average: 0 }) },
})

const { $notify } = useNuxtApp()

const formatAverage = computed(() =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(
    props.summary.average ?? 0,
  ),
)
const countLabel = computed(() => t('reviews.count', props.summary.count ?? 0))
const formatDate = (iso) => formatNewsDate(iso, locale.value)

// ─── Форма ───────────────────────────────────────────────────────────────
const showForm = ref(false)
const sending = ref(false)
const formError = ref('')
const form = reactive({ author: '', rating: 5, text: '', website: '' })

const toggleForm = () => {
  showForm.value = !showForm.value
  formError.value = ''
}

const submit = async () => {
  formError.value = ''
  if (form.author.trim().length < 2) {
    formError.value = t('reviews.errName')
    return
  }
  if (form.text.trim().length < 10) {
    formError.value = t('reviews.errShort')
    return
  }
  sending.value = true
  try {
    const resp = await $fetch('/api/store-reviews', {
      method: 'POST',
      body: {
        author: form.author,
        rating: form.rating,
        text: form.text,
        website: form.website,
      },
    })
    $notify.success(resp?.message || t('reviews.moderationThanks'))
    showForm.value = false
    form.author = ''
    form.rating = 5
    form.text = ''
    form.website = ''
  } catch (error) {
    const message = error?.data?.message || error?.message || t('reviews.sendError')
    formError.value = message
    $notify.error(message)
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.review-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-base-content);
  margin-bottom: 0.375rem;
}

.form-error {
  font-size: 0.875rem;
  color: var(--color-error);
}

.star-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  line-height: 0;
}
</style>
