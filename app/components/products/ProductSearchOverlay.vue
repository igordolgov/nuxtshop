<!-- app/components/products/ProductSearchOverlay.vue -->
<!-- ============================================
  Компонент: ProductSearchOverlay
  Полноэкранный поиск со страницы товара: иконка в действиях карточки
  (ProductInfo, перед «Сравнить»/«Избранное») открывает этот оверлей —
  строка поиска в шапке карточки не нужна (как у крупных маркетплейсов).

  Тот же глобальный state appState.search, что и шапка: подсказки,
  выбор подсказки → карточка товара, Enter → каталог ?search=…
  (index.vue восстанавливает запрос из URL). Закрытие: ✕, Escape,
  навигация. html overflow:hidden — фон не скроллится под оверлеем.
============================================ -->
<template lang="pug">
Teleport(to="body")
  Transition(name="fade")
    .product-search-overlay(
      v-if="open"
      class="fixed inset-0 z-[70] bg-base-100 flex flex-col"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('catalog.search')"
    )
      .flex.items-center.gap-2.px-3.pt-3.pb-2.border-b.border-base-200
        .flex-1.min-w-0
          SmartSearchInput(
            :products="allProducts"
            :isActive="true"
            :searchQuery="searchQuery"
            :isSearching="isSearching"
            :showSuggestions="showSuggestions"
            :suggestions="searchSuggestions"
            :hasSuggestions="hasSearchSuggestions"
            :activeSuggestionIndex="activeSuggestionIndex"
            @search="onSearch"
            @selectProduct="onSuggestionSelected"
            @update:searchQuery="onSearchQueryUpdate"
            @suggestionSelected="onSuggestionSelected"
            @performSearch="onPerformSearch"
            @resetSearch="onResetSearch"
            @update:activeSuggestionIndex="onActiveSuggestionIndex"
            @update:showSuggestions="onShowSuggestions"
          )
        button.btn.btn-ghost.btn-circle.shrink-0(
          type="button"
          :aria-label="$t('catalog.close')"
          @click="close"
        )
          svg.w-6.h-6(
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="text-base-content/70"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M6 18L18 6M6 6l12 12")
</template>

<script setup>
// Состояние поиска — глобальное (appState.search), биндинги те же, что
// в Header.vue: подсказки работают на любой странице (товары лениво
// догружаются watch'ем в шапке; здесь подстраховка — своя).
const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open'])

const localePath = useLocalePath()
const appState = useAppState()

const searchQuery = computed(() => appState.search?.query?.value ?? '')
const isSearching = computed(() => appState.search?.isSearching?.value ?? false)
const showSuggestions = computed(() => appState.search?.showSuggestions?.value ?? false)
const searchSuggestions = computed(() => appState.search?.suggestions?.value ?? [])
const hasSearchSuggestions = computed(() => appState.search?.hasSuggestions?.value ?? false)
const activeSuggestionIndex = computed(() => appState.search?.activeSuggestionIndex?.value ?? -1)
const allProducts = computed(() => appState.products?.value || [])

if (import.meta.client) {
  watch(
    () => props.open,
    (open) => {
      if (open && !allProducts.value.length) appState.loadProducts?.()
    },
    { immediate: true },
  )
}

const onSearchQueryUpdate = (q) => appState.setSearchQuery?.(q)
const onSearch = (q) => appState.setSearchQuery?.(q)
const onResetSearch = () => appState.search?.resetSearch?.()
const onActiveSuggestionIndex = (i) => {
  if (appState.search?.activeSuggestionIndex) {
    appState.search.activeSuggestionIndex.value = i
  }
}
const onShowSuggestions = (v) => {
  if (appState.search?.showSuggestions) {
    appState.search.showSuggestions.value = v
  }
}

const close = () => emit('update:open', false)

//- Enter: запрос живёт в каталоге (index.vue читает ?search= из URL);
//- localePath сохраняет префикс локали на en/es
const onPerformSearch = () => {
  const q = searchQuery.value?.trim()
  if (!q) return
  close()
  navigateTo(localePath({ path: '/', query: { search: q } }))
}

//- Подсказка → карточка товара + сброс поиска (как в шапке)
const onSuggestionSelected = async (item) => {
  if (!item) return
  close()
  await navigateTo(`/product/${item.id}`)
  appState.search?.resetSearch?.()
}

//- Открытие: фокус в поле (клавиатура сразу); закрытие: панель подсказок
//- не должна «доехать» до шапки другого маршрута, лок скролла фона — снять
const onKeydown = (event) => {
  if (event.key === 'Escape') close()
}

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return
    document.documentElement.style.overflow = open ? 'hidden' : ''
    if (open) {
      nextTick(() => {
        document.querySelector('.product-search-overlay .search-input')?.focus()
      })
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
      if (appState.search?.showSuggestions) {
        appState.search.showSuggestions.value = false
      }
    }
  },
)

onUnmounted(() => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
})
</script>
