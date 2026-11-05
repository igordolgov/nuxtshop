<template lang="pug">
.product-info
  .card.bg-base-100(class="lg:shadow-none")
    .card-body.p-3.gap-3(class="lg:p-0")
      //- Заголовок и избранное/сравнение
      .flex.justify-between.items-start.gap-3
        h1.text-xl.font-semibold.text-base-content.leading-snug(class="lg:text-2xl") {{ product.name }}
        ClientOnly
          .flex.shrink-0.gap-2
            //- Тач-цель 40px (size-10), иконка /70 вместо полупрозрачной /50 —
            //- на белом фоне выглядели бледно (аудит F6)
            button.size-10.rounded-full.flex.items-center.justify-center.border.transition-colors(
              :class="isComparedNow ? 'bg-primary text-primary-content border-primary' : 'border-base-300 text-base-content/70 hover:text-primary hover:border-primary/40'"
              :title="$t('compare.toggleAria')"
              :aria-label="$t('compare.toggleAria')"
              @click="onCompareClick"
            )
              icon(name="heroicons:arrows-right-left" size="20")
            //- bg-heart (токен main.css): одинаковый глубокий красный на обеих
            //- темах — как на светлой; bg-error на тёмной лососевый (WCAG-текст)
            button.shrink-0.size-10.rounded-full.flex.items-center.justify-center.border.transition-colors(
              :class="[isFavorite ? 'bg-heart text-white border-heart' : 'border-base-300 text-base-content/70 hover:text-error hover:border-error/40', { 'fav-pop': isFavorite }]"
              @click="$emit('toggle-favorite')"
              :title="isFavorite ? $t('product.favRemove') : $t('product.favAdd')"
            )
              svg.w-5.h-5(
                :class="isFavorite ? 'fill-current' : 'fill-none stroke-current'"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                stroke-width="1.5"
              )
                path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")

      //- Категории
      .flex.flex-wrap.gap-2(v-if="product.categories?.length")
        span.px-2.py-1.rounded-full.text-xs.border.border-base-300(
          v-for="category in product.categories"
          :key="category"
          class="text-base-content/80"
        ) {{ category }}

      //- Сводка рейтинга: якорь на блок отзывов (#reviews ниже по странице)
      a.rating-summary.inline-flex.items-center.gap-1.text-sm(
        v-if="(rating?.count ?? 0) > 0"
        href="#reviews"
      )
        span.text-warning(aria-hidden="true") ★
        span.font-medium {{ ratingAverage }}
        span(class="text-base-content/50") · {{ ratingCountLabel }}

      //- Описание
      p.text-sm.leading-relaxed(class="text-base-content/85") {{ product.description }}

      //- Цена и наличие (у варианта — своя цена/склад, этап «варианты»).
      //- Скидка (oldPrice) — только у базовой цены: у варианта со своей
      //- ценой соответствие oldPrice не гарантировано (baseDiscount).
      .flex.items-end.justify-between.gap-4.py-1
        //- min-w-0: секция цены может сжиматься, старая цена/бейдж
        //- переносятся на следующую строку (flex-wrap внутри)
        .price-section.min-w-0
          .flex.flex-wrap.items-baseline(class="gap-x-2 gap-y-0.5")
            //- Цена на мобильном мельче (text-2xl), чтобы плашки наличия
            //- и остатка справа гарантированно умещались в одну строку
            .font-bold.text-base-content(class="text-2xl sm:text-3xl") {{ formatPrice(currentPrice) }} ₽
            span.line-through(
              v-if="baseDiscount",
              class="text-base-content/45 text-lg sm:text-xl"
            ) {{ formatPrice(product.oldPrice) }} ₽
            //- Плашка скидки: единый вид с ProductCardGrid/ProductCardList
            span.shrink-0(
              v-if="baseDiscount",
              class="inline-flex items-center bg-red-700 px-1.5 pt-px pb-0.5 rounded-md font-bold text-white text-base leading-5"
            ) −{{ discountPercent(product) }}%
          .text-xs.mt-1(class="text-base-content/70") {{ $t('product.vatIncluded') }}

        //- shrink-0: плашка наличия не сжимается — текст всегда в одну строку
        .stock-section.text-right.shrink-0
          .inline-flex.items-center.gap-2.px-3.py-1.rounded-full.text-xs.font-medium.whitespace-nowrap.shrink-0(
            :class="currentStock.inStock ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
          )
            span.size-2.rounded-full(:class="currentStock.inStock ? 'bg-success' : 'bg-error'")
            span(v-if="currentStock.inStock") {{ $t('product.inStock') }}
            span(v-else) {{ $t('product.outOfStock') }}

          .text-xs.mt-1(
            v-if="currentStock.inStock && currentStock.stockQuantity",
            :class="isLowStock ? 'text-warning font-medium' : 'text-base-content/70'"
          ) {{ $t('product.left', currentStock.stockQuantity) }}

      //- Нет в наличии: заявка «сообщить о поступлении» (email или телефон)
      .stock-alert(v-if="!currentStock.inStock")
        button.btn.btn-outline.btn-sm.rounded-xl.w-full(
          v-if="alertState === 'idle'"
          type="button"
          @click="alertState = 'form'"
        )
          span.flex.items-center.justify-center.gap-2
            svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
              path(stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9")
            | {{ $t('product.notifyMe') }}
        form.stock-alert-form(v-else-if="alertState === 'form'" @submit.prevent="submitAlert" novalidate)
          .flex.gap-2
            input.input.input-bordered.input-sm.rounded-xl.flex-1.min-w-0(
              type="text"
              v-model.trim="alertContact"
              :placeholder="$t('product.notifyContactPh')"
              maxlength="120"
              autocomplete="email"
            )
            button.btn.btn-primary.btn-sm.rounded-xl.shrink-0(type="submit" :disabled="alertBusy")
              span.loading.loading-spinner.loading-xs(v-if="alertBusy")
              | {{ $t('product.notifySend') }}
          //- Honeypot: обычному покупателю не виден
          input.hidden(type="text" tabindex="-1" autocomplete="off" v-model="alertWebsite" aria-hidden="true")
          p.text-xs(class="mt-1.5 text-base-content/50") {{ $t('product.notifyHint') }}
          p.form-error(v-if="alertError" role="alert") {{ alertError }}
        .alert-done.inline-flex.items-center.gap-2.text-sm.text-success(v-else)
          svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2")
            path(stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7")
          | {{ $t('product.notifyDone') }}

      //- Варианты (цвет/память/размер): пилюли под ценой. Выбранный
      //- вариант определяет цену/склад/картинку и уходит в корзину;
      //- недоступные (свой нулевой склад) задизейблены. SSR-safe:
      //- дефолт — первый вариант (детерминирован на сервере и клиенте).
      .variant-picker(v-if="hasVariants")
        .text-xs.font-medium(class="mb-1.5 text-base-content/70")
          | {{ variantLabel }}:
        .flex.flex-wrap.gap-2(role="radiogroup" :aria-label="variantLabel")
          button.variant-pill.rounded-full.text-sm.border.transition-colors(
            class="px-3 py-1.5",
            v-for="v in product.variants",
            :key="v.id",
            type="button",
            role="radio",
            :aria-checked="v.id === selectedVariantId",
            :disabled="!variantAvailable(v)",
            :class="variantPillClass(v)",
            @click="$emit('update:selectedVariantId', v.id)"
          ) {{ localizedVariantTitle(v) }}

      //- Десктопная кнопка
      .hidden(class="lg:block" :class="currentInCart ? 'b' : ''")
        button.btn.w-full.btn-lg.rounded-xl.border-0(
          :disabled="!currentStock.inStock || currentInCart"
          @click="$emit('add-to-cart', { variant: selectedVariant })"
          :class="currentInCart ? 'btn-success text-success-content' : (currentStock.inStock ? 'btn-primary' : 'btn-oos')"
        )
          span.flex.items-center.justify-center.gap-2.w-full
            span
              span(v-if="currentInCart") {{ $t('product.alreadyInCart') }}
              span(v-else-if="currentStock.inStock") {{ $t('product.addToCart') }}
              span(v-else) {{ $t('product.soldOut') }}
            span.font-normal.opacity-80(v-if="!currentInCart && currentStock.inStock") · {{ formatPrice(currentPrice) }} ₽

      //- Характеристики: spec-лист из админки + варианты + служебные строки.
      //- Открыт по умолчанию, когда spec-лист заполнен (иначе раздел из 4
      //- строк остаётся свёрнутым); в заголовке — число строк.
      .rounded-2xl.border.border-base-300.overflow-hidden
        details.group(:open="hasCharacteristics")
          summary.cursor-pointer.list-none.px-4.py-3.text-sm.font-medium.flex.items-center.justify-between
            span
              | {{ $t('product.characteristics') }}
              span(v-if="specsRowCount > 0" class="text-base-content/50") · {{ specsRowCount }}
            svg.w-4.h-4.transition-transform(
              class="text-base-content/75 group-open:rotate-180"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"
            )
              path(stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7")
          .px-4.pb-4.pt-0.space-y-0.text-sm.border-t.border-base-300.grid(class="lg:gap-x-10 lg:grid-cols-2")
            //- Характеристики товара (порядок — как задано в админке)
            .flex.justify-between.gap-3.py-1(
              v-for="([label, value], index) in characteristicEntries"
              :key="label"
              :class="index > 0 ? 'border-t border-base-200' : ''"
            )
              span.shrink-0(class="text-base-content/70") {{ localizedSpecLabel(label) }}
              span.font-medium.text-right.min-w-0 {{ value }}
            //- Варианты: ось и доступные значения (как пилюли выше)
            .flex.justify-between.gap-3.py-2.border-t.border-base-200(v-if="variantsRowValue")
              span.shrink-0(class="text-base-content/70") {{ variantLabel }}
              span.font-medium.text-right.min-w-0 {{ variantsRowValue }}
            .flex.justify-between.py-2.border-t.border-base-200
              span(class="text-base-content/70") {{ $t('catalog.categories') }}
              span.font-medium.text-right {{ product.categories?.join(', ') }}
            .flex.justify-between.py-2.border-t.border-base-200
              span(class="text-base-content/70") {{ $t('product.sku') }}
              span.font-medium {{ product.id }}
            .flex.justify-between.py-2.border-t.border-base-200
              span(class="text-base-content/70") {{ $t('product.status') }}
              span.font-medium(
                :class="currentStock.inStock ? 'text-success' : 'text-error'"
              ) {{ currentStock.inStock ? $t('product.statusAvailable') : $t('product.statusUnavailable') }}
            //- .flex.justify-between.py-2.border-t.border-base-200
            //-   span(class="text-base-content/70") {{ $t('product.dateAdded') }}
            //-   span.font-medium {{ formatDate(product.createdAt) }}
</template>

<script setup>
// Варианты: чистые хелперы (составной id позиции, цена/склад, локализация)
import {
  hasVariants as hasVariantsOf,
  findVariant,
  variantPrice,
  variantStock,
  cartLineId,
  localizedVariantName,
  localizedVariantLabel,
} from '~/utils/productVariants'
// Лейблы характеристик: известные (пресеты/сиды) переводятся на en/es
import { CHARACTERISTIC_LABEL_KEYS } from '~/utils/characteristicLabels'

const { t, locale } = useI18n()
const props = defineProps({
  product: { type: Object, required: true },
  isInCart: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
  // Сводка рейтинга { count, average } — приходит с /api/product/[slug]
  rating: { type: Object, default: null },
  // Выбранный вариант (id) — состояние держит родитель ([slug].vue):
  // мобильная нижняя CTA добавляет ТОТ ЖЕ вариант, что и пилюли здесь
  selectedVariantId: { type: String, default: null }
})

const emit = defineEmits(['toggle-favorite', 'add-to-cart', 'update:selectedVariantId'])
void emit

const { $notify } = useNuxtApp()
// formatPrice — единый из useProductUtils (₽ добавляется в шаблоне, аудит F13)
const { formatPrice } = useProductUtils()

//- ── Варианты (цвет/память/размер) ─────────────────────────────────────
// Чистые хелперы из utils/productVariants.js; cartItems — прямой доступ
// к синглтону корзины: CTA должна знать о позиции ИМЕННО выбранного
// варианта (проп isInCart проверяет товар в целом — этого мало).
const { cartItems } = useCart()

const hasVariants = computed(() => hasVariantsOf(props.product))
const selectedVariant = computed(() => findVariant(props.product, props.selectedVariantId))
const currentPrice = computed(() => variantPrice(props.product, selectedVariant.value))
const currentStock = computed(() => variantStock(props.product, selectedVariant.value))
//- Скидка базовой цены: показываем только когда отображается база
//- (без варианта или у варианта нет своей цены) — иначе сравнение
//- с oldPrice было бы неверным
const baseDiscount = computed(
  () =>
    hasDiscount(props.product) &&
    variantPrice(props.product, selectedVariant.value) === props.product.price,
)
const variantLabel = computed(() => localizedVariantLabel(props.product, locale.value))
const localizedVariantTitle = (v) => localizedVariantName(v, locale.value)

//- ── Характеристики (spec-лист карточки) ─────────────────────────
//- Record «название — значение» из админки; на en/es значения фолбэкаются
//- на русский (контракт локализации товара — переводы опциональны)
const characteristicEntries = computed(() =>
  Object.entries(props.product?.characteristics || {}),
)
//- Лейбл на витрине: известный (пресет/сид) — словарь specLabels.* на en/es,
//- кастомный — как есть (фолбэк-контракт локализации товара)
const localizedSpecLabel = (label) => {
  const key = CHARACTERISTIC_LABEL_KEYS[label]
  return key ? t(`specLabels.${key}`) : label
}
const hasCharacteristics = computed(() => characteristicEntries.value.length > 0)
//- Строка «Варианты» в spec-листе: ось и все значения через запятую
const variantsRowValue = computed(() => {
  const variants = props.product?.variants
  if (!variants?.length) return ''
  return variants.map((v) => localizedVariantName(v, locale.value)).join(', ')
})
//- Всего строк в раскрытом списке (для счётчика в заголовке):
//- характеристики + варианты + 4 служебные (категории/код/статус/дата)
const specsRowCount = computed(
  () => characteristicEntries.value.length + (variantsRowValue.value ? 1 : 0) + 4,
)
/** Вариант доступен для покупки (свой склад/наследованный). */
const variantAvailable = (v) => variantStock(props.product, v).inStock
/** Класс пилюли: выбранная — primary-заливка, остальные — нейтральные */
const variantPillClass = (v) =>
  v.id === props.selectedVariantId
    ? 'border-primary bg-primary/10 text-primary font-medium'
    : 'border-base-300 text-base-content/80 hover:border-base-content/40'
const currentInCart = computed(() => {
  if (!hasVariants.value) return props.isInCart
  const line = cartLineId(props.product?.id, selectedVariant.value?.id)
  return cartItems.value?.some((i) => i?.id === line) ?? false
})

//- ── Сравнение (ClientOnly в шаблоне: состояние после гидратации) ──────
const { isCompared, toggleCompare } = useCompare()
const isComparedNow = computed(() => isCompared(props.product.id))

const onCompareClick = (event) => {
  const status = toggleCompare(props.product)
  if (status === 'added') {
    $notify.success(t('compare.added'))
    // «Синяя точка» летит к бургеру/«Сравнению» в шапке (utils/compareFly.js)
    emitCompareFly(event?.currentTarget)
  }
  if (status === 'full') $notify.warning(t('compare.limit', { n: 4 }))
}

//- ── «Сообщить о поступлении»: idle → форма → готово ────────────────────
const alertState = ref('idle')
const alertContact = ref('')
const alertWebsite = ref('')
const alertBusy = ref(false)
const alertError = ref('')

// Переход на другой товар — сброс формы
watch(
  () => props.product?.id,
  () => {
    alertState.value = 'idle'
    alertContact.value = ''
    alertWebsite.value = ''
    alertError.value = ''
  },
)

const submitAlert = async () => {
  alertError.value = ''
  const c = alertContact.value
  const isEmail = c.includes('@')
  const digits = c.replace(/\D+/g, '')
  if (!c || (isEmail ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) : digits.length < 10)) {
    alertError.value = t('product.notifyErrContact')
    return
  }
  alertBusy.value = true
  try {
    const resp = await $fetch('/api/stock-alerts', {
      method: 'POST',
      body: {
        productId: String(props.product.id),
        contact: c,
        website: alertWebsite.value,
      },
    })
    alertState.value = 'done'
    $notify.success(resp?.message || t('product.notifyDone'))
  } catch (error) {
    const message = error?.data?.message || t('product.notifyError')
    alertError.value = message
  } finally {
    alertBusy.value = false
  }
}

//- Дефицитный остаток: тот же порог, что и в бейдже ProductCardGrid
const LOW_STOCK_THRESHOLD = 5
const isLowStock = computed(() => {
  const qty = Number(props.product?.stockQuantity)
  return (
    props.product?.inStock === true &&
    Number.isFinite(qty) &&
    qty > 0 &&
    qty <= LOW_STOCK_THRESHOLD
  )
})

//- Средняя оценка в локали (4,5 в ru/es, 4.5 в en)
const numberFormat = computed(() =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 })
)
const ratingAverage = computed(() => numberFormat.value.format(props.rating?.average ?? 0))
const ratingCountLabel = computed(() => t('reviews.count', props.rating?.count ?? 0))

const formatDate = (dateString) => {
  if (!dateString) return t('product.unknown')
  return new Date(dateString).toLocaleDateString('ru-RU')
}
</script>

<style scoped>
.product-info {
  width: 100%;
}

/* «Товар закончился»: НЕПРОЗРАЧНАЯ нейтральная кнопка. daisyUI красит
   .btn:disabled в opacity .5 — плашка почти сливалась с фоном. */
.btn-oos:disabled {
  opacity: 1;
  background-color: var(--color-base-200);
  color: var(--color-base-content);
  border: 1px solid var(--color-base-300);
}

details > summary::-webkit-details-marker {
  display: none;
}

/* Стрелка-раскрывашка: поворот делает утилита group-open:rotate-180 на svg
  (индивидуальное свойство rotate). Здесь transform: rotate() НЕ дублируем —
  rotate + transform складываются (360°), стрелка переставала крутиться. */

/* ─── Сообщить о поступлении ──────────────────────────────── */
.stock-alert {
  border: 1px dashed var(--color-base-300);
  border-radius: 0.75rem;
  padding: 0.75rem;
}

.form-error {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-error);
}
</style>