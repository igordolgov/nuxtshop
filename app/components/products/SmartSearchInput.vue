<!-- app/components/products/SmartSearchInput.vue -->
<template lang="pug">
.search-container.border.rounded-lg(
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
      placeholder="Поиск"
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
        aria-label="Очистить поиск"
      )
        span.text-xl(class="text-base-content/40 hover:text-base-content") x

  Transition(name="fade-slide")
    .suggestions-panel.absolute.top-full.left-0.right-0.mt-1.z-50.bg-base-100.shadow-xl.rounded-lg.overflow-hidden(
      v-if="shouldShowSuggestionsPanel"
      @mousedown.prevent="handlePanelMouseDown"
    )
      .card-body.p-0
        .suggestions-content.max-h-96.overflow-y-auto
          //- Поиск...
          .suggestion-item.flex.items-center.justify-center.p-3(
            v-if="isSearching && !hasInitialResults"
          )
            .loading.loading-spinner.loading-xs
            span.text-sm.ml-2(class="text-base-content/70") Поиск...
          
          //- Результаты
          template(v-if="filteredSuggestions.length > 0 && queryHasMinLength")
            button.suggestion-item.w-full.text-left.p-2.border-b(
              class="hover:bg-base-300 border-base-200 last:border-b-0"
              v-for="(item, index) in filteredSuggestions"
              :key="item.id"
              :class="localActiveSuggestionIndex === index ? 'bg-base-300' : ''"
              @mousedown="selectSuggestion(item)"
              @mouseenter="updateActiveIndex(index)"
              type="button"
            )
              .item-details
                .item-name.font-medium.text-sm.mb-1(
                  v-html="getHighlightedText(item.name)"
                )
                .item-category.text-xs.mb-1(
                  v-if="item.category"
                  v-html="getHighlightedText(item.category)"
                  class="text-base-content/70"
                )
                .item-description.text-xs.line-clamp-2(
                  v-if="item.description"
                  v-html="getHighlightedText(item.description)"
                  class="text-base-content/50"
                )
          
          //- Введите ещё
          .suggestion-item.text-center.p-3.italic(
            v-if="localSearchQuery && localSearchQuery.length === 1"
            class="text-base-content/50"
          )
            span Введите ещё {{ 2 - localSearchQuery.length }} букву...
          
          //- Ничего не найдено
          .suggestion-item.text-center.p-3(
            v-if="!isSearching && localSearchQuery && localSearchQuery.length >= 2 && filteredSuggestions.length === 0 && hasPerformedSearch"
            class="text-base-content/50"
          )
            span Ничего не найдено для "{{ localSearchQuery }}"
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
  products: { type: Array, default: () => [] }
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
  'search',
  'selectProduct'
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
      closeSuggestionsPanel()
      localSearchQuery.value = ''
      emit('update:searchQuery', '')
      searchInput.value?.blur()
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
    emit('selectProduct', selected)
    closeSuggestionsPanel()
    searchInput.value?.blur()
  } else {
    emit('performSearch')
    hasPerformedSearch.value = true
    closeSuggestionsPanel()
  }
}

const selectSuggestion = (suggestion) => {
  emit('suggestionSelected', suggestion)
  emit('selectProduct', suggestion)
  isPanelMouseDown.value = false
  closeSuggestionsPanel()
  searchInput.value?.blur()
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

const handleClickOutside = (event) => {
  if (searchContainer.value && !searchContainer.value.contains(event.target)) {
    isInputFocused.value = false
    clearTimeout(closePanelTimer)
    closeSuggestionsPanel()
  }
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
  
  if (process.client) {
    document.addEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  clearTimeout(closePanelTimer)
  
  if (process.client) {
    document.removeEventListener('click', handleClickOutside)
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
  background: oklch(var(--bc) / 0.3);
  border-radius: 3px;
}

:deep(.search-highlight) {
  background: linear-gradient(120deg, oklch(var(--wa)/0.3), oklch(var(--wa)/0.3));
  border-radius: 2px;
  color: oklch(var(--wa)/1);
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

@media (max-width: 640px) {
  .suggestions-panel {
    position: fixed;
    top: 54px;
    left: 6px;
    right: 6px;
    max-height: 70vh;
    margin-top: 0;
  }
}
</style>