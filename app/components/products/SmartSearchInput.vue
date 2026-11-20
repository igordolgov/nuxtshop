<!-- app/components/products/SmartSearchInput.vue -->
<!-- Панель подсказок — паттерн маркетплейсов (WB/Ozon/Amazon):
     ввод → ТОЛЬКО компактная панель (фото + название + цена), сетка под
     инпутом на посимвольный ввод не реагирует (не дублирует подсказки);
     переход на товар — по клику на подсказку (канонический slug);
     полный поиск — Enter или «Показать все результаты (N)» в футере.
     Подсветка совпадений в панели — ЖИРНЫМ без заливки (Amazon/Ozon):
     жёлтые <mark> по всему тексту — шум; в карточках сетки подсветки нет. -->
<template lang="pug">
.search-container.border.rounded-lg.relative(
  class="border-secondary/60 w-full"
  ref="searchContainer"
)
  .search-input-wrapper.flex.items-center.relative.bg-base-100.rounded-lg.h-9.border(
    class="border-base-content/20"
    :class="inputWrapperClasses"
  )
    .search-icon.px-2.flex-shrink-0.flex.items-center(
      class="text-base-content/50"
    )
      svg.w-4.h-4(
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      )
        path(
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        )
    
    input.search-input.flex-1.border-none.outline-none.p-0.text-sm.bg-transparent.h-full.min-w-0(
      class="text-base-content"
      :value="localSearchQuery"
      @input="handleInput"
      type="text"
      :placeholder="$t('catalog.search')"
      :aria-label="$t('catalog.search')"
      autocomplete="off"
      enterkeyhint="search"
      role="combobox"
      :aria-expanded="panelOpenForAria"
      :aria-controls="listboxId"
      :aria-activedescendant="activeDescendantId"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
      @keydown.enter.prevent="handleEnter"
      ref="searchInput"
    )
    
    .search-actions.flex.items-center.gap-1.px-2.flex-shrink-0(
      v-if="localSearchQuery"
    )
      button.btn.btn-ghost.btn-xs.p-0.w-6.h-6.min-h-0(
        @click="resetSearch"
        type="button"
        :aria-label="$t('catalog.clearSearch')"
      )
        span.text-xl(class="text-base-content/60 hover:text-base-content") x

  Transition(name="fade-slide")
    .suggestions-panel.absolute.top-full.left-0.right-0.mt-1.z-50.bg-base-100.shadow-xl.rounded-lg.overflow-hidden(
      v-if="shouldShowSuggestionsPanel"
      ref="suggestionsPanel"
      @mousedown.prevent="handlePanelMouseDown"
    )
      .card-body.p-0
        .suggestions-content.max-h-96.overflow-y-auto
          //- Поиск...
          .suggestion-item.flex.items-center.justify-center.p-3(
            v-if="isSearching && !hasInitialResults"
          )
            .loading.loading-spinner.loading-xs
            span.text-sm.ml-2(class="text-base-content/70") {{ $t('catalog.searching') }}
          
          //- Результаты: фото + название + цена (паттерн WB/Ozon/Amazon).
          //- Список — role=listbox с id: input role=combobox ссылается на
          //- него (aria-controls) и на активный вариант (aria-activedescendant)
          .suggestions-listbox(
            v-if="filteredSuggestions.length > 0 && queryHasMinLength"
            role="listbox"
            :id="listboxId"
          )
            button.suggestion-item.w-full.text-left.p-2.border-b.flex.items-center.gap-3(
              class="hover:bg-base-200 border-base-200 last:border-b-0"
              v-for="(item, index) in filteredSuggestions"
              :key="item.id"
              :id="optionId(index)"
              role="option"
              :aria-selected="localActiveSuggestionIndex === index"
              :class="localActiveSuggestionIndex === index ? 'bg-base-200' : ''"
              @mousedown.prevent.stop="selectSuggestion(item)"
              @mouseenter="updateActiveIndex(index)"
              type="button"
            )
              img.item-thumb.w-10.h-10.rounded-md.object-cover.bg-base-200.shrink-0(
                v-if="itemThumbUrl(item)"
                :src="itemThumbUrl(item)"
                :alt="''"
                loading="lazy"
                decoding="async"
              )
              .item-thumb-placeholder.w-10.h-10.rounded-md.bg-base-200.shrink-0.flex.items-center.justify-center(
                v-else
              )
                svg.w-5.h-5(viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-base-content/30" aria-hidden="true")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5m10.5-11.25h.008v.008h-.008zm.375 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0a.375.375 0 1 1-.75 0")
              .item-details.min-w-0.flex-1
                .item-name.text-sm.leading-snug.line-clamp-2(
                  v-html="getHighlightedText(item.name)"
                )
              .item-price.text-sm.font-semibold.shrink-0(
                class="text-base-content"
              ) {{ formatMoney(item.price) }}
          
          //- Футер панели: полный поиск по запросу (маркетплейс-паттерн:
          //- Enter = «Показать все результаты»). Виден только при совпадениях:
          //- клик применяет поиск к сетке каталога (фильтрует карточки и
          //- закрывает панель) — до этого сетка не реагирует на ввод.
          //- ВНЕ listbox: не вариант выбора — только товарные строки
          button.show-all-results.w-full.text-left.px-3.flex.items-center.justify-between.gap-2(
            v-if="filteredSuggestions.length > 0 && queryHasMinLength"
            class="hover:bg-base-200 bg-base-100 border-t border-base-200 py-2.5"
            type="button"
            @mousedown.prevent.stop="onShowAllClick"
          )
            span.text-sm.font-medium {{ $t('catalog.showAllResults') }}
            span.badge.badge-sm.badge-primary.rounded-full(
              v-if="totalResults > filteredSuggestions.length"
            ) {{ $t('catalog.itemsCount', totalResults) }}
          
          //- Введите ещё
          .suggestion-item.text-center.p-3.italic(
            v-if="localSearchQuery && localSearchQuery.length === 1"
            class="text-base-content/50"
          )
            span {{ $t('catalog.enterMore', 2 - localSearchQuery.length) }}
          
          //- Ничего не найдено
          .suggestion-item.text-center.p-3(
            v-if="!isSearching && localSearchQuery && localSearchQuery.length >= 2 && filteredSuggestions.length === 0 && hasPerformedSearch"
            class="text-base-content/50"
          )
            span {{ $t('catalog.nothingFound', { q: localSearchQuery }) }}
</template>

<script setup>
//- ============================================
//- Imports
//- ============================================
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSearchHighlight } from '@/composables/useSearchHighlight'

//- ============================================
//- Props
//- ============================================
const props = defineProps({
  searchQuery: { type: String, default: '' },
  isSearching: { type: Boolean, default: false },
  showSuggestions: { type: Boolean, default: false },
  suggestions: { type: Array, default: () => [] },
  hasSuggestions: { type: Boolean, default: false },
  totalResults: { type: Number, default: 0 },
  activeSuggestionIndex: { type: Number, default: -1 },
  isActive: { type: Boolean, default: false },
  products: { type: Array, default: () => [] },
  // Полноэкранный оверлей (ProductSearchOverlay): клик-аутсайд там бессмыслен
  // (весь экран — контейнер поиска), а без запрета он УБИВАЛ панель сразу
  // после открытия: клик по иконке поиска всплывает до document уже ПОСЛЕ
  // монтирования оверлея (Vue синхронно флешит рендер в микротаске между
  // слушателями клика), свежесмонтированный компонент считает этот клик
  // «мимо поля» и сбрасывает фокусные флаги — подсказки при вводе не
  // появлялись вовсе (дом-фокус был, панель — мертва)
  disableClickOutside: { type: Boolean, default: false },
  // Полноэкранный оверлей: НЕ блюрить поле по скроллу документа. Блюр-по-скроллу
  // нужен на странице (спрятать клавиатуру при прокрутке, 02588fe), но в оверлее
  // за ним нечего прокручивать (document overflow:hidden), а урон он приносит
  // реальный: на телефоне открытие клавиатуры/инерционный дожим после тапа по
  // иконке поиска ловят scroll — поле блюрилось, клавиатура пряталась, панель
  // умирала ДО набора (отзыв: «при поиске со страницы товара не выходит список,
  // как на главной»). Клавиатуру в оверлее прячут ✕/Escape/тап мимо поля
  disableScrollBlur: { type: Boolean, default: false },
  // Полноэкранный оверлей: панель по факту запроса, а не по фокусу — список
  // не исчезает при потери фокуса (клавиатура/скролл/тап мимо поля): пока
  // в поле есть текст — панель видна. На странице это меняло бы поведение
  // (панель закрывается по клику мимо) — там проп не ставится
  stickyPanel: { type: Boolean, default: false }
})

//- ============================================
//- Emits
//- ============================================
const emit = defineEmits([
  'update:searchQuery',
  'suggestionSelected',
  'performSearch',
  'resetSearch',
  'update:activeSuggestionIndex',
  'update:showSuggestions',
  'search'
])

//- ============================================
//- Composables
//- ============================================
const { highlightText } = useSearchHighlight()

//- ============================================
//- Refs
//- ============================================
const searchInput = ref(null)
const searchContainer = ref(null)
const suggestionsPanel = ref(null)

//- ARIA combobox: уникальные id списка/вариантов (в DOM два инстанса
//- поиска — десктопный и мобильный, id не должны конфликтовать)
const uid = useId()
const listboxId = `${uid}-suggestions-listbox`
const optionId = (index) => `${uid}-suggestion-${index}`
const activeDescendantId = computed(() =>
  localActiveSuggestionIndex.value >= 0 && filteredSuggestions.value.length > 0
    ? optionId(localActiveSuggestionIndex.value)
    : undefined,
)
const panelOpenForAria = computed(() =>
  shouldShowSuggestionsPanel.value && filteredSuggestions.value.length > 0,
)

//- ============================================
//- Local state
//- ============================================
const localSearchQuery = ref(props.searchQuery)
const localActiveSuggestionIndex = ref(props.activeSuggestionIndex)
const hasInitialResults = ref(false)
const hasPerformedSearch = ref(false)
const isPanelForcedOpen = ref(false)
const isInputFocused = ref(false)
const isPanelMouseDown = ref(false)
//- Панель закрыта первым Escape (двухступенчатый Esc): пока фокус в поле
//- и текст не менялся — панель не переоткрывать сама по себе
const isPanelClosedByEsc = ref(false)

let closePanelTimer = null

//- ============================================
//- Computed
//- ============================================
const queryHasMinLength = computed(() => localSearchQuery.value?.length >= 2)

const inputWrapperClasses = computed(() => {
  return isInputFocused.value ? 'border-primary shadow-[0_0_0_2px_oklch(var(--p)/0.1)]' : ''
})

//- Кэшированная фильтрация (пересчитывается только при изменении запроса или products)
const filteredSuggestions = computed(() => {
  const query = localSearchQuery.value
  if (!query || query.length < 2) return []
  
  // Приоритет: suggestions из props, иначе фильтруем products
  if (props.suggestions?.length > 0) {
    return props.suggestions.slice(0, 5)
  }
  
  if (!props.products?.length) return []
  
  const lowerQuery = query.toLowerCase()
  
  return props.products
    .filter(product => {
      const name = product.name?.toLowerCase() || ''
      const description = product.description?.toLowerCase() || ''
      const category = product.category?.toLowerCase() || ''
      
      return name.includes(lowerQuery) || description.includes(lowerQuery) || category.includes(lowerQuery)
    })
    .slice(0, 5)
})

const shouldShowSuggestionsPanel = computed(() => {
  //- Панель закрыта первым Escape — не показывать до изменения ввода
  if (isPanelClosedByEsc.value) return false
  //- Оверлей: список виден, пока в поле есть запрос — независимо от фокуса
  if (props.stickyPanel) {
    if (localSearchQuery.value) return true
    return isPanelForcedOpen.value
  }
  if (!isInputFocused.value && !isPanelMouseDown.value) return false
  if (!localSearchQuery.value) return isPanelForcedOpen.value
  if (localSearchQuery.value.length === 1) return true
  if (props.isSearching) return true
  if (filteredSuggestions.value.length > 0) return true
  if (localSearchQuery.value.length >= 2 && hasPerformedSearch.value) return true
  if (isPanelForcedOpen.value) return true
  
  return false
})

//- ============================================
//- Watchers (минимизировано)
//- ============================================
watch(() => props.searchQuery, (newVal) => {
  if (newVal !== localSearchQuery.value) {
    localSearchQuery.value = newVal
  }
})

watch(() => props.suggestions, (newVal) => {
  if (newVal?.length > 0) {
    hasInitialResults.value = true
    hasPerformedSearch.value = true
  }
}, { immediate: true })

//- ============================================
//- Methods
//- ============================================
const handleInput = (event) => {
  const value = event.target.value
  localSearchQuery.value = value
  isPanelClosedByEsc.value = false
  emit('update:searchQuery', value)
  
  if (value?.length >= 2) {
    emit('search', value)
    emit('update:showSuggestions', true)
  } else {
    emit('update:showSuggestions', false)
  }
}

const handleFocus = () => {
  isInputFocused.value = true
  clearTimeout(closePanelTimer)
  isPanelForcedOpen.value = true
  isPanelClosedByEsc.value = false
}

const handleBlur = () => {
  closePanelTimer = setTimeout(() => {
    if (!isPanelMouseDown.value) {
      isInputFocused.value = false
      isPanelForcedOpen.value = false
      emit('update:showSuggestions', false)
    }
  }, 150)
}

const handlePanelMouseDown = () => {
  isPanelMouseDown.value = true
  searchInput.value?.focus()
  setTimeout(() => { isPanelMouseDown.value = false }, 200)
}

const handleKeydown = (event) => {
  const suggestions = filteredSuggestions.value
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (suggestions.length > 0) {
        const nextIndex = localActiveSuggestionIndex.value < suggestions.length - 1 
          ? localActiveSuggestionIndex.value + 1 
          : 0
        updateActiveIndex(nextIndex)
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (suggestions.length > 0) {
        const prevIndex = localActiveSuggestionIndex.value > 0 
          ? localActiveSuggestionIndex.value - 1 
          : suggestions.length - 1
        updateActiveIndex(prevIndex)
      }
      break
    case 'Escape':
      event.preventDefault()
      // Двухступенчатый Escape (стандарт маркетплейсов/combobox):
      // первый — закрыть панель, НЕ трогая набранный запрос;
      // второй — очистить поле и снять фокус. Раньше случайный Esc
      // после набора убивал весь запрос
      if (shouldShowSuggestionsPanel.value && !isPanelClosedByEsc.value) {
        isPanelClosedByEsc.value = true
        isPanelForcedOpen.value = false
        emit('update:showSuggestions', false)
      } else {
        isPanelClosedByEsc.value = false
        localSearchQuery.value = ''
        emit('update:searchQuery', '')
        emit('update:showSuggestions', false)
        isPanelForcedOpen.value = false
        searchInput.value?.blur()
      }
      break
  }
}

const handleEnter = (event) => {
  event.preventDefault()
  
  if (!localSearchQuery.value || localSearchQuery.value.length < 2) return
  
  const suggestions = filteredSuggestions.value
  
  if (localActiveSuggestionIndex.value >= 0 && suggestions[localActiveSuggestionIndex.value]) {
    const selected = suggestions[localActiveSuggestionIndex.value]
    emit('suggestionSelected', selected)
    closeSuggestionsPanel()
    searchInput.value?.blur()
  } else {
    emit('performSearch')
    hasPerformedSearch.value = true
    closeSuggestionsPanel()
  }
}

const selectSuggestion = (suggestion) => {
  //- ОДИН emit (раньше был ещё 'selectProduct' с тем же обработчиком:
  //- два router.push подряд, vue-router отменял первый — гонка
  //- с resetSearch убивала навигацию, клик «не вёл» на товар)
  emit('suggestionSelected', suggestion)
  isPanelMouseDown.value = false
  closeSuggestionsPanel()
  searchInput.value?.blur()
}

//- Футер «Показать все результаты»: применяет поиск (родитель —
//- appState.performSearch на главной, оверлей — переход к /?search=)
//- и закрывает панель, как Enter
const onShowAllClick = () => {
  hasPerformedSearch.value = true
  closeSuggestionsPanel()
  searchInput.value?.blur()
  emit('performSearch')
}

const updateActiveIndex = (index) => {
  localActiveSuggestionIndex.value = index
  emit('update:activeSuggestionIndex', index)
}

const resetSearch = () => {
  localSearchQuery.value = ''
  localActiveSuggestionIndex.value = -1
  hasPerformedSearch.value = false
  hasInitialResults.value = false
  emit('resetSearch')
  emit('update:showSuggestions', false)
  searchInput.value?.focus()
  isPanelForcedOpen.value = true
}

const closeSuggestionsPanel = () => {
  emit('update:showSuggestions', false)
  isPanelForcedOpen.value = false
  isInputFocused.value = false
  isPanelMouseDown.value = false
}

const getHighlightedText = (text) => {
  if (!text) return ''
  if (localSearchQuery.value?.length >= 2) {
    return highlightText(text, localSearchQuery.value)
  }
  return text
}

//- Цена в подсказке — единый форматтер витрины (₽/$ из store.config)
const { formatMoney } = useProductUtils()

//- Миниатюра подсказки — те же 400w-версии, что рисует сетка карточек
//- (candidates 400w из productSrcset): URL уже в кэше браузера —
//- панель подсказок не грузит НОВЫЕ картинки (40px слот)
const LOCAL_SMALL_IMAGE_RE = /^\/images\/products\/(photo-\d+-[a-f0-9]+)\.webp$/
const itemThumbUrl = (item) => {
  const url = item?.image
  if (!url || url === 'null' || url === 'undefined') return null
  if (url.startsWith('data:')) return url
  if (url.startsWith('photo-')) return withImageFormat(`https://images.unsplash.com/${url}`, 400)
  if (url.startsWith('http')) return withImageFormat(url, 400)
  const m = url.match(LOCAL_SMALL_IMAGE_RE)
  if (m) return `/images/products/small/${m[1]}.webp`
  if (url.startsWith('/')) return url
  return `/images/${url}`
}

const handleClickOutside = (event) => {
  if (props.disableClickOutside) return
  if (searchContainer.value && !searchContainer.value.contains(event.target)) {
    isInputFocused.value = false
    clearTimeout(closePanelTimer)
    closeSuggestionsPanel()
  }
}

//- Скролл страницы уводит фокус с поиска (мобильный: закрывается
//- клавиатура — раньше фокус «залипал» в поле при прокрутке).
//- Событие scroll не всплывает — ловим в capture-фазе на document;
//- скролл ВНУТРИ панели подсказок фокус не трогаем.
const handleDocScroll = (event) => {
  //- Оверлей: скролл не трогает фокус (см. disableScrollBlur) — иначе
  // клавиатура/инерция после открытия убивали панель до набора текста
  if (props.disableScrollBlur) return
  if (!isInputFocused.value) return
  const target = event.target
  if (
    suggestionsPanel.value &&
    target instanceof Node &&
    suggestionsPanel.value.contains(target)
  ) {
    return
  }
  searchInput.value?.blur()
}

//- ============================================
//- Lifecycle
//- ============================================
onMounted(() => {
  if (localSearchQuery.value?.length > 0) {
    nextTick(() => { isPanelForcedOpen.value = true })
  } else if (props.isActive) {
    isPanelForcedOpen.value = true
  }
  
  if (import.meta.client) {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('scroll', handleDocScroll, { capture: true, passive: true })
  }
})

onUnmounted(() => {
  clearTimeout(closePanelTimer)
  
  if (import.meta.client) {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('scroll', handleDocScroll, { capture: true })
  }
})
</script>

<style scoped>
.suggestions-content::-webkit-scrollbar {
  width: 6px;
}

.suggestions-content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.suggestions-content::-webkit-scrollbar-thumb {
  /* oklch(var(--bc) / 0.3) — канальная переменная daisyUI 3/4, в
     daisyUI 5 не существует → thumb был прозрачным; color-mix по
     готовому токену --color-base-content */
  background: color-mix(in oklab, var(--color-base-content) 30%, transparent);
  border-radius: 3px;
}

/* Цвет фрагментов подсветки (.search-highlight) — глобальный,
   см. main.css: «Подсветка найденного в поиске» (локальное правило
   здесь было мёртвым: oklch(var(--wa)) — канальные переменные
   daisyUI 3/4, в daisyUI 5 не существуют, значение невалидно). */

/* В ПАНЕЛИ подсказок подсветка — жирным БЕЗ заливки (паттерн
   Amazon/Ozon: жёлтые <mark> по названию/описанию — шум, а с
   макетом «фото + название + цена» заливка рвёт строку).
   Глобальное жёлтое правило остаётся админке и прочим <mark>. */
.suggestions-panel :deep(.search-highlight) {
  background: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
  font-weight: 700;
}

/* Миниатюра: она чуть вылезает по высоте строки при 2-строчном
   названии — фиксируем пропорции и обрезку (object-cover уже в классе) */
.item-thumb,
.item-thumb-placeholder {
  align-self: flex-start;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Панель подсказок на мобильных больше НЕ fixed с хардкодом top:54px:
   тот сдвиг был верен для старой однострочной шапки, а при двухстрочной
   (строка 2 — сам поиск) панель накрывала поле ввода. Теперь контейнер
   position:relative — absolute top-full ставит панель ровно под инпутом
   и в шапке главной, и в полноэкранном оверлее карточки товара. */
</style>