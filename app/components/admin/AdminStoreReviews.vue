<!-- ~/components/admin/AdminStoreReviews.vue — модерация отзывов О МАГАЗИНЕ
     (KV data:store-reviews). Паттерн AdminReviews: фильтры, публикация,
     скрытие, удаление; без товарной строки (товара у отзыва нет). -->
<template lang="pug">
.admin-store-reviews
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content {{ $t('admin.storeReviews.title') }}
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
    p(class="text-base-content/50 mb-4") {{ $t('admin.storeReviews.loadError') }}
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") {{ $t('admin.common.retry') }}

  //- Пусто (с учётом фильтра)
  .text-center.py-12(v-else-if="!filtered.length")
    p(class="text-base-content/50")
      | {{ filter === 'pending' ? $t('admin.reviews.emptyPending') : $t('admin.storeReviews.emptyAll') }}

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
          span.badge.badge-sm(v-if="r.approved" class="badge-success") {{ $t('admin.reviews.published') }}
          span.badge.badge-sm.badge-warning(v-else) {{ $t('admin.reviews.pendingBadge') }}
        p.text-sm.leading-relaxed(class="text-base-content/85") {{ r.text }}
        .flex.gap-2.justify-end.flex-wrap
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
    const resp = await $fetch('/api/admin/store-reviews')
    items.value = Array.isArray(resp?.reviews) ? resp.reviews : []
    pending.value = Number(resp?.pending) || 0
  } catch {
    loadError.value = true
    $notify.error(t('admin.storeReviews.loadError'))
  } finally {
    isLoading.value = false
  }
}

const setApproved = async (review, approved) => {
  busyId.value = review.id
  try {
    const resp = await $fetch(`/api/admin/store-reviews/${review.id}`, {
      method: 'PUT',
      body: { approved },
    })
    $notify.success(resp?.message || (approved ? t('admin.reviews.publishedToast') : t('admin.reviews.hiddenToast')))
    await load()
  } catch {
    $notify.error(t('admin.storeReviews.saveError'))
  } finally {
    busyId.value = null
  }
}

const remove = async (review) => {
  if (!confirm(t('admin.storeReviews.deleteConfirm'))) return
  busyId.value = review.id
  try {
    const resp = await $fetch(`/api/admin/store-reviews/${review.id}`, { method: 'DELETE' })
    $notify.success(resp?.message || t('admin.storeReviews.deletedToast'))
    await load()
  } catch {
    $notify.error(t('admin.storeReviews.deleteError'))
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>
