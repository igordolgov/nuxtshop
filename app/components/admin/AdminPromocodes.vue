<!-- ~/components/admin/AdminPromocodes.vue — управление промокодами
     (KV data:promocodes). CRUD через /api/admin/promocodes: список,
     создание/редактирование в модалке, вкл/выкл, удаление (confirm).
     Скидки считаются на сервере; здесь — только справочник кодов. -->
<template lang="pug">
.admin-promocodes
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content Промокоды
      p.text-sm(class="mt-0.5 text-base-content/60")
        | {{ isLoading ? 'Загрузка…' : `В системе: ${items.length} · активных: ${activeCount}` }}

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
        | Добавить промокод

  //- Скелетон
  .space-y-3(v-if="isLoading && !items.length")
    .skeleton.h-20.rounded-2xl(v-for="i in 4" :key="i")

  //- Ошибка загрузки
  .text-center.py-12(v-else-if="loadError")
    p(class="text-base-content/50 mb-4") Не удалось загрузить промокоды
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") Повторить

  //- Пусто
  .text-center.py-12(v-else-if="!items.length")
    p(class="text-base-content/50")
      | Промокодов пока нет. Добавьте первый — покупатели смогут применить его в корзине.

  //- Список (свежие сверху)
  .space-y-3(v-else)
    .promo-row.card.bg-base-100.shadow-sm(v-for="p in items" :key="p.id")
      .card-body.p-4.gap-2
        .flex.items-center.gap-2.flex-wrap
          span.font-bold.text-base.tracking-wide {{ p.code }}
          span.badge.badge-sm(:class="p.type === 'percent' ? 'badge-info' : 'badge-secondary'")
            | {{ p.type === 'percent' ? `${p.value}%` : `${p.value} ₽` }}
          span.badge.badge-sm(v-if="p.active" class="badge-success") Включён
          span.badge.badge-sm.badge-warning(v-else) Выключен
          span.badge.badge-sm.badge-error(
            v-if="isExpired(p) || isLimitReached(p)"
          ) {{ isExpired(p) ? 'Истёк' : 'Лимит исчерпан' }}
        .text-xs(class="text-base-content/60 flex flex-wrap gap-x-3 gap-y-0.5")
          span
            | Использован: {{ p.usedCount || 0 }}{{ p.usageLimit ? ` из ${p.usageLimit}` : ' (без лимита)' }}
          span(v-if="p.expiresAt") Действует до: {{ formatDate(p.expiresAt) }}
          span(v-else) Бессрочно
        p.text-xs(class="text-base-content/50" v-if="p.description") {{ p.description }}
        .flex.gap-2.justify-end.flex-wrap
          button.btn.btn-outline.btn-xs.rounded-lg(type="button" :disabled="busyId === p.id" @click="openEdit(p)") Изменить
          button.btn.btn-outline.btn-xs.rounded-lg(
            type="button"
            :disabled="busyId === p.id"
            @click="toggleActive(p)"
          ) {{ p.active ? 'Выключить' : 'Включить' }}
          button.btn.btn-outline.btn-xs.rounded-lg(
            type="button"
            class="hover:bg-error hover:text-error-content hover:border-error"
            :disabled="busyId === p.id"
            @click="remove(p)"
          ) Удалить

  //- Форма: создание / редактирование
  .modal(:class="{ 'modal-open': showForm }" role="dialog" aria-modal="true" @click.self="closeForm")
    .modal-box.max-w-2xl
      h3.font-semibold.text-lg.mb-4 {{ isNew ? 'Новый промокод' : 'Редактирование промокода' }}

      form(@submit.prevent="save" novalidate)
        label.block.mb-3
          span.form-label Код (покупатель введёт его в корзине)
          input.input.input-bordered.rounded-xl.w-full.uppercase(
            type="text"
            v-model.trim="form.code"
            placeholder="SUMMER15"
            maxlength="32"
            autocomplete="off"
          )

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label Тип скидки
            select.select.select-bordered.rounded-xl.w-full(v-model="form.type")
              option(value="percent") Процент (%)
              option(value="fixed") Фиксированная (₽)

          label.block
            span.form-label {{ form.type === 'percent' ? 'Процент (1–90)' : 'Сумма в рублях (до 10 000 000)' }}
            input.input.input-bordered.rounded-xl.w-full(
              type="number"
              min="1"
              v-model.number="form.value"
              :placeholder="form.type === 'percent' ? '15' : '500'"
            )

        .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
          label.block
            span.form-label Действует до (пусто — бессрочно)
            input.input.input-bordered.rounded-xl.w-full(type="date" v-model="form.expiresAt")

          label.block
            span.form-label Лимит применений (пусто — без лимита)
            input.input.input-bordered.rounded-xl.w-full(
              type="number"
              min="1"
              v-model.number="form.usageLimit"
              placeholder="100"
            )

        label.block.mb-3
          span.form-label Памятка для себя (до 200 символов)
          input.input.input-bordered.rounded-xl.w-full(
            type="text"
            v-model.trim="form.description"
            placeholder="Например: рассылка за сентябрь"
            maxlength="200"
          )

        label.block.cursor-pointer
          .flex.items-center.gap-3
            input.toggle.toggle-primary(type="checkbox" v-model="form.active")
            span.text-sm {{ form.active ? 'Включён — можно применить в корзине' : 'Выключен — код не принимается' }}

        p.form-error(v-if="formError" role="alert") {{ formError }}

        .modal-action
          button.btn.rounded-xl(type="button" :disabled="saving" @click="closeForm") Отмена
          button.btn.btn-primary.rounded-xl(type="submit" :disabled="saving")
            span.loading.loading-spinner.loading-xs(v-if="saving")
            | {{ isNew ? 'Добавить' : 'Сохранить' }}
</template>

<script setup>
const { $notify } = useNuxtApp()

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
  expiresAt: '',
  usageLimit: null,
  description: '',
  active: true,
})

const isExpired = (p) => Boolean(p.expiresAt) && new Date(p.expiresAt).getTime() < Date.now()
const isLimitReached = (p) =>
  p.usageLimit != null && (p.usedCount || 0) >= p.usageLimit

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('ru-RU')
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
    $notify.error('Не удалось загрузить промокоды')
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
    expiresAt: '',
    usageLimit: null,
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
    expiresAt: promo.expiresAt ? String(promo.expiresAt).slice(0, 10) : '',
    usageLimit: promo.usageLimit ?? null,
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
    formError.value = 'Введите код промокода'
    return
  }
  if (!form.value.value || form.value.value < 1) {
    formError.value = form.value.type === 'percent' ? 'Процент — от 1' : 'Сумма — от 1 ₽'
    return
  }

  saving.value = true
  try {
    const payload = {
      code: form.value.code,
      type: form.value.type,
      value: form.value.value,
      expiresAt: form.value.expiresAt || null,
      usageLimit: form.value.usageLimit || null,
      description: form.value.description,
      active: form.value.active,
    }
    const resp = isNew.value
      ? await $fetch('/api/admin/promocodes', { method: 'POST', body: payload })
      : await $fetch(`/api/admin/promocodes/${form.value.id}`, { method: 'PUT', body: payload })
    $notify.success(resp?.message || 'Сохранено')
    showForm.value = false
    await load()
  } catch (error) {
    const message = error?.data?.message || error?.message || 'Не удалось сохранить промокод'
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
        expiresAt: promo.expiresAt,
        usageLimit: promo.usageLimit,
        description: promo.description,
        active: !promo.active,
      },
    })
    $notify.success(resp?.message || (promo.active ? 'Промокод выключен' : 'Промокод включён'))
    await load()
  } catch (error) {
    $notify.error(error?.data?.message || 'Не удалось сохранить промокод')
  } finally {
    busyId.value = null
  }
}

const remove = async (promo) => {
  if (!confirm(`Удалить промокод ${promo.code}? Действие необратимо.`)) return
  busyId.value = promo.id
  try {
    const resp = await $fetch(`/api/admin/promocodes/${promo.id}`, { method: 'DELETE' })
    $notify.success(resp?.message || 'Промокод удалён')
    await load()
  } catch {
    $notify.error('Не удалось удалить промокод')
  } finally {
    busyId.value = null
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
