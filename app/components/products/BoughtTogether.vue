<!-- app/components/products/BoughtTogether.vue -->
<!-- «Часто покупают вместе» (Amazon Frequently Bought Together): товары из
  одних заказов (считает сервер в /api/product/[slug] → boughtTogether).
  Размещение — левая колонка карточки под галереей (grid-area similar,
  wrapper в pages/product/[slug].vue), над «Похожими».
  Amazon-паттерн: ПЕРВАЯ позиция — сам текущий товар (чекбокс отмечен и
  заблокирован — как у Amazon, убрать его нельзя), «Итого» = цена текущего
  товара (с выбранным вариантом — пропс current собирает страница) +
  отмеченные доп. товары. Кнопка «Добавить выбранные» отдаёт странице
  только доп. товары (add-selected) — текущий она добавляет сама, тем же
  вариантом, что и главная кнопка «В корзину». Доп. товары: всё доступное
  выбрано по умолчанию; недоступное (нет на складе) — чекбокс выключен и
  в итог не попадает. Без данных блок не рендерится (v-if ставит страница). -->
<template lang="pug">
.bought-together(
        class="mt-3 px-2 lg:mt-4 lg:px-3"
)
                h2.text-xl.font-semibold.mb-2(class="lg:mb-3 lg:text-2xl") {{ $t('product.boughtTogether') }}

                .card.bg-base-100.shadow-md.rounded-box.p-3(class="lg:p-4")
                        //- Горизонтальная лента чекбокс-позиций: на мобиле скроллится,
                        //- на lg помещается вся (3 позиции — лимит API)
                        .fbt-list.flex.items-start.gap-4(
                                class="overflow-x-auto lg:overflow-visible"
                        )
                                //- Текущий товар: чекбокс отмечен и заблокирован —
                                //- позиция всегда в «итого» (Amazon FBT), клик по нему
                                //- ничего не переключает
                                .fbt-item.flex.items-center.gap-2.shrink-0(
                                        v-if="current && current.name"
                                )
                                        input.checkbox.checkbox-primary.checkbox-sm(
                                                type="checkbox"
                                                :checked="current.inStock"
                                                :disabled="true"
                                                :aria-label="current.name"
                                        )
                                        NuxtImg.fbt-img.w-14.h-14.rounded.object-cover.shrink-0(
                                                :src="getValidImageUrl(current.image)"
                                                :srcset="productSrcset(getValidImageUrl(current.image))"
                                                :sizes="productSrcset(getValidImageUrl(current.image)) ? '(max-width: 767px) 30vw, 56px' : undefined"
                                                :alt="current.name"
                                                @error="handleImageError"
                                                draggable="false"
                                                loading="lazy"
                                                :width="400"
                                                :height="300"
                                        )
                                        .flex.flex-col.min-w-0(class="gap-0.5")
                                                span.text-xs.font-medium.text-base-content.line-clamp-2 {{ current.name }}
                                                span.text-sm.font-bold.text-primary {{ formatMoney(current.price) }}
                                                span.text-xs(
                                                        :class="current.inStock ? 'text-success' : 'text-error'"
                                                ) {{ current.inStock ? $t('product.inStock') : $t('product.soldOut') }}

                                label.fbt-item.flex.items-center.gap-2.shrink-0.cursor-pointer(
                                        v-for="item in localizedProducts"
                                        :key="item.id"
                                )
                                        input.checkbox.checkbox-primary.checkbox-sm(
                                                type="checkbox"
                                                :value="String(item.id)"
                                                v-model="selectedIds"
                                                :disabled="!item.inStock"
                                                :aria-label="item.name"
                                        )
                                        NuxtImg.fbt-img.w-14.h-14.rounded.object-cover.shrink-0(
                                                :src="getValidImageUrl(item.image)"
                                                :srcset="productSrcset(getValidImageUrl(item.image))"
                                                :sizes="productSrcset(getValidImageUrl(item.image)) ? '(max-width: 767px) 30vw, 56px' : undefined"
                                                :alt="item.name"
                                                @error="handleImageError"
                                                draggable="false"
                                                loading="lazy"
                                                :width="400"
                                                :height="300"
                                        )
                                        .flex.flex-col.min-w-0(class="gap-0.5")
                                                span.text-xs.font-medium.text-base-content.line-clamp-2 {{ item.name }}
                                                span.text-sm.font-bold.text-primary {{ formatMoney(item.price) }}
                                                span.text-xs(
                                                        :class="item.inStock ? 'text-success' : 'text-error'"
                                                ) {{ item.inStock ? $t('product.inStock') : $t('product.soldOut') }}

                        .divider.my-2

                        //- Итого: текущий товар (если в наличии) + отмеченные доп.
                        //- Копия Amazon «Total price / Add all»
                        .flex.items-center.justify-between.gap-3
                                .flex.items-baseline.gap-2.min-w-0
                                        span.text-sm.opacity-70 {{ $t('product.fbtTotal') }}:
                                        span.font-bold.text-primary.text-lg {{ formatMoney(total) }}
                                button.btn.btn-sm.btn-primary.rounded-xl(
                                        :disabled="!canAdd"
                                        @click="onAddSelected"
                                ) {{ $t('product.fbtAddSelected') }}
</template>

<script setup>
const props = defineProps({
        products: { type: Array, default: () => [] },
        // Текущий товар карточки с ценой ВЫБРАННОГО варианта (страница
        // собирает: { id, name, price, image, inStock }). null — нет.
        current: { type: Object, default: null },
})

const emit = defineEmits(['add-selected'])

// Локализованные копии: имя/описание в языке страницы (исходный пропс
// не мутируется) — паттерн SimilarProducts
const { loc } = useLocalizedProduct()
const localizedProducts = computed(() => (props.products ?? []).map(loc))

// Amazon-паттерн: всё, что есть на складе, выбрано по умолчанию;
// пересобираем при смене пропса (обновление useAsyncData на revalidate)
const selectedIds = ref([])
watch(
        localizedProducts,
        (items) => {
                selectedIds.value = items
                        .filter((item) => item.inStock)
                        .map((item) => String(item.id))
        },
        { immediate: true },
)

const selectedItems = computed(() =>
        localizedProducts.value.filter((item) => selectedIds.value.includes(String(item.id))),
)

// Итог по блоку: текущий товар (цена выбранного варианта, если в наличии)
// + отмеченные доп. товары (цена «от» базового — как на кнопке карточки;
// точную сумму считает сервер при заказе)
const total = computed(() => {
        const currentSum =
                props.current && props.current.inStock ? Number(props.current.price) || 0 : 0
        return (
                currentSum +
                selectedItems.value.reduce((sum, item) => sum + (Number(item.price) || 0), 0)
        )
})

// Кнопка активна, пока есть что добавить: текущий товар в наличии (его
// страница добавит, если его ещё нет в корзине) или есть отмеченные доп.
const canAdd = computed(() => Boolean(props.current?.inStock) || selectedItems.value.length > 0)

const onAddSelected = () => {
        if (!canAdd.value) return
        //- Текущий товар НЕ в списке emit: страница добавит его сама
        //- (с выбранным вариантом и без дубля, если он уже в корзине)
        emit('add-selected', selectedItems.value)
}

// formatMoney — единая из useProductUtils (валюту добавляет formatMoney);
// productSrcset — автоимпорт из app/utils/productImage.ts
const { formatMoney } = useProductUtils()

const fallbackImage = '/images/placeholder.jpg'

const getValidImageUrl = (url) => {
        if (!url) return fallbackImage
        if (url.startsWith('data:')) return url
        if (url.startsWith('/')) return url
        if (url.includes('unsplash.com')) return url
        if (url.startsWith('http')) return url
        return fallbackImage
}

const handleImageError = (event) => {
        if (event?.target) event.target.src = fallbackImage
}
</script>

<style scoped>
.bought-together {
        width: 100%;
}
.line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
}
/* Тонкий скроллбар у ленты позиций на мобиле */
.fbt-list {
        scrollbar-width: thin;
}
</style>
