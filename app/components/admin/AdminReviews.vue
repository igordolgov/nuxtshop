<!-- ~/components/admin/AdminReviews.vue — модерация отзывов (KV data:reviews).
     Список с фильтрами (на модерации / все), публикация/скрытие/удаление.
     Отзывы приходят с витрины (POST /api/reviews) и ждут одобрения. -->
<template lang="pug">
.admin-reviews
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content {{ $t('admin.reviews.title') }}
      p.text-sm(class="mt-0.5 text-base-content/60")
        | {{ isLoading ? $t('admin.common.loading') : pending > 0 ? $t('admin.reviews.pendingCount', { n: pending }) : $t('admin.reviews.allDone') }}

    .flex.gap-2
      button.btn.btn-ghost.btn-sm.rounded-xl(
        type="button"
        :disabled="isLoading"
        :aria-label="$t('admin.reviews.refreshAria')"
        @click="load"
      )
        svg.w-4.h-4(:class="{ 'animate-spin': isLoading }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")

  //- Фильтр: на модерации / все
  .flex.gap-1.mb-4.flex-wrap(role="tablist" :aria-label="$t('admin.reviews.filtersAria')")
    button.btn.btn-sm.rounded-xl(
      type="button"
      :class="filter === 'pending' ? 'btn-primary' : 'btn-ghost'"
      @click="filter = 'pending'"
    ) {{ $t('admin.reviews.filterPending') }} {{ pending > 0 ? `(${pending})` : '' }}
    button.btn.btn-sm.rounded-xl(
      type="button"
      :class="filter === 'all' ? 'btn-primary' : 'btn-ghost'"
      @click="filter = 'all'"
    ) {{ $t('admin.reviews.filterAll') }} ({{ items.length }})

  //- Скелетон
  .space-y-3(v-if="isLoading && !items.length")
    .skeleton.h-20.rounded-2xl(v-for="i in 4" :key="i")

  //- Ошибка загрузки
  .text-center.py-12(v-else-if="loadError")
    p(class="text-base-content/50 mb-4") {{ $t('admin.reviews.loadError') }}
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") {{ $t('admin.common.retry') }}

  //- Пусто (с учётом фильтра)
  .text-center.py-12(v-else-if="!filtered.length")
    p(class="text-base-content/50")
      | {{ filter === 'pending' ? $t('admin.reviews.emptyPending') : $t('admin.reviews.emptyAll') }}

  //- Список (свежие сверху)
  .space-y-3(v-else)
    .review-row.card.bg-base-100.shadow-sm(v-for="r in filtered" :key="r.id")
      .card-body.p-4.gap-2
        .flex.items-center.gap-2.flex-wrap
          .flex(class="gap-0.5" :aria-label="$t('admin.reviews.ratingAria', { n: r.rating })")
            svg.w-4.h-4(v-for="i in 5" :key="i" :class="i <= r.rating ? 'fill-warning text-warning' : 'fill-none text-base-content/30'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5")
              path(stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z")
          span.font-medium.text-sm {{ r.author }}
          span.text-xs(class="text-base-content/50") {{ formatDate(r.createdAt) }}
          span.badge.badge-ghost.badge-sm(v-if="r.helpfulCount > 0") {{ $t('admin.reviews.helpfulLabel', { n: r.helpfulCount }) }}
          span.badge.badge-sm(v-if="r.approved" class="badge-success") {{ $t('admin.reviews.published') }}
          span.badge.badge-sm.badge-warning(v-else) {{ $t('admin.reviews.pendingBadge') }}
        //- Товар: имя со ссылкой на карточку (или «товар удалён»)
        .text-xs
          span(class="text-base-content/50") {{ $t('admin.reviews.productLabel') }} 
          a.link.link-hover(class="text-primary" v-if="r.productSlug" :href="localePath(`/product/${r.productSlug}`)" target="_blank" rel="noopener") {{ r.productName || `id ${r.productId}` }}
          span(v-else class="text-base-content/50") {{ r.productName || $t('admin.reviews.deletedProduct', { id: r.productId }) }}
        p.text-sm.leading-relaxed(class="text-base-content/85") {{ r.text }}
        //- Фото покупателя: клик — открыть оригинал в новой вкладке
        .flex.gap-2.flex-wrap(v-if="r.photos?.length")
          a.review-photo(v-for="(p, i) in r.photos" :key="p" :href="p" target="_blank" rel="noopener")
            NuxtImg(:src="p" :alt="$t('reviews.photoAlt', { n: i + 1 })" loading="lazy" width="64" height="64")
        //- Существующий ответ магазина
        .shop-reply.rounded-xl.p-3(
          v-if="r.shopReply?.text && replyForId !== r.id"
          class="bg-base-200 border-l-2 border-primary"
        )
          .flex.items-center.gap-2.mb-1.text-xs
            span.font-medium {{ $t('reviews.shopReply') }}
            span(class="text-base-content/50") {{ formatDate(r.shopReply.at) }}
            button.reply-remove.btn.btn-ghost.btn-xs.ml-auto(
              type="button"
              class="hover:bg-error hover:text-error-content"
              :aria-label="$t('admin.reviews.replyDelete')"
              @click="removeReply(r)"
            ) ✕
          p.text-sm.leading-relaxed {{ r.shopReply.text }}
        //- Форма ответа (открыта для текущего отзыва)
        .reply-form.space-y-2(v-if="replyForId === r.id")
          textarea.textarea.textarea-bordered.w-full.leading-relaxed(
            v-model="replyText"
            rows="3"
            maxlength="600"
            :placeholder="$t('admin.reviews.replyPlaceholder')"
          )
          .flex.gap-2.justify-end.flex-wrap
            button.btn.btn-ghost.btn-xs.rounded-lg(
              type="button"
              :disabled="replyBusy"
              @click="replyForId = null"
            ) {{ $t('reviews.cancel') }}
            button.btn.btn-primary.btn-xs.rounded-lg(
              type="button"
              :disabled="replyBusy || (replyText.trim().length < 2 && !(r.shopReply?.text))"
              @click="saveReply(r)"
            )
              span.loading.loading-spinner.loading-xs(v-if="replyBusy")
              | {{ replyText.trim() ? $t('admin.reviews.replySave') : $t('admin.reviews.replyDelete') }}
        .flex.gap-2.justify-end.flex-wrap
          //- Кнопка ответа: скрыта, пока открыта форма этого отзыва
          button.btn.btn-outline.btn-xs.rounded-lg(
            v-if="replyForId !== r.id"
            type="button"
            @click="openReply(r)"
          ) {{ r.shopReply?.text ? $t('admin.reviews.replyEditBtn') : $t('admin.reviews.replyBtn') }}
          button.btn.btn-success.btn-xs.rounded-lg(
            v-if="!r.approved"
            type="button"
            :disabled="busyId === r.id"
            @click="setApproved(r, true)"
          ) {{ $t('admin.reviews.publishBtn') }}
          button.btn.btn-outline.btn-xs.rounded-lg(
            v-else
            type="button"
            :disabled="busyId === r.id"
            @click="setApproved(r, false)"
          ) {{ $t('admin.reviews.hideBtn') }}
          button.btn.btn-outline.btn-xs.rounded-lg(
            type="button"
            class="hover:bg-error hover:text-error-content hover:border-error"
            :disabled="busyId === r.id"
            @click="remove(r)"
          ) {{ $t('admin.common.delete') }}
</template>

<script setup>
import { formatNewsDate } from '~/utils/news'

const { $notify } = useNuxtApp()
const { t, locale } = useI18n()
const localePath = useLocalePath()

const items = ref([])
const pending = ref(0)
const isLoading = ref(false)
const loadError = ref(false)
const filter = ref('pending')
const busyId = ref(null)

const filtered = computed(() =>
  filter.value === 'pending' ? items.value.filter((r) => !r.approved) : items.value,
)

const formatDate = (iso) => formatNewsDate(iso, locale.value)

const load = async () => {
  isLoading.value = true
  loadError.value = false
  try {
    const resp = await $fetch('/api/admin/reviews')
    items.value = Array.isArray(resp?.reviews) ? resp.reviews : []
    pending.value = Number(resp?.pending) || 0
  } catch {
    loadError.value = true
    $notify.error(t('admin.reviews.loadError'))
  } finally {
    isLoading.value = false
  }
}

const setApproved = async (review, approved) => {
  busyId.value = review.id
  try {
    const resp = await $fetch(`/api/admin/reviews/${review.id}`, {
      method: 'PUT',
      body: { approved },
    })
    $notify.success(resp?.message || (approved ? t('admin.reviews.publishedToast') : t('admin.reviews.hiddenToast')))
    await load()
  } catch {
    $notify.error(t('admin.reviews.saveError'))
  } finally {
    busyId.value = null
  }
}

// ─── Ответ магазина на отзыв ───────────────────────────────────────
// Открытая форма — одна (replyForId), текст редактируется в replyText.
// Пустой текст при наличии ответа = удалить ответ (кнопка меняет подпись).
const replyForId = ref(null)
const replyText = ref('')
const replyBusy = ref(false)

const openReply = (review) => {
  replyForId.value = review.id
  replyText.value = review.shopReply?.text ?? ''
}

const saveReply = async (review) => {
  replyBusy.value = true
  try {
    const resp = await $fetch(`/api/admin/reviews/${review.id}/reply`, {
      method: 'PUT',
      body: { text: replyText.value.trim() },
    })
    review.shopReply = resp?.review?.shopReply ?? null
    $notify.success(resp?.message || (replyText.value.trim() ? t('admin.reviews.replySaved') : t('admin.reviews.replyDeleted')))
    replyForId.value = null
    replyText.value = ''
  } catch (error) {
    $notify.error(error?.data?.message || t('admin.reviews.replyError'))
  } finally {
    replyBusy.value = false
  }
}

const removeReply = async (review) => {
  if (!confirm(t('admin.reviews.replyConfirmDelete'))) return
  replyBusy.value = true
  try {
    const resp = await $fetch(`/api/admin/reviews/${review.id}/reply`, {
      method: 'PUT',
      body: { text: '' },
    })
    review.shopReply = resp?.review?.shopReply ?? null
    $notify.success(t('admin.reviews.replyDeleted'))
  } catch (error) {
    $notify.error(error?.data?.message || t('admin.reviews.replyError'))
  } finally {
    replyBusy.value = false
  }
}

const remove = async (review) => {
  if (!confirm(t('admin.reviews.deleteConfirm'))) return
  busyId.value = review.id
  try {
    const resp = await $fetch(`/api/admin/reviews/${review.id}`, { method: 'DELETE' })
    $notify.success(resp?.message || t('admin.reviews.deletedToast'))
    await load()
  } catch {
    $notify.error(t('admin.reviews.deleteError'))
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
/* Фото в модерации: клик открывает оригинал в новой вкладке */
.review-photo img {
  width: 4rem;
  height: 4rem;
  object-fit: cover;
  border-radius: 0.625rem;
  display: block;
}
</style>
