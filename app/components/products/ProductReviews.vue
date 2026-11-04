<!-- app/components/products/ProductReviews.vue — отзывы на карточке товара.
     Данные приходят с /api/product/[slug] (approved-отзывы + summary).
     Отправка: POST /api/reviews → уходит на модерацию (approved:false),
     на витрине появится после публикации в /admin/reviews. -->
<template lang="pug">
//- id="reviews": якорь для ссылки-сводки рейтинга из ProductInfo
.product-reviews.px-2.pb-15(class="lg:pb-3 lg:mt-2", id="reviews")
  .container.mx-auto.px-2(class="lg:px-4")
    .flex.items-center.justify-between.gap-2.flex-wrap.mb-2
      .flex.items-center.gap-2.flex-wrap
        h2.text-xl.font-semibold(class="lg:text-2xl") {{ $t('reviews.title') }}
        //- Сводка: средняя оценка и количество
        .flex.items-center.gap-1.text-sm(v-if="summary.count > 0")
          span.text-warning ★
          span.font-medium {{ formatAverage }}
          span(class="text-base-content/50") · {{ countLabel }}

      button.btn.btn-outline.btn-sm.rounded-xl(
        type="button"
        @click="toggleForm"
      ) {{ showForm ? $t('reviews.cancel') : $t('reviews.write') }}

    //- Форма отправки (скрытое поле website — honeypot для ботов)
    form.review-form.card.bg-base-100.shadow-sm.mb-4(
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
        //- Фото: до 3 снимков, сжимаются в webp на клиенте (useImageResize)
        div
          span.review-label {{ $t('reviews.photoLabel') }}
          .flex.items-center.gap-2.flex-wrap
            label.photo-add-btn
              input.hidden(type="file" accept="image/*" multiple @change="onPhotosChange")
              | 📁 {{ $t('reviews.photoBtn') }}
            .flex.gap-2.flex-wrap
              .photo-thumb.relative(v-for="(p, i) in form.photos" :key="p")
                NuxtImg(:src="p" :alt="$t('reviews.photoAlt', { n: i + 1 })")
                button.photo-remove(type="button" :aria-label="$t('reviews.photoRemoveAria', { n: i + 1 })" @click="removePhoto(i)") ×
          span.text-xs(class="mt-1 inline-block text-base-content/50") {{ $t('reviews.photoHint') }}
        //- Honeypot: обычному покупателю не виден
        input.hidden(type="text" tabindex="-1" autocomplete="off" v-model="form.website" aria-hidden="true")
        p.form-error(v-if="formError" role="alert") {{ formError }}
        .flex.justify-end
          button.btn.btn-primary.btn-sm.rounded-xl(type="submit" :disabled="sending")
            span.loading.loading-spinner.loading-xs(v-if="sending")
            | {{ $t('reviews.submit') }}

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
          //- Фото отзыва: клик открывает лайтбокс
          .review-photos.flex.gap-2.flex-wrap(v-if="r.photos?.length")
            button.review-photo-thumb(type="button" v-for="(p, i) in r.photos" :key="p" :aria-label="$t('reviews.photoOpenAria', { n: i + 1 })" @click="lightbox = { photos: r.photos, index: i }")
              NuxtImg(:src="p" :alt="$t('reviews.photoAlt', { n: i + 1 })" loading="lazy")

    //- Пусто: приглашение
    .text-center.py-6(v-else)
      p(class="text-base-content/50 text-sm mb-3") {{ $t('reviews.empty') }}

  //- Лайтбокс фото отзыва (клик мимо картинки или ✕ — закрывает)
  .review-lightbox.fixed.inset-0(
    v-if="lightbox"
    role="dialog"
    aria-modal="true"
    :aria-label="$t('reviews.photoLightboxAria')"
    @click="lightbox = null"
    class="z-[10001] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
  )
    NuxtImg(:src="lightbox.photos[lightbox.index]" :alt="$t('reviews.photoAlt', { n: lightbox.index + 1 })" class="max-h-[90vh] max-w-[92vw] rounded-xl shadow-2xl")
    button.lb-close.absolute(type="button" :aria-label="$t('common.close')" @click.stop="lightbox = null" class="top-4 right-4 btn btn-circle btn-sm border-0 text-white bg-white/15") ✕

  //- Тост «появится после модерации» показывается через $notify
</template>

<script setup>
import { validateImageFile, useImageResize } from '~/composables/useImageResize'

const { t, locale } = useI18n()

const props = defineProps({
  productId: { type: [String, Number], required: true },
  reviews: { type: Array, default: () => [] },
  summary: {
    type: Object,
    default: () => ({ count: 0, average: 0 }),
  },
})

const { $notify } = useNuxtApp()

const formatAverage = computed(() =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(
    props.summary.average ?? 0,
  ),
)

// Формы слова «отзыв» — vue-i18n plural (reviews.count, pluralRules ru)
const countLabel = computed(() => t('reviews.count', props.summary.count ?? 0))

const formatDate = (iso) => formatNewsDate(iso, locale.value)

// ─── Форма ───────────────────────────────────────────────────────────────
const showForm = ref(false)
const sending = ref(false)
const formError = ref('')
const form = reactive({ author: '', rating: 5, text: '', website: '', photos: [] })

// Лимит фото на отзыв — зеркалит MAX_REVIEW_PHOTOS на сервере
const MAX_PHOTOS = 3
const { resizeToWebp } = useImageResize()

const removePhoto = (index) => {
  form.photos.splice(index, 1)
}

// Выбор фото: валидируем файл, жмём в webp (до 1000px, q 0.75) и добавляем
// data-URI в форму. Сам input очищаем — тот же файл можно выбрать заново.
const onPhotosChange = async (e) => {
  const files = Array.from(e?.target?.files ?? [])
  e.target.value = ''
  for (const file of files) {
    if (form.photos.length >= MAX_PHOTOS) {
      $notify.error(t('reviews.photoLimit', { n: MAX_PHOTOS }))
      break
    }
    const check = validateImageFile(file)
    if (!check.valid) {
      $notify.error(t(check.error, check.params ?? {}))
      continue
    }
    try {
      form.photos.push(await resizeToWebp(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.75 }))
    } catch {
      $notify.error(t('reviews.photoError'))
    }
  }
}

const toggleForm = () => {
  showForm.value = !showForm.value
  formError.value = ''
}

// Лайтбокс: { photos, index } — какой отзыв и какое фото показано
const lightbox = ref(null)

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
    const resp = await $fetch('/api/reviews', {
      method: 'POST',
      body: {
        productId: String(props.productId),
        author: form.author,
        rating: form.rating,
        text: form.text,
        website: form.website,
        photos: form.photos,
      },
    })
    $notify.success(resp?.message || t('reviews.moderationThanks'))
    showForm.value = false
    form.author = ''
    form.rating = 5
    form.text = ''
    form.website = ''
    form.photos = []
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

/* Звёзды-кнопки оценки: без рамок, крупная зона нажатия (палец) */
.star-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  line-height: 0;
}

/* ─── Фото в форме отзыва ─────────────────────────────────── */
.photo-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  border: 1px dashed var(--color-base-300);
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-base-content);
  opacity: 0.75;
  cursor: pointer;
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.photo-add-btn:hover {
  border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
  opacity: 1;
}

.photo-thumb img {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: cover;
  border-radius: 0.625rem;
  display: block;
}

.photo-remove {
  position: absolute;
  top: -0.375rem;
  right: -0.375rem;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 9999px;
  border: none;
  background: var(--color-error);
  color: var(--color-error-content);
  font-size: 0.75rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* ─── Фото в опубликованных отзывах + лайтбокс ───────────── */
.review-photo-thumb {
  padding: 0;
  border: none;
  background: none;
  line-height: 0;
  cursor: zoom-in;
}

.review-photo-thumb img {
  width: 4rem;
  height: 4rem;
  object-fit: cover;
  border-radius: 0.625rem;
}

.lb-close {
  cursor: pointer;
}
</style>
