<!-- app/components/products/BoughtTogether.vue -->
<!-- «Часто покупают вместе» (Amazon Frequently Bought Together): товары из
  одних заказов (считает сервер в /api/product/[slug] → boughtTogether).
  Размещение — левая колонка карточки под галереей (grid-area similar,
  wrapper в pages/product/[slug].vue), над «Похожими».
  Лента — ТОЛЬКО доп. товары: текущий товар плиткой не показывается (он
  и так герой страницы; по отзыву покупателя «тот же товар» в списке
  выглядел дублем). На мобиле в ленте видно 1–1,5 позиции, а скроллбар
  скрыт до первой прокрутки — поэтому лента сама «подглядывает»:
  каждые ~6 с разыгрывает сценку «лук и резиновая стенка» — медленно
  тянется до середины следующего товара (натягивание тетивы), замирает
  на полной натяжке, резко срывается назад, ударяется о левый край и
  несколько раз упруго отскакивает от него с затуханием; так — пока
  пользователь не начал скроллить сам. Плюс скроллбар всегда виден.
  «Итого» = цена текущего товара
  (выбранный вариант, если в наличии — пропс current собирает страница)
  + отмеченные доп.; под суммой — расшифровка «ваш товар X + выбранные
  Y». Кнопка добавляет всё из «Итого»: текущий товар страницей первым
  (тем же вариантом, что и главная кнопка «В корзину», без дубля —
  isInCart) и отмеченные доп. Доп. товары: всё доступное выбрано по
  умолчанию; недоступное (нет на складе) — чекбокс выключен и в итог не
  попадает. Без данных блок не рендерится (v-if ставит страница). -->
<template lang="pug">
.bought-together(
        class="mt-3 lg:mt-4 px-2 lg:px-3"
)
                h2.text-xl.font-semibold.mb-1(class="lg:text-2xl") {{ $t('product.boughtTogether') }}
                //- Источник списка — реальные заказы, а не «похожесть» товаров:
                //- подпись снимает вопрос «откуда этот список» (отзыв покупателя)
                p.text-xs.opacity-60.mb-2 {{ $t('product.boughtTogetherHint') }}

                .card.bg-base-100.shadow-md.rounded-box.p-3(class="lg:p-4")
                        //- Горизонтальная лента чекбокс-позиций: на мобиле скроллится,
                        //- на lg помещается вся (3 позиции — лимит API)
                        .fbt-list.flex.items-start.gap-4(
                                ref="fbtListEl"
                                class="overflow-x-auto"
                        )
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
                        //- Под суммой — расшифровка: текущий товар в ленте не
                        //- показан, без неё сумма выглядела бы необъяснимой
                        .flex.items-center.justify-between.gap-3
                                .flex.flex-col.min-w-0(class="gap-0.5")
                                        .flex.items-baseline.gap-2
                                                span.text-sm.opacity-70 {{ $t('product.fbtTotal') }}:
                                                span.font-bold.text-primary.text-lg {{ formatMoney(total) }}
                                        span.text-xs.opacity-60(
                                                v-if="current && current.inStock"
                                        ) {{ $t('product.fbtTotalHint', { current: formatMoney(current.price), rest: formatMoney(companionsTotal) }) }}
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

// Сумма отмеченных доп. товаров (цена «от» базового — как на кнопке
// карточки; точную сумму считает сервер при заказе)
const companionsTotal = computed(() =>
        selectedItems.value.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
)

// Итог по блоку: текущий товар (цена выбранного варианта, если в наличии)
// + отмеченные доп. товары. Расшифровка состава — в шаблоне под суммой.
const total = computed(() => {
        const currentSum =
                props.current && props.current.inStock ? Number(props.current.price) || 0 : 0
        return currentSum + companionsTotal.value
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

// ─── Подсказка «дальше есть ещё товары» ────────────────────────────
// На мобиле в ленте видно 1–1,5 позиции, а оверлей-скроллбар скрыт до
// первой прокрутки — не понятно, что список скроллится (отзыв покупателя).
// Пока пользователь сам не начал скроллить, лента каждые ~6 секунд
// разыгрывает сценку «лук и резиновая стенка» (формулировка покупателя):
// медленно тянется до середины следующего товара (натягивание тетивы),
// замирает на полной натяжке, затем резко срывается назад, ударяется
// о левый край и несколько раз упруго отскакивает от него с затуханием.
// Отскок от стенки рисуется transform'ом контента (scrollLeft не бывает
// отрицательным). Только если лента реально переполнена (на lg всё
// видно); prefers-reduced-motion и фоновая вкладка анимацию отключают.
const fbtListEl = ref(null)
let hintStopped = false
let hintCycleTimer = null
let hintStepTimers = []

// Сжатие у «стенки» — CSS-переменная на контейнере, дети сдвигаются
// transform'ом (по умолчанию 0 — вне анимации ничего не двигается)
const resetWallSquish = () => {
        const el = fbtListEl.value
        if (el) el.style.setProperty('--fbt-squish', '0px')
}

const stopScrollHint = () => {
        hintStopped = true
        if (hintCycleTimer) {
                clearTimeout(hintCycleTimer)
                hintCycleTimer = null
        }
        hintStepTimers.forEach(clearTimeout)
        hintStepTimers = []
        resetWallSquish()
}

// Целевая прокрутка: середина первого товара, чья середина за правым
// краем видимой области («до середины следующего товара»), с зазором
// 12px и без выхода за максимум ленты. 0 — подглядывать не за чем.
const peekTarget = (el) => {
        const hidden = Array.from(el.children).find(
                (child) => child.offsetLeft + child.offsetWidth / 2 > el.scrollLeft + el.clientWidth,
        )
        if (!hidden) return 0
        const maxLeft = el.scrollWidth - el.clientWidth
        const target = hidden.offsetLeft + hidden.offsetWidth / 2 - el.clientWidth + 12
        return Math.min(maxLeft, Math.max(0, target))
}

// rAF-анимация scrollLeft с произвольной кривой
const animateScroll = (el, from, to, duration, ease) => {
        const start = performance.now()
        const step = (now) => {
                if (hintStopped) return
                const t = Math.min(1, (now - start) / duration)
                el.scrollLeft = from + (to - from) * ease(t)
                if (t < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
}

// «Натягивание тетивы»: медленный разгон и плавная остановка на натяжке
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2
// «Отпускание»: разгон по пути к стенке
const easeInQuad = (t) => t * t

// Удар о «резиновую стенку»: контент сжимается у левого края (translateX
// в минус — scrollLeft в минус не умеет) и упруго отпружинивает,
// колебания затухают: -A·e^(−λt)·sin(ωt). В конце и при остановке — сброс.
const bounceOffWall = (el) => {
        const amplitude = 22 // глубина первого сжатия, px
        const decay = 2.6 // скорость затухания, 1/с
        const omega = 28 // частота, рад/с (полволны ≈ 112 мс)
        const duration = 1100 // мс — дальше колебания меньше пикселя
        const start = performance.now()
        const step = (now) => {
                const t = (now - start) / 1000
                if (hintStopped || t * 1000 >= duration) {
                        resetWallSquish()
                        return
                }
                const offset = -amplitude * Math.exp(-decay * t) * Math.sin(omega * t)
                el.style.setProperty('--fbt-squish', `${offset.toFixed(2)}px`)
                requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
}

const scheduleScrollHint = (delay = 6000) => {
        if (hintStopped) return
        clearTimeout(hintCycleTimer)
        hintCycleTimer = setTimeout(() => {
                const el = fbtListEl.value
                if (!el || hintStopped || document.hidden) return
                const target = peekTarget(el)
                if (target > el.scrollLeft + 4) {
                        // Натяжка: 0 → цель медленно (2.2 с); замирание на полной
                        // натяжке (350 мс); отпускание: резкий срыв к началу
                        // (180 мс) и серия затухающих отскоков от стенки
                        animateScroll(el, el.scrollLeft, target, 2200, easeInOutSine)
                        hintStepTimers.push(
                                setTimeout(() => {
                                        if (!hintStopped) animateScroll(el, el.scrollLeft, 0, 180, easeInQuad)
                                }, 2550),
                        )
                        hintStepTimers.push(
                                setTimeout(() => {
                                        if (!hintStopped) bounceOffWall(el)
                                }, 2730),
                        )
                }
                scheduleScrollHint()
        }, delay)
}

onMounted(() => {
        const el = fbtListEl.value
        if (!el || el.scrollWidth <= el.clientWidth + 4) return
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        if (reduced) return
        scheduleScrollHint(3000)
        // Любой ручной жест (тап, свайп, колесо, перетаскивание скроллбара)
        // — и подсказка выключается навсегда
        el.addEventListener('touchstart', stopScrollHint, { passive: true })
        el.addEventListener('wheel', stopScrollHint, { passive: true })
        el.addEventListener('mousedown', stopScrollHint)
})

onBeforeUnmount(stopScrollHint)

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
/* Тонкий скроллбар у ленты позиций на мобиле; padding-bottom опускает
   полосу ниже плиток, чтобы она не липла к тексту */
.fbt-list {
        scrollbar-width: thin;
        scrollbar-color: color-mix(in oklab, var(--color-primary) 60%, transparent) transparent;
        padding-bottom: 10px;
}
/* Отскок от «резиновой стенки»: на время анимации дети ленты сдвигаются
   переменной --fbt-squish (сжатие у левого края и отпружинивание);
   вне анимации переменная 0 — transform не виден */
.fbt-list .fbt-item {
        transform: translateX(var(--fbt-squish, 0px));
}
/* Скроллбар ленты ВСЕГДА виден и ГОЛУБОЙ (цвет primary темы): iOS/Safari
   скрывают оверлей-скроллбар до первой прокрутки — без подсказки не видно,
   что список скроллится. Chrome 121+ и Firefox берут scrollbar-width/
   scrollbar-color выше (webkit-стили при этом игнорируются). */
.fbt-list::-webkit-scrollbar {
        height: 7px;
}
.fbt-list::-webkit-scrollbar-track {
        background: transparent;
}
.fbt-list::-webkit-scrollbar-thumb {
        background: color-mix(in oklab, var(--color-primary) 60%, transparent);
        border-radius: 999px;
}
</style>
