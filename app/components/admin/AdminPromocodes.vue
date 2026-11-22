<!-- ~/components/admin/AdminPromocodes.vue — управление промокодами
     (KV data:promocodes). CRUD через /api/admin/promocodes: список,
     создание/редактирование в модалке, вкл/выкл, удаление (confirm).
     Скидки считаются на сервере; здесь — только справочник кодов. -->
<template lang="pug">
.admin-promocodes
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content {{ $t('admin.promocodes.title') }}
      p.text-sm(class="mt-0.5 text-base-content/60")
        | {{ isLoading ? $t('admin.common.loading') : $t('admin.promocodes.inSystem', { n: items.length, m: activeCount }) }}

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
        | {{ $t('admin.promocodes.addPromo') }}

  //- Скелетон
  .space-y-3(v-if="isLoading && !items.length")
    .skeleton.h-20.rounded-2xl(v-for="i in 4" :key="i")

  //- Ошибка загрузки
  .text-center.py-12(v-else-if="loadError")
    p(class="text-base-content/50 mb-4") {{ $t('admin.promocodes.loadError') }}
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") {{ $t('admin.common.retry') }}

  //- Пусто
  .text-center.py-12(v-else-if="!items.length")
    p(class="text-base-content/50")
      | {{ $t('admin.promocodes.empty') }}

  //- Список (свежие сверху)
  .space-y-3(v-else)
    .promo-row.card.bg-base-100.shadow-sm(v-for="p in items" :key="p.id")
      .card-body.p-4.gap-2
        .flex.items-center.gap-2.flex-wrap
          span.font-bold.text-base.tracking-wide {{ p.code }}
          span.badge.badge-sm(:class="p.type === 'percent' ? 'badge-info' : 'badge-secondary'")
            | {{ p.type === 'percent' ? `${p.value}%` : formatMoney(p.value) }}
          span.badge.badge-sm(v-if="p.active" class="badge-success") {{ $t('admin.promocodes.active') }}
          span.badge.badge-sm.badge-warning(v-else) {{ $t('admin.promocodes.inactive') }}
          span.badge.badge-sm.badge-error(
            v-if="isExpired(p) || isLimitReached(p)"
          ) {{ isExpired(p) ? $t('admin.promocodes.expired') : $t('admin.promocodes.limitReached') }}
        .text-xs(class="text-base-content/60 flex flex-wrap gap-x-3 gap-y-0.5")
          span
            | {{ $t('admin.promocodes.used', { n: p.usedCount || 0 }) }}{{ p.usageLimit ? ` ${$t('admin.promocodes.usedOutOf', { n: p.usageLimit })}` : ` ${$t('admin.promocodes.noLimit')}` }}
          span(v-if="p.usageLimitPerUser") {{ $t('admin.promocodes.userLimitInfo', { n: p.usageLimitPerUser }) }}
          span(v-if="p.minSubtotal") {{ $t('admin.promocodes.minSubtotalInfo', { amount: formatMoney(p.minSubtotal) }) }}
          span(v-if="p.startsAt") {{ $t('admin.promocodes.startsInfo', { date: formatDate(p.startsAt) }) }}
          span(v-if="p.expiresAt") {{ $t('admin.promocodes.expiresAt', { date: formatDate(p.expiresAt) }) }}
          span(v-if="!p.expiresAt") {{ $t('admin.promocodes.noExpiry') }}
        .text-xs(class="text-base-content/50 flex flex-wrap gap-x-3 gap-y-0.5")
          span {{ scopeInfo(p) }}
          span {{ p.stackableWithPromos ? $t('admin.promocodes.stackYes') : $t('admin.promocodes.stackNo') }}
        p.text-xs(class="text-base-content/50" v-if="p.description") {{ p.description }}
        .flex.gap-2.justify-end.flex-wrap
          button.btn.btn-outline.btn-xs.rounded-lg(type="button" :disabled="busyId === p.id" @click="openEdit(p)") {{ $t('admin.common.edit') }}
          button.btn.btn-outline.btn-xs.rounded-lg(
            type="button"
            :disabled="busyId === p.id"
            @click="toggleActive(p)"
          ) {{ p.active ? $t('admin.promocodes.toggleOff') : $t('admin.promocodes.toggleOn') }}
          button.btn.btn-outline.btn-xs.rounded-lg(
            type="button"
            class="hover:bg-error hover:text-error-content hover:border-error"
            :disabled="busyId === p.id"
            @click="remove(p)"
          ) {{ $t('admin.common.delete') }}

  //- Форма: создание / редактирование.
  //- modal-box-fit (main.css): форма длинная — вмещается в экран
  //- телефона (dvh-высота), скролл даёт стоковый overflow-y:auto
  .modal(:class="{ 'modal-open': showForm }" role="dialog" aria-modal="true" @click.self="closeForm")
    .modal-box.modal-box-fit.max-w-2xl
      h3.font-semibold.text-lg.mb-4 {{ isNew ? $t('admin.promocodes.formNew') : $t('admin.promocodes.formEdit') }}

      form(@submit.prevent="save" novalidate)
        label.block.mb-3
          span.form-label {{ $t('admin.promocodes.codeLabel') }}
          input.input.input-bordered.rounded-xl.w-full.uppercase(
            type="text"
            v-model.trim="form.code"
            placeholder="SUMMER15"
            maxlength="32"
            autocomplete="off"
          )

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label {{ $t('admin.promocodes.typeLabel') }}
            select.select.select-bordered.rounded-xl.w-full(v-model="form.type")
              option(value="percent") {{ $t('admin.promocodes.typePercent') }}
              option(value="fixed") {{ $t('admin.promocodes.typeFixed', { cur: currencySymbol() }) }}

          label.block
            span.form-label {{ form.type === 'percent' ? $t('admin.promocodes.valuePercentLabel') : $t('admin.promocodes.valueFixedLabel') }}
            input.input.input-bordered.rounded-xl.w-full(
              type="number"
              min="1"
              v-model.number="form.value"
              :placeholder="form.type === 'percent' ? '15' : '500'"
            )

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label {{ $t('admin.promocodes.startsLabel') }}
            input.input.input-bordered.rounded-xl.w-full(type="date" v-model="form.startsAt")

          label.block
            span.form-label {{ $t('admin.promocodes.expiresLabel') }}
            input.input.input-bordered.rounded-xl.w-full(type="date" v-model="form.expiresAt")

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label {{ $t('admin.promocodes.usageLimitLabel') }}
            input.input.input-bordered.rounded-xl.w-full(
              type="number"
              min="1"
              v-model.number="form.usageLimit"
              placeholder="100"
            )

          label.block
            span.form-label {{ $t('admin.promocodes.userLimitLabel') }}
            input.input.input-bordered.rounded-xl.w-full(
              type="number"
              min="1"
              v-model.number="form.usageLimitPerUser"
              :placeholder="$t('admin.promocodes.userLimitHint')"
            )

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label {{ $t('admin.promocodes.minSubtotalLabel') }}
            input.input.input-bordered.rounded-xl.w-full(
              type="number"
              min="1"
              v-model.number="form.minSubtotal"
              :placeholder="$t('admin.promocodes.minSubtotalHint')"
            )

          label.block
            span.form-label {{ $t('admin.promocodes.categoryLabel') }}
            select.select.select-bordered.rounded-xl.w-full(v-model="form.category")
              option(value="") {{ $t('admin.promocodes.categoryAny') }}
              option(v-for="c in catalogCategories" :key="c" :value="c") {{ c }}

        label.block.mb-3.cursor-pointer
          .flex.items-center.gap-3
            input.toggle.toggle-primary(type="checkbox" v-model="form.stackableWithPromos")
            span.text-sm {{ $t('admin.promocodes.stackLabel') }}
          span.block.text-xs(class="text-base-content/50") {{ $t('admin.promocodes.stackHint') }}

        //- Цель-товары: пикер как в новостях (чипы выбранных + селект свободных)
        div
          span.form-label {{ $t('admin.promocodes.productsLabel') }}
          .flex.flex-col.gap-2(class="sm:flex-row")
            select.select.select-bordered.rounded-xl.w-full(v-model="pickedProductId")
              option(value="" disabled) {{ $t('admin.promocodes.selectProduct') }}
              option(v-for="p in availableProducts" :key="p.id" :value="p.id") {{ p.name }} · {{ formatMoney(p.price) }}
            button.btn.btn-outline.btn-sm.rounded-xl(
              type="button"
              :disabled="!pickedProductId"
              @click="addProduct"
            ) {{ $t('admin.common.add') }}
          .chosen-list.mt-2(v-if="form.productIds.length")
            .chosen-chip(v-for="id in form.productIds" :key="id")
              span.chosen-name {{ productById(id)?.name || `id ${id}` }}
              button.chosen-remove(type="button" :aria-label="$t('admin.promocodes.removeProductAria', { id })" @click="removeProduct(id)") ✕

        label.block.mb-3
          span.form-label {{ $t('admin.promocodes.noteLabel') }}
          input.input.input-bordered.rounded-xl.w-full(
            type="text"
            v-model.trim="form.description"
            :placeholder="$t('admin.promocodes.notePlaceholder')"
            maxlength="200"
          )

        label.block.cursor-pointer
          .flex.items-center.gap-3
            input.toggle.toggle-primary(type="checkbox" v-model="form.active")
            span.text-sm {{ form.active ? $t('admin.promocodes.activeOn') : $t('admin.promocodes.activeOff') }}

        p.form-error(v-if="formError" role="alert") {{ formError }}

        .modal-action
          button.btn.rounded-xl(type="button" :disabled="saving" @click="closeForm") {{ $t('admin.common.cancel') }}
          button.btn.btn-primary.rounded-xl(type="submit" :disabled="saving")
            span.loading.loading-spinner.loading-xs(v-if="saving")
            | {{ isNew ? $t('admin.common.add') : $t('admin.common.save') }}
</template>

<script setup>
const { $notify } = useNuxtApp()
const { t, locale } = useI18n()
// Локализация серверных ошибок по кодам (server.* в словарях)
const { serverMessage } = useServerMessage()
// Валюта витрины — единые formatMoney/currencySymbol (₽ / $ из store.config)
const { formatMoney, currencySymbol } = useProductUtils()

const items = ref([])
const isLoading = ref(false)
const loadError = ref(false)
const busyId = ref(null)
const activeCount = computed(() => items.value.filter((p) => p.active).length)

//- Форма
const showForm = ref(false)
const isNew = ref(true)
const saving = ref(false)
const formError = ref('')
const form = ref({
  id: null,
  code: '',
  type: 'percent',
  value: 10,
  startsAt: '',
  expiresAt: '',
  minSubtotal: null,
  usageLimit: null,
  usageLimitPerUser: null,
  stackableWithPromos: true,
  productIds: [],
  category: '',
  description: '',
  active: true,
})

//- Каталог для пикера товаров-целей и категорий: админский raw-рид
//- (базовые цены, без акций — форма редактирует справочник). Не
//- блокирует список — грузится на фон; сбой — пикер просто пуст.
const catalog = ref([])
const loadCatalog = async () => {
  try {
    const list = await $fetch('/api/products?raw=1')
    catalog.value = Array.isArray(list) ? list : []
  } catch {
    catalog.value = []
  }
}
const catalogCategories = computed(() =>
  [...new Set(catalog.value.flatMap((p) => p.categories || []))].sort(),
)

//- Пикер товаров-целей: чипы выбранных + селект свободных (как в новостях)
const pickedProductId = ref('')
const productById = (id) => catalog.value.find((p) => String(p.id) === String(id))
const availableProducts = computed(() =>
  catalog.value.filter((p) => !form.value.productIds.includes(String(p.id))),
)
const addProduct = () => {
  const id = String(pickedProductId.value || '')
  if (!id || form.value.productIds.includes(id)) return
  form.value.productIds.push(id)
  pickedProductId.value = ''
}
const removeProduct = (id) => {
  form.value.productIds = form.value.productIds.filter((x) => x !== id)
}

/** Человекочитаемая цель: весь заказ / категория / товары. */
const scopeInfo = (p) => {
  const parts = []
  if (p.category) parts.push(t('admin.promocodes.scopeCategory', { cat: p.category }))
  if (Array.isArray(p.productIds) && p.productIds.length) {
    parts.push(t('admin.promocodes.scopeProducts', { n: p.productIds.length }))
  }
  return parts.length ? parts.join(', ') : t('admin.promocodes.scopeAll')
}

const isExpired = (p) => Boolean(p.expiresAt) && new Date(p.expiresAt).getTime() < Date.now()
const isLimitReached = (p) =>
  p.usageLimit != null && (p.usedCount || 0) >= p.usageLimit

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(locale.value === 'en' ? 'en-US' : locale.value === 'es' ? 'es-ES' : 'ru-RU')
  } catch {
    return iso
  }
}

const load = async () => {
  isLoading.value = true
  loadError.value = false
  try {
    const resp = await $fetch('/api/admin/promocodes')
    items.value = Array.isArray(resp?.promos) ? resp.promos : []
  } catch {
    loadError.value = true
    $notify.error(t('admin.promocodes.loadError'))
  } finally {
    isLoading.value = false
  }
}

const openCreate = () => {
  isNew.value = true
  form.value = {
    id: null,
    code: '',
    type: 'percent',
    value: 10,
    startsAt: '',
    expiresAt: '',
    minSubtotal: null,
    usageLimit: null,
    usageLimitPerUser: null,
    stackableWithPromos: true,
    productIds: [],
    category: '',
    description: '',
    active: true,
  }
  formError.value = ''
  showForm.value = true
}

const openEdit = (promo) => {
  isNew.value = false
  form.value = {
    id: promo.id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    // input[type=date] принимает только YYYY-MM-DD — отрезаем время
    startsAt: promo.startsAt ? String(promo.startsAt).slice(0, 10) : '',
    expiresAt: promo.expiresAt ? String(promo.expiresAt).slice(0, 10) : '',
    minSubtotal: promo.minSubtotal ?? null,
    usageLimit: promo.usageLimit ?? null,
    usageLimitPerUser: promo.usageLimitPerUser ?? null,
    stackableWithPromos: promo.stackableWithPromos !== false,
    productIds: Array.isArray(promo.productIds) ? promo.productIds.map(String) : [],
    category: promo.category || '',
    description: promo.description || '',
    active: promo.active,
  }
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  if (saving.value) return
  showForm.value = false
}

const save = async () => {
  formError.value = ''
  if (!form.value.code.trim()) {
    formError.value = t('admin.promocodes.codeRequired')
    return
  }
  if (!form.value.value || form.value.value < 1) {
    formError.value = form.value.type === 'percent' ? t('admin.promocodes.percentMin') : t('admin.promocodes.fixedMin', { cur: currencySymbol() })
    return
  }

  saving.value = true
  try {
    const payload = {
      code: form.value.code,
      type: form.value.type,
      value: form.value.value,
      startsAt: form.value.startsAt || null,
      expiresAt: form.value.expiresAt || null,
      minSubtotal: form.value.minSubtotal || null,
      usageLimit: form.value.usageLimit || null,
      usageLimitPerUser: form.value.usageLimitPerUser || null,
      stackableWithPromos: form.value.stackableWithPromos,
      productIds: form.value.productIds.length ? form.value.productIds : null,
      category: form.value.category || null,
      description: form.value.description,
      active: form.value.active,
    }
    const resp = isNew.value
      ? await $fetch('/api/admin/promocodes', { method: 'POST', body: payload })
      : await $fetch(`/api/admin/promocodes/${form.value.id}`, { method: 'PUT', body: payload })
    // Серверное сообщение дублирует словарь — показываем локализованный текст
    $notify.success(t('admin.common.saved'))
    showForm.value = false
    await load()
  } catch (error) {
    // Код сервера (managerRequired/bulkNoIds/…) → server.*
    const message = serverMessage(error, 'admin.promocodes.saveError')
    formError.value = message
    $notify.error(message)
  } finally {
    saving.value = false
  }
}

const toggleActive = async (promo) => {
  busyId.value = promo.id
  try {
    const resp = await $fetch(`/api/admin/promocodes/${promo.id}`, {
      method: 'PUT',
      body: {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        startsAt: promo.startsAt,
        expiresAt: promo.expiresAt,
        minSubtotal: promo.minSubtotal,
        usageLimit: promo.usageLimit,
        usageLimitPerUser: promo.usageLimitPerUser,
        stackableWithPromos: promo.stackableWithPromos !== false,
        productIds: promo.productIds,
        category: promo.category,
        description: promo.description,
        active: !promo.active,
      },
    })
    $notify.success(promo.active ? t('admin.promocodes.turnedOff') : t('admin.promocodes.turnedOn'))
    await load()
  } catch (error) {
    $notify.error(serverMessage(error, 'admin.promocodes.saveError'))
  } finally {
    busyId.value = null
  }
}

const remove = async (promo) => {
  if (!confirm(t('admin.promocodes.deleteConfirm', { code: promo.code }))) return
  busyId.value = promo.id
  try {
    const resp = await $fetch(`/api/admin/promocodes/${promo.id}`, { method: 'DELETE' })
    $notify.success(t('admin.promocodes.deleted'))
    await load()
  } catch {
    $notify.error(t('admin.promocodes.deleteError'))
  } finally {
    busyId.value = null
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

.form-error {
  margin-top: 0.875rem;
  font-size: 0.875rem;
  color: var(--color-error);
}
</style>
