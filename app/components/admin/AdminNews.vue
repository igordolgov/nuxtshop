<!-- ~/components/admin/AdminNews.vue — управление новостями (KV data:news).
     CRUD через /api/news (только админ): список, добавление, редактирование,
     удаление (confirm). Форма: заголовок, рубрика, дата, краткое описание,
     изображение (путь/URL, preview), полный текст — абзацы с новой строки. -->
<template lang="pug">
.admin-news
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content Новости
      p.text-sm(class="mt-0.5 text-base-content/60")
        | {{ isLoading ? 'Загрузка…' : `В системе: ${items.length}` }}

    .flex.gap-2
      button.btn.btn-ghost.btn-sm.rounded-xl(
        type="button"
        :disabled="isLoading"
        aria-label="Обновить"
        @click="load"
      )
        svg.w-4.h-4(:class="{ 'animate-spin': isLoading }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")
      button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="openCreate")
        svg.w-4.h-4.mr-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4")
        | Добавить новость

  //- Скелетон
  .space-y-3(v-if="isLoading && !items.length")
    .skeleton.h-20.rounded-2xl(v-for="i in 4" :key="i")

  //- Ошибка загрузки
  .text-center.py-12(v-else-if="loadError")
    p(class="text-base-content/50 mb-4") Не удалось загрузить новости
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") Повторить

  //- Пусто
  .text-center.py-12(v-else-if="!items.length")
    p(class="text-base-content/50") Новостей пока нет — добавьте первую.

  //- Список (свежие сверху)
  .space-y-3(v-else)
    .news-row.card.bg-base-100.shadow-sm(v-for="item in sorted" :key="item.id")
      .card-body.p-4.gap-2
        .flex.items-center.gap-2.flex-wrap
          span.badge.badge-sm(:class="badgeClass(item.category)") {{ item.category }}
          span.text-xs(class="text-base-content/50") {{ formatNewsDate(item.date) }}
          span.text-xs(class="text-base-content/35") · id {{ item.id }}
        .flex.gap-3.items-start
          img.w-14.h-14.rounded-lg.object-cover.flex-shrink-0(
            v-if="item.image"
            :src="item.image"
            :alt="item.title"
            loading="lazy"
          )
          .min-w-0.flex-1
            h3.font-medium.text-sm(class="line-clamp-1") {{ item.title }}
            p.text-xs(class="mt-0.5 text-base-content/50 line-clamp-1") {{ item.excerpt || 'Без краткого описания' }}
        .flex.gap-2.justify-end.flex-wrap
          a.btn.btn-ghost.btn-xs.rounded-lg(href="/news" target="_blank" rel="noopener") На сайте
          button.btn.btn-outline.btn-xs.rounded-lg(type="button" @click="openEdit(item)") Изменить
          button.btn.btn-outline.btn-xs.rounded-lg(type="button" class="hover:bg-error hover:text-error-content hover:border-error" @click="remove(item)") Удалить

  //- Форма: создание / редактирование
  .modal(:class="{ 'modal-open': showForm }" role="dialog" aria-modal="true" @click.self="closeForm")
    .modal-box.max-w-2xl
      h3.font-semibold.text-lg.mb-4 {{ isNew ? 'Новая новость' : 'Редактирование новости' }}

      form(@submit.prevent="save" novalidate)
        label.block.mb-3
          span.form-label Заголовок
          input.input.input-bordered.rounded-xl.w-full(
            type="text"
            v-model.trim="form.title"
            placeholder="Что случилось? От 5 до 120 символов"
            maxlength="120"
          )

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label Рубрика
            select.select.select-bordered.rounded-xl.w-full(v-model="form.category")
              option(v-for="c in NEWS_CATEGORIES" :key="c" :value="c") {{ c }}
          label.block
            span.form-label Дата публикации
            input.input.input-bordered.rounded-xl.w-full(type="date" v-model="form.date")

        label.block.mt-3
          span.form-label Краткое описание (до 220 символов)
          input.input.input-bordered.rounded-xl.w-full(
            type="text"
            v-model.trim="form.excerpt"
            placeholder="Одно предложение для карточки в ленте"
            maxlength="220"
          )

        label.block.mt-3
          span.form-label Изображение
          input.input.input-bordered.rounded-xl.w-full(
            type="text"
            v-model.trim="form.image"
            placeholder="/images/products/… или https://… (пусто — плитка с иконкой)"
          )
          img.mt-2.h-24.rounded-lg.object-cover(
            v-if="form.image"
            :src="form.image"
            alt="Превью изображения новости"
          )

        label.block.mt-3
          span.form-label Полный текст — каждый абзац с новой строки
          textarea.textarea.textarea-bordered.w-full.leading-relaxed(
            v-model="form.body"
            rows="7"
            placeholder="Первый абзац&#10;&#10;Второй абзац"
          )

        p.form-error(v-if="formError" role="alert") {{ formError }}

        .modal-action
          button.btn.rounded-xl(type="button" :disabled="saving" @click="closeForm") Отмена
          button.btn.btn-primary.rounded-xl(type="submit" :disabled="saving")
            span.loading.loading-spinner.loading-xs(v-if="saving")
            | {{ isNew ? 'Добавить' : 'Сохранить' }}
</template>

<script setup>
import { NEWS_CATEGORIES, formatNewsDate, newsTone } from '~/utils/news'

const { $notify } = useNuxtApp()

const items = ref([])
const isLoading = ref(false)
const loadError = ref(false)

const sorted = computed(() =>
  [...items.value].sort((a, b) => {
    const d = String(b.date).localeCompare(String(a.date))
    if (d !== 0) return d
    return (Number(b.id) || 0) - (Number(a.id) || 0)
  })
)

const badgeClass = (category) => {
  const tone = newsTone(category)
  return {
    sale: 'badge-error',
    new: 'badge-success',
    company: 'badge-info',
    review: 'badge-secondary',
  }[tone]
}

const load = async () => {
  isLoading.value = true
  loadError.value = false
  try {
    const resp = await $fetch('/api/news')
    items.value = Array.isArray(resp?.news) ? resp.news : []
  } catch {
    loadError.value = true
    $notify.error('Не удалось загрузить новости')
  } finally {
    isLoading.value = false
  }
}

// ─── Форма ───────────────────────────────────────────────────────────────
const showForm = ref(false)
const isNew = ref(true)
const saving = ref(false)
const formError = ref('')
const form = reactive({
  id: null,
  title: '',
  category: NEWS_CATEGORIES[0],
  date: '',
  excerpt: '',
  image: '',
  body: '',
})

const openCreate = () => {
  isNew.value = true
  Object.assign(form, {
    id: null,
    title: '',
    category: NEWS_CATEGORIES[0],
    date: new Date().toISOString().slice(0, 10),
    excerpt: '',
    image: '',
    body: '',
  })
  formError.value = ''
  showForm.value = true
}

const openEdit = (item) => {
  isNew.value = false
  Object.assign(form, {
    id: item.id,
    title: item.title,
    category: item.category,
    date: item.date,
    excerpt: item.excerpt || '',
    image: item.image || '',
    body: (item.body || []).join('\n'),
  })
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  if (saving.value) return
  showForm.value = false
}

const save = async () => {
  formError.value = ''
  saving.value = true
  try {
    const payload = {
      title: form.title,
      category: form.category,
      date: form.date,
      excerpt: form.excerpt,
      image: form.image,
      body: form.body,
    }
    const resp = isNew.value
      ? await $fetch('/api/news', { method: 'POST', body: payload })
      : await $fetch(`/api/news/${form.id}`, { method: 'PUT', body: payload })
    $notify.success(resp?.message || 'Сохранено')
    showForm.value = false
    await load()
  } catch (error) {
    const message = error?.data?.message || error?.message || 'Не удалось сохранить новость'
    formError.value = message
    $notify.error(message)
  } finally {
    saving.value = false
  }
}

const remove = async (item) => {
  if (!confirm(`Удалить новость «${item.title}»? Действие необратимо.`)) return
  try {
    const resp = await $fetch(`/api/news/${item.id}`, { method: 'DELETE' })
    $notify.success(resp?.message || 'Новость удалена')
    await load()
  } catch {
    $notify.error('Не удалось удалить новость')
  }
}

onMounted(load)
</script>

<style scoped>
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
</style>
