<!-- app/components/products/ProductReviews.vue — отзывы на карточке товара.
     Данные приходят с /api/product/[slug] (approved-отзывы + summary).
     Отправка: POST /api/reviews → уходит на модерацию (approved:false),
     на витрине появится после публикации в /admin/reviews. -->
<template lang="pug">
.product-reviews.px-2.pb-15(class="lg:pb-3 lg:mt-2")
  .container.mx-auto.px-2(class="lg:px-4")
    .flex.items-center.justify-between.gap-2.flex-wrap.mb-2
      .flex.items-center.gap-2.flex-wrap
        h2.text-xl.font-semibold(class="lg:text-2xl") Отзывы
        //- Сводка: средняя оценка и количество
        .flex.items-center.gap-1.text-sm(v-if="summary.count > 0")
          span.text-warning ★
          span.font-medium {{ formatAverage }}
          span(class="text-base-content/50") · {{ countLabel }}

      button.btn.btn-outline.btn-sm.rounded-xl(
        type="button"
        @click="toggleForm"
      ) {{ showForm ? 'Отмена' : 'Написать отзыв' }}

    //- Форма отправки (скрытое поле website — honeypot для ботов)
    form.review-form.card.bg-base-100.shadow-sm.mb-4(
      v-if="showForm"
      @submit.prevent="submit"
      novalidate
    )
      .card-body.p-4.gap-3
        div
          span.review-label Ваша оценка
          .flex.gap-1
            button.star-btn(type="button" v-for="i in 5" :key="i" :aria-label="`Оценка ${i}`" @click="form.rating = i")
              svg.w-7.h-7(:class="i <= form.rating ? 'fill-warning text-warning' : 'fill-none text-base-content/40'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5")
                path(stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z")
        label.block
          span.review-label Имя
          input.input.input-bordered.rounded-xl.w-full(
            type="text"
            v-model.trim="form.author"
            placeholder="Как вас зовут?"
            maxlength="40"
          )
        label.block
          span.review-label Отзыв
          textarea.textarea.textarea-bordered.w-full.leading-relaxed(
            v-model.trim="form.text"
            rows="4"
            placeholder="Что понравилось, что нет — от 10 до 600 символов"
            maxlength="600"
          )
          span.text-xs(class="mt-1 inline-block text-base-content/50") {{ (form.text || '').length }}/600
        //- Honeypot: обычному покупателю не виден
        input.hidden(type="text" tabindex="-1" autocomplete="off" v-model="form.website" aria-hidden="true")
        p.form-error(v-if="formError" role="alert") {{ formError }}
        .flex.justify-end
          button.btn.btn-primary.btn-sm.rounded-xl(type="submit" :disabled="sending")
            span.loading.loading-spinner.loading-xs(v-if="sending")
            | Отправить на модерацию

    //- Список отзывов
    .space-y-3(v-if="reviews.length > 0")
      .review-card.card.bg-base-100.shadow-sm(v-for="r in reviews" :key="r.id")
        .card-body.p-4(class="gap-1.5")
          .flex.items-center.gap-2.flex-wrap
            .flex(class="gap-0.5")
              svg.w-4.h-4(v-for="i in 5" :key="i" :class="i <= r.rating ? 'fill-warning text-warning' : 'fill-none text-base-content/30'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5")
                path(stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z")
            span.font-medium.text-sm {{ r.author }}
            span.text-xs.ml-auto(class="text-base-content/50") {{ formatDate(r.createdAt) }}
          p.text-sm.leading-relaxed(class="text-base-content/85") {{ r.text }}

    //- Пусто: приглашение
    .text-center.py-6(v-else)
      p(class="text-base-content/50 text-sm mb-3") Пока нет отзывов — станьте первым!

  //- Тост «появится после модерации» показывается через $notify
</template>

<script setup>
import { formatNewsDate } from '~/utils/news'

const props = defineProps({
  productId: { type: [String, Number], required: true },
  reviews: { type: Array, default: () => [] },
  summary: {
    type: Object,
    default: () => ({ count: 0, average: 0 }),
  },
})

const { $notify } = useNuxtApp()

const formatAverage = computed(() => String(props.summary.average ?? 0).replace('.', ','))

// 1 отзыв / 2 отзыва / 5 отзывов
const countLabel = computed(() => {
  const n = props.summary.count ?? 0
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} отзыв`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} отзыва`
  return `${n} отзывов`
})

const formatDate = (iso) => formatNewsDate(iso)

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
    formError.value = 'Укажите имя (от 2 символов)'
    return
  }
  if (form.text.trim().length < 10) {
    formError.value = 'Расскажите чуть подробнее — от 10 символов'
    return
  }
  sending.value = true
  try {
    const resp = await $fetch('/api/reviews', {
      method: 'POST',
      body: {
        productId: String(props.productId),
        author: form.author,
        rating: form.rating,
        text: form.text,
        website: form.website,
      },
    })
    $notify.success(resp?.message || 'Спасибо! Отзыв появится после модерации')
    showForm.value = false
    form.author = ''
    form.rating = 5
    form.text = ''
    form.website = ''
  } catch (error) {
    const message = error?.data?.message || error?.message || 'Не удалось отправить отзыв'
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

/* Звёзды-кнопки оценки: без рамок, крупная зона нажатия (палец) */
.star-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  line-height: 0;
}
</style>
