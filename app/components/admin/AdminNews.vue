<!-- ~/components/admin/AdminNews.vue — управление новостями (KV data:news).
     CRUD через /api/news (только админ): список, добавление, редактирование,
     удаление (confirm). Форма: заголовок, рубрика, дата, тумблер публикации
     (черновик виден только в админке), краткое описание, изображение
     (файл/камера с клиентским webp-ресайзом → KV img:news/…, или путь/URL,
     preview), полный текст — абзацы с новой строки, товары из новости —
     пикер из каталога (перелинковка, до 6). -->
<template lang="pug">
.admin-news
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content {{ $t('admin.news.title') }}
      p.text-sm(class="mt-0.5 text-base-content/60")
        | {{ isLoading ? $t('admin.common.loading') : $t('admin.news.inSystem', { n: items.length }) }}

    .flex.gap-2
      button.btn.btn-ghost.btn-sm.rounded-xl(
        type="button"
        :disabled="isLoading"
        :aria-label="$t('admin.common.refresh')"
        @click="load"
      )
        svg.w-4.h-4(:class="{ 'animate-spin': isLoading }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")
      button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="openCreate")
        svg.w-4.h-4.mr-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4")
        | {{ $t('admin.news.addNews') }}

  //- Скелетон
  .space-y-3(v-if="isLoading && !items.length")
    .skeleton.h-20.rounded-2xl(v-for="i in 4" :key="i")

  //- Ошибка загрузки
  .text-center.py-12(v-else-if="loadError")
    p(class="text-base-content/50 mb-4") {{ $t('admin.news.loadError') }}
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") {{ $t('admin.common.retry') }}

  //- Пусто
  .text-center.py-12(v-else-if="!items.length")
    p(class="text-base-content/50") {{ $t('admin.news.empty') }}

  //- Список (свежие сверху)
  .space-y-3(v-else)
    .news-row.card.bg-base-100.shadow-sm(v-for="item in sorted" :key="item.id")
      .card-body.p-4.gap-2
        .flex.items-center.gap-2.flex-wrap
          span.badge.badge-sm(:class="badgeClass(item.category)") {{ item.category }}
          span.badge.badge-sm.badge-warning(v-if="item.published === false") {{ $t('admin.news.draft') }}
          span.text-xs(class="text-base-content/50") {{ formatNewsDate(item.date, locale) }}
          span.text-xs(class="text-base-content/55") · id {{ item.id }}
        .flex.gap-3.items-start
          NuxtImg.w-14.h-14.rounded-lg.object-cover.flex-shrink-0(
            v-if="item.image"
            :src="item.image"
            :alt="item.title"
            loading="lazy"
          )
          .min-w-0.flex-1
            h3.font-medium.text-sm(class="line-clamp-1") {{ item.title }}
            p.text-xs(class="mt-0.5 text-base-content/50 line-clamp-1") {{ item.excerpt || $t('admin.news.noExcerpt') }}
            span.text-xs(class="mt-0.5 inline-block text-base-content/50")
              | {{ $t('admin.news.productsInNews', { n: item.products?.length ?? 0 }) }}
        .flex.gap-2.justify-end.flex-wrap
          a.btn.btn-ghost.btn-xs.rounded-lg(:href="localePath('/news')" target="_blank" rel="noopener") {{ $t('admin.news.onSite') }}
          button.btn.btn-outline.btn-xs.rounded-lg(type="button" @click="openEdit(item)") {{ $t('admin.common.edit') }}
          button.btn.btn-outline.btn-xs.rounded-lg(type="button" class="hover:bg-error hover:text-error-content hover:border-error" @click="remove(item)") {{ $t('admin.common.delete') }}

  //- Форма: создание / редактирование
  .modal(:class="{ 'modal-open': showForm }" role="dialog" aria-modal="true" @click.self="closeForm")
    .modal-box.max-w-2xl
      h3.font-semibold.text-lg.mb-4 {{ isNew ? $t('admin.news.formNew') : $t('admin.news.formEdit') }}

      form(@submit.prevent="save" novalidate)
        //- Языковые вкладки: RU — основной контент (обязательный), EN/ES —
        //- необязательные переводы (пусто → витрина показывает русский)
        .flex.gap-1.mb-3.flex-wrap.items-center
          button.btn.btn-xs(type="button" :disabled="saving" :class="langTab === 'ru' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'ru'") Русский
          button.btn.btn-xs(type="button" :disabled="saving" :class="langTab === 'en' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'en'") English
          button.btn.btn-xs(type="button" :disabled="saving" :class="langTab === 'es' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'es'") Español
          span.text-xs.ml-1(v-if="langTab !== 'ru'" class="text-base-content/60")
            | {{ $t('admin.productForm.optionalHint') }}

        template(v-if="langTab === 'ru'")
          label.block.mb-3
            span.form-label {{ $t('admin.news.titleLabel') }}
            input.input.input-bordered.rounded-xl.w-full(
              type="text"
              v-model.trim="form.title"
              :placeholder="$t('admin.news.titlePlaceholder')"
              maxlength="120"
            )
        template(v-else-if="langTab === 'en'")
          label.block.mb-3
            span.form-label Title (English)
            input.input.input-bordered.rounded-xl.w-full(
              type="text"
              v-model.trim="form.titleEn"
              placeholder="Headline in English — optional"
              maxlength="120"
            )
        template(v-else)
          label.block.mb-3
            span.form-label Título (Español)
            input.input.input-bordered.rounded-xl.w-full(
              type="text"
              v-model.trim="form.titleEs"
              placeholder="Titular en español — opcional"
              maxlength="120"
            )

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label {{ $t('admin.news.category') }}
            select.select.select-bordered.rounded-xl.w-full(v-model="form.category")
              option(v-for="c in NEWS_CATEGORIES" :key="c" :value="c") {{ c }}
          label.block
            span.form-label {{ $t('admin.news.publishDate') }}
            input.input.input-bordered.rounded-xl.w-full(type="date" v-model="form.date")

        //- Черновик/публикация: черновик виден только в админке;
        //- публикация черновика отправляет пост в Telegram
        label.block.mt-3.cursor-pointer
          .flex.items-center.gap-3
            input.toggle.toggle-primary(type="checkbox" v-model="form.published")
            span.text-sm {{ form.published ? $t('admin.news.publishedOn') : $t('admin.news.draftOn') }}

        template(v-if="langTab === 'ru'")
          label.block.mt-3
            span.form-label {{ $t('admin.news.excerptLabel') }}
            input.input.input-bordered.rounded-xl.w-full(
              type="text"
              v-model.trim="form.excerpt"
              :placeholder="$t('admin.news.excerptPlaceholder')"
              maxlength="220"
            )
        template(v-else-if="langTab === 'en'")
          label.block.mt-3
            span.form-label Excerpt (English, up to 220 characters)
            input.input.input-bordered.rounded-xl.w-full(
              type="text"
              v-model.trim="form.excerptEn"
              placeholder="One sentence for the feed card — optional"
              maxlength="220"
            )
        template(v-else)
          label.block.mt-3
            span.form-label Resumen (Español, hasta 220 caracteres)
            input.input.input-bordered.rounded-xl.w-full(
              type="text"
              v-model.trim="form.excerptEs"
              placeholder="Una frase para la tarjeta — opcional"
              maxlength="220"
            )

        label.block.mt-3
          span.form-label {{ $t('admin.news.imageLabel') }}
          //- На мобильных — столбиком: файл/камера + URL-поле в строку не помещаются
          .flex.flex-col.gap-2(class="sm:flex-row")
            input.input.input-bordered.rounded-xl.w-full(
              type="text"
              v-model.trim="form.image"
              :placeholder="$t('admin.news.imagePlaceholder')"
            )
            label.btn.btn-outline.btn-sm.rounded-xl.shrink-0(
              :class="resizing ? 'loading' : ''"
              :aria-label="$t('admin.news.uploadAria')"
            )
              | {{ resizing ? $t('admin.news.processing') : $t('admin.news.photoBtn') }}
              input.hidden(type="file" accept="image/jpeg,image/png,image/webp" @change="onFilePicked")
          NuxtImg.mt-2.h-24.rounded-lg.object-cover(
            v-if="form.image"
            :src="form.image"
            :alt="$t('admin.news.imagePreviewAlt')"
          )
          button.btn.btn-ghost.btn-xs.mt-1(v-if="form.image" type="button" @click="form.image = ''") {{ $t('admin.news.removeImage') }}
          p.text-xs(class="mt-0.5 text-base-content/50")
            | {{ $t('admin.news.imageHint') }}

        template(v-if="langTab === 'ru'")
          label.block.mt-3
            span.form-label {{ $t('admin.news.bodyLabel') }}
            textarea.textarea.textarea-bordered.w-full.leading-relaxed(
              v-model="form.body"
              rows="7"
              :placeholder="$t('admin.news.bodyPlaceholder')"
            )
        template(v-else-if="langTab === 'en'")
          label.block.mt-3
            span.form-label Full text (English) — one paragraph per line
            textarea.textarea.textarea-bordered.w-full.leading-relaxed(
              v-model="form.bodyEn"
              rows="7"
              placeholder="First paragraph&#10;&#10;Second paragraph"
            )
        template(v-else)
          label.block.mt-3
            span.form-label Texto completo (Español) — un párrafo por línea
            textarea.textarea.textarea-bordered.w-full.leading-relaxed(
              v-model="form.bodyEs"
              rows="7"
              placeholder="Primer párrafo&#10;&#10;Segundo párrafo"
            )

        //- Перелинковка: товары из новости (до 6, порядок = порядок показа)
        .mt-3
          span.form-label {{ $t('admin.news.productsLabel', { n: MAX_PRODUCTS }) }}
          //- На мобильных — столбиком: селект + кнопка в строку не помещаются
          .flex.flex-col.gap-2(class="sm:flex-row")
            select.select.select-bordered.rounded-xl.w-full(v-model="pickedProductId")
              option(value="" disabled) {{ $t('admin.news.selectProduct') }}
              option(v-for="p in availableProducts" :key="p.id" :value="p.id") {{ p.name }} · {{ formatPrice(p.price) }} ₽
            button.btn.btn-outline.btn-sm.rounded-xl(
              type="button"
              :disabled="!pickedProductId"
              @click="addProduct"
            ) {{ $t('admin.common.add') }}
          .chosen-list.mt-2(v-if="form.productIds.length")
            .chosen-chip(v-for="id in form.productIds" :key="id")
              span.chosen-name {{ productById(id)?.name || `id ${id}` }}
              button.chosen-remove(type="button" :aria-label="$t('admin.news.removeProductAria', { id })" @click="removeProduct(id)") ✕
          p.text-xs(class="mt-1 text-base-content/50")
            | {{ $t('admin.news.chosenHint', { n: form.productIds.length, m: MAX_PRODUCTS }) }}
          p.text-xs(class="text-base-content/50")
            | {{ $t('admin.news.autoPickHint') }}

        p.form-error(v-if="formError" role="alert") {{ formError }}

        .modal-action
          button.btn.rounded-xl(type="button" :disabled="saving" @click="closeForm") {{ $t('admin.common.cancel') }}
          button.btn.btn-primary.rounded-xl(type="submit" :disabled="saving")
            span.loading.loading-spinner.loading-xs(v-if="saving")
            | {{ isNew ? $t('admin.common.add') : $t('admin.common.save') }}
</template>

<script setup>
import { NEWS_CATEGORIES, formatNewsDate, newsTone } from '~/utils/news'

const { $notify } = useNuxtApp()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { formatPrice } = useProductUtils()
const { resizeToWebp } = useImageResize()

// Лимит товаров в новости — зеркало MAX_NEWS_PRODUCTS (server/lib/newsHelpers)
const MAX_PRODUCTS = 6

const items = ref([])
const isLoading = ref(false)
const loadError = ref(false)

//- Каталог для пикера «Товары из новости»: публичный GET /api/products
//- (без limit — голый массив). Не блокирует список новостей — грузится сам
const catalog = ref([])
const loadCatalog = async () => {
  try {
    const list = await $fetch('/api/products')
    catalog.value = Array.isArray(list) ? list : []
  } catch {
    catalog.value = []
  }
}

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
    // all=1: админский режим — список включает и черновики (публичный
    // GET /api/news их фильтрует; для не-админа all=1 отдаёт 401)
    const resp = await $fetch('/api/news', { query: { all: '1' } })
    items.value = Array.isArray(resp?.news) ? resp.news : []
  } catch {
    loadError.value = true
    $notify.error(t('admin.news.loadError'))
  } finally {
    isLoading.value = false
  }
}

// ─── Форма ───────────────────────────────────────────────────────────────
const showForm = ref(false)
const isNew = ref(true)
const saving = ref(false)
const formError = ref('')
// Языковая вкладка: RU — основной контент, EN/ES — необязательные переводы
const langTab = ref('ru')
const form = reactive({
  id: null,
  title: '',
  category: NEWS_CATEGORIES[0],
  date: '',
  excerpt: '',
  image: '',
  body: '',
  // Переводы (i18n): пусто → витрина показывает русский (фолбэк)
  titleEn: '',
  excerptEn: '',
  bodyEn: '',
  titleEs: '',
  excerptEs: '',
  bodyEs: '',
  productIds: [],
  published: true,
})

//- ─── Загрузка фото (телефон: камера/галерея → клиентский webp-ресайз) ────
const resizing = ref(false)

const onFilePicked = async (event) => {
  const file = event.target.files?.[0]
  // Сброс input: повторный выбор того же файла тоже срабатывает
  event.target.value = ''
  if (!file) return
  const validation = validateImageFile(file)
  if (!validation.valid) {
    $notify.error(validation.error)
    return
  }
  resizing.value = true
  try {
    form.image = await resizeToWebp(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 })
  } catch {
    $notify.error(t('admin.news.imageProcessError'))
  } finally {
    resizing.value = false
  }
}

//- ─── Пикер товаров из новости ────────────────────────────────────────────
const pickedProductId = ref('')

const productById = (id) => catalog.value.find((p) => String(p.id) === String(id))

//- В селекте — только ещё не выбранные товары
const availableProducts = computed(() =>
  catalog.value.filter((p) => !form.productIds.includes(String(p.id))),
)

const addProduct = () => {
  const id = String(pickedProductId.value || '')
  if (!id) return
  if (form.productIds.includes(id)) return
  if (form.productIds.length >= MAX_PRODUCTS) {
    $notify.error(t('admin.news.maxProducts', { n: MAX_PRODUCTS }))
    return
  }
  form.productIds.push(id)
  pickedProductId.value = ''
}

const removeProduct = (id) => {
  form.productIds = form.productIds.filter((x) => x !== id)
}

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
    titleEn: '',
    excerptEn: '',
    bodyEn: '',
    titleEs: '',
    excerptEs: '',
    bodyEs: '',
    productIds: [],
    published: true,
  })
  pickedProductId.value = ''
  formError.value = ''
  langTab.value = 'ru'
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
    // Переводы: пусто в KV → пустое поле (витрина покажет русский)
    titleEn: item.titleEn || '',
    excerptEn: item.excerptEn || '',
    bodyEn: (item.bodyEn || []).join('\n'),
    titleEs: item.titleEs || '',
    excerptEs: item.excerptEs || '',
    bodyEs: (item.bodyEs || []).join('\n'),
    // Только реально сохранённый ручной выбор: item.products содержит
    // в том числе автоподобранные товары (фолбэк на GET /api/news),
    // подставлять их в форму нельзя — сохранение зафиксировало бы их
    // как ручные, и автоподбор по рубрике перестал бы обновляться.
    productIds: (item.productIds ?? []).map(String),
    published: item.published !== false,
  })
  pickedProductId.value = ''
  formError.value = ''
  langTab.value = 'ru'
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
      // Переводы: пустая строка → сервер удалит перевод (фолбэк на русский)
      titleEn: form.titleEn,
      excerptEn: form.excerptEn,
      bodyEn: form.bodyEn,
      titleEs: form.titleEs,
      excerptEs: form.excerptEs,
      bodyEs: form.bodyEs,
      productIds: form.productIds,
      published: form.published,
    }
    const resp = isNew.value
      ? await $fetch('/api/news', { method: 'POST', body: payload })
      : await $fetch(`/api/news/${form.id}`, { method: 'PUT', body: payload })
    $notify.success(resp?.message || t('admin.common.saved'))
    showForm.value = false
    await load()
  } catch (error) {
    const message = error?.data?.message || error?.message || t('admin.news.saveError')
    formError.value = message
    $notify.error(message)
  } finally {
    saving.value = false
  }
}

const remove = async (item) => {
  if (!confirm(t('admin.news.deleteConfirm', { title: item.title }))) return
  try {
    const resp = await $fetch(`/api/news/${item.id}`, { method: 'DELETE' })
    $notify.success(resp?.message || t('admin.news.deleted'))
    await load()
  } catch {
    $notify.error(t('admin.news.deleteError'))
  }
}

onMounted(() => {
  load()
  loadCatalog()
})
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

/* ─── Выбранные товары новости (чипы) ─────────────────────── */
.chosen-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.chosen-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--color-base-300);
  border-radius: 0.625rem;
  background: var(--color-base-200);
  font-size: 0.8125rem;
}

.chosen-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chosen-remove {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: var(--color-base-content);
  opacity: 0.55;
  cursor: pointer;
  font-size: 0.75rem;
}

.chosen-remove:hover {
  background: color-mix(in oklab, var(--color-error) 15%, transparent);
  color: var(--color-error);
  opacity: 1;
}
</style>
