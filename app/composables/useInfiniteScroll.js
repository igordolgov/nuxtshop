// composables/useInfiniteScroll.js
/**
 * Hybrid Infinite Scroll с очисткой старых элементов
 * - Поддерживает виртуализацию (ограничение DOM элементов)
 * - IntersectionObserver для производительности
 * - Плавная загрузка при скролле
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

export function useInfiniteScroll(options = {}) {
	const {
		// Функция загрузки данных
		loadMore,
		// Максимальное количество элементов в DOM
		maxRendered = 100,
		// Расстояние до конца списка для триггера загрузки (px)
		threshold = 300,
		// Начальная страница
		initialPage = 1,
		// Размер страницы
		pageSize = 20,
		// Высота элемента для расчётов очистки
		estimatedItemHeight = 280,
		// Буфер элементов при очистке сверху
		topBuffer = 5
	} = options

	// ==========================================
	// State
	// ==========================================
	
	// Все загруженные данные
	const allItems = ref([])
	
	// Видимая часть данных (с учётом очистки)
	const visibleItems = ref([])
	
	// Состояние загрузки
	const isLoading = ref(false)
	
	// Есть ли ещё данные
	const hasMore = ref(true)
	
	// Текущая страница
	const currentPage = ref(initialPage)
	
	// Индекс первого видимого элемента
	const startIndex = ref(0)
	
	// Observer
	const observer = ref(null)
	const sentinelRef = ref(null)
	const containerRef = ref(null)
	
	// Флаг для блокировки очистки во время скролла
	const isScrolling = ref(false)
	let scrollTimeout = null

	// ==========================================
	// Computed
	// ==========================================
	
	const totalLoaded = computed(() => allItems.value.length)
	const visibleCount = computed(() => visibleItems.value.length)
	
	// ==========================================
	// Загрузка данных
	// ==========================================
	
	const fetchNextPage = async () => {
		if (isLoading.value || !hasMore.value) return
		
		isLoading.value = true
		
		try {
			const newItems = await loadMore(currentPage.value, pageSize)
			
			if (!newItems || newItems.length === 0) {
				hasMore.value = false
				return
			}
			
			// Добавляем в общий список
			allItems.value = [...allItems.value, ...newItems]
			
			// Обновляем видимые элементы
			updateVisibleItems()
			
			// Увеличиваем страницу если получили полную страницу
			if (newItems.length === pageSize) {
				currentPage.value++
			} else {
				hasMore.value = false
			}
			
		} catch (error) {
			console.error('[useInfiniteScroll] Error loading more:', error)
		} finally {
			isLoading.value = false
		}
	}

	// ==========================================
	// Управление видимыми элементами
	// ==========================================
	
	const updateVisibleItems = () => {
		const total = allItems.value.length
		const maxStart = Math.max(0, total - maxRendered)
		
		// Не позволяем startIndex быть больше максимально возможного
		if (startIndex.value > maxStart) {
			startIndex.value = maxStart
		}
		
		const endIndex = Math.min(startIndex.value + maxRendered, total)
		visibleItems.value = allItems.value.slice(startIndex.value, endIndex)
	}

	// ==========================================
	// Очистка элементов сверху (виртуализация)
	// ==========================================
	
	const cleanupTopItems = () => {
		if (!containerRef.value || isScrolling.value) return
		
		const scrollTop = containerRef.value.scrollTop
		
		// Вычисляем сколько элементов проскроллили
		const scrolledItems = Math.floor(scrollTop / estimatedItemHeight)
		
		// Новый стартовый индекс с буфером
		const newStartIndex = Math.max(0, scrolledItems - topBuffer)
		
		// Проверяем, нужно ли обновление
		if (newStartIndex !== startIndex.value && newStartIndex > 0) {
			startIndex.value = newStartIndex
			updateVisibleItems()
			
			// Корректируем scrollTop чтобы не было "прыжка"
			const removedHeight = newStartIndex * estimatedItemHeight
			containerRef.value.scrollTop = scrollTop - (estimatedItemHeight * (newStartIndex - startIndex.value))
		}
	}

	// ==========================================
	// IntersectionObserver
	// ==========================================
	
	const setupObserver = () => {
		if (!process.client || !sentinelRef.value) return
		
		// Очищаем старый observer
		if (observer.value) {
			observer.value.disconnect()
		}
		
		observer.value = new IntersectionObserver(
			async ([entry]) => {
				if (entry.isIntersecting && !isLoading.value && hasMore.value) {
					await fetchNextPage()
				}
			},
			{
				root: containerRef.value || null,
				rootMargin: `${threshold}px`,
				threshold: 0
			}
		)
		
		observer.value.observe(sentinelRef.value)
	}

	// ==========================================
	// Обработчики скролла
	// ==========================================
	
	const handleScroll = () => {
		isScrolling.value = true
		
		// Debounce очистки
		if (scrollTimeout) clearTimeout(scrollTimeout)
		
		scrollTimeout = setTimeout(() => {
			isScrolling.value = false
			cleanupTopItems()
		}, 150)
	}

	// ==========================================
	// Сброс состояния
	// ==========================================
	
	const reset = async () => {
		allItems.value = []
		visibleItems.value = []
		startIndex.value = 0
		currentPage.value = initialPage
		hasMore.value = true
		isLoading.value = false
		
		if (containerRef.value) {
			containerRef.value.scrollTop = 0
		}
		
		await nextTick()
		setupObserver()
		
		// Загружаем первую страницу
		await fetchNextPage()
	}

	// ==========================================
	// Предзагрузка
	// ==========================================
	
	const preload = async (pages = 2) => {
		for (let i = 0; i < pages && hasMore.value; i++) {
			await fetchNextPage()
		}
	}

	// ==========================================
	// Lifecycle
	// ==========================================
	
	onMounted(() => {
		if (!process.client) return
		
		setupObserver()
		
		if (containerRef.value) {
			containerRef.value.addEventListener('scroll', handleScroll, { passive: true })
		}
	})
	
	onUnmounted(() => {
		if (observer.value) {
			observer.value.disconnect()
		}
		
		if (containerRef.value) {
			containerRef.value.removeEventListener('scroll', handleScroll)
		}
		
		if (scrollTimeout) {
			clearTimeout(scrollTimeout)
		}
	})

	// ==========================================
	// API
	// ==========================================
	
	return {
		// State
		allItems,
		visibleItems,
		isLoading,
		hasMore,
		currentPage,
		startIndex,
		
		// Computed
		totalLoaded,
		visibleCount,
		
		// Refs (для привязки в шаблоне)
		sentinelRef,
		containerRef,
		
		// Methods
		fetchNextPage,
		reset,
		preload,
		updateVisibleItems,
		
		// Для отладки
		_observer: observer
	}
}