<!-- app/components/admin/AdminBulkEditModal.vue -->
<!-- Диалог массового изменения выбранных товаров.
     Наличие: не менять / в наличии (опционально одинаковое количество) / нет.
     Категории: не менять / добавить к текущим / заменить все / убрать из текущих
     (AdminCategoryPicker с подсказками — как в модалках товара).
     Инвариант «хотя бы одна категория» проверяется на клиенте: «убрать»,
     опустошающее список какого-то товара, блокируется с объяснением;
     сервер страхует тем же правилом (bulk.patch.js → skipped). -->
<template lang="pug">
.modal(v-if="isOpen" class="modal-open")
  .modal-box.max-w-lg.w-full.max-h-screen.p-4.overflow-y-auto(class="sm:p-5")
    button.btn.btn-xs.btn-circle.btn-ghost.absolute.right-2.top-2(
      @click="handleCancel"
      :disabled="isSubmitting"
      aria-label="Закрыть"
      type="button"
    ) ✕

    h3.text-base.font-bold(class="sm:text-lg") Массовое изменение
    p.text-sm.opacity-70 Товаров выбрано: {{ products.length }}

    form(@submit.prevent="handleSubmit")
      //- Наличие
      .mb-4
        .label-text.text-xs.font-semibold.mb-1 Наличие
        .flex.flex-col(class="gap-1.5")
          label.flex.items-center.gap-2.cursor-pointer.text-sm
            input.radio.radio-primary.radio-xs(
              type="radio"
              name="bulk-availability"
              value="keep"
              v-model="availabilityMode"
              :disabled="isSubmitting"
            )
            | Не менять
          label.flex.items-center.gap-2.cursor-pointer.text-sm
            input.radio.radio-primary.radio-xs(
              type="radio"
              name="bulk-availability"
              value="in"
              v-model="availabilityMode"
              :disabled="isSubmitting"
            )
            | В наличии
          label.flex.items-center.gap-2.cursor-pointer.text-sm
            input.radio.radio-primary.radio-xs(
              type="radio"
              name="bulk-availability"
              value="out"
              v-model="availabilityMode"
              :disabled="isSubmitting"
            )
            | Нет в наличии

        .mt-2(v-if="availabilityMode === 'in'")
          input.input.input-bordered.input-sm.w-full(
            type="number"
            min="0"
            step="1"
            v-model.number="stockQuantity"
            placeholder="Количество (пусто — оставить текущее)"
            :disabled="isSubmitting"
          )
          .text-xs.opacity-60.mt-1 У товаров с нулевым количеством будет проставлено 1

      //- Категории
      .mb-2
        .label-text.text-xs.font-semibold.mb-1 Категории
        select.select.select-bordered.select-sm.w-full(
          v-model="categoriesMode"
          :disabled="isSubmitting"
          aria-label="Режим изменения категорий"
        )
          option(value="keep") Не менять
          option(value="add") Добавить к текущим
          option(value="replace") Заменить все
          option(value="remove") Убрать из текущих

        .mt-2(v-if="categoriesMode !== 'keep'")
          AdminCategoryPicker(
            v-model="categories"
            :allCategories="allCategories"
            :disabled="isSubmitting"
            :error="categoriesEmpty"
            :placeholder="categoriesPlaceholder"
          )
          .text-xs.text-error.mt-1(v-if="categoriesEmpty") Укажите хотя бы одну категорию

      //- Предупреждение: «убрать» опустошает категории у части выбранных
      .alert.alert-warning.p-2.text-xs.mt-2(v-if="emptyAfterRemoval > 0")
        span У {{ emptyAfterRemoval }} товар(ов) после удаления этих категорий не останется ни одной. Уберите меньше или сначала добавьте другие.

      .alert.alert-error.p-2.text-xs.mt-2(v-if="formError") {{ formError }}

      .modal-action.mt-4
        button.btn.btn-ghost.btn-sm(
          type="button"
          @click="handleCancel"
          :disabled="isSubmitting"
        ) Отмена
        button.btn.btn-primary.btn-sm(
          type="submit"
          :disabled="isSubmitting || !canApply"
        )
          span.loading.loading-spinner.loading-xs.mr-1(v-if="isSubmitting")
          | {{ isSubmitting ? 'Применение…' : `Применить (${products.length})` }}
</template>

<script setup>
// ============================================
// Компонент: AdminBulkEditModal
// Массовое изменение выбранных товаров одним PATCH-запросом.
// Пустое поле количества = «количество не менять»: сервер тогда
// проставляет «в наличии» с количеством 1 тем, у кого был 0
// (инвариант inStock = stockQuantity > 0 соблюдается на сервере).
// ============================================
const { bulkUpdateProducts } = useProducts()
const notify = useNotifyQueue()

const props = defineProps({
  isOpen: Boolean,
  // Сами объекты выбранных товаров — нужны для проверки
  // «после уборки категорий список опустеет»
  products: { type: Array, default: () => [] },
  allCategories: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:isOpen', 'applied'])

const availabilityMode = ref('keep')
const stockQuantity = ref(null)
const categoriesMode = ref('keep')
const categories = ref([])
const isSubmitting = ref(false)
const formError = ref('')

const categoriesEmpty = computed(
  () => categoriesMode.value !== 'keep' && categories.value.length === 0
)

// Сколько выбранных товаров останутся без категорий при текущем наборе «убрать»
const emptyAfterRemoval = computed(() => {
  if (categoriesMode.value !== 'remove' || categories.value.length === 0) return 0
  return props.products.filter((p) => {
    const rest = (p.categories || []).filter((c) => !categories.value.includes(c))
    return rest.length === 0
  }).length
})

const hasChanges = computed(
  () =>
    availabilityMode.value !== 'keep' ||
    (categoriesMode.value !== 'keep' && categories.value.length > 0)
)

const canApply = computed(
  () => hasChanges.value && !categoriesEmpty.value && emptyAfterRemoval.value === 0
)

const categoriesPlaceholder = computed(
  () =>
    ({
      add: 'Какие категории добавить',
      replace: 'Новый список категорий',
      remove: 'Какие категории убрать'
    })[categoriesMode.value] || ''
)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      availabilityMode.value = 'keep'
      stockQuantity.value = null
      categoriesMode.value = 'keep'
      categories.value = []
      isSubmitting.value = false
      formError.value = ''
    }
  }
)

const handleCancel = () => {
  if (!isSubmitting.value) emit('update:isOpen', false)
}

const handleSubmit = async () => {
  if (!canApply.value || isSubmitting.value) return

  formError.value = ''
  isSubmitting.value = true

  try {
    const patch = {}

    if (availabilityMode.value === 'in') {
      patch.inStock = true
      const q = Number(stockQuantity.value)
      if (stockQuantity.value !== null && stockQuantity.value !== '' && Number.isFinite(q) && q >= 0) {
        patch.stockQuantity = q
      }
    } else if (availabilityMode.value === 'out') {
      patch.inStock = false
    }

    if (categoriesMode.value === 'add') patch.addCategories = [...categories.value]
    if (categoriesMode.value === 'replace') patch.setCategories = [...categories.value]
    if (categoriesMode.value === 'remove') patch.removeCategories = [...categories.value]

    const ids = props.products.map((p) => p.id)
    const result = await bulkUpdateProducts(ids, patch)

    notify.success(result.message || 'Обновлено')
    if (result.skippedCount > 0) {
      notify.info(`Пропущено ${result.skippedCount}: остались бы без категорий`)
    }
    emit('applied', result)
  } catch (error) {
    // ofetch кладёт тело ответа в error.data — там текст ошибки сервера
    formError.value = error?.data?.message || error.message || 'Ошибка'
  } finally {
    isSubmitting.value = false
  }
}
</script>
