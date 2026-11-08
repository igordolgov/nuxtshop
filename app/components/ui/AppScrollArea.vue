<!-- app/components/ui/AppScrollArea.vue — область прокрутки с ПОСТОЯННО
     видимой рельсой-скроллбаром (синий thumb на сером треке).
     Зачем не нативная полоса: в панели фильтров она вела себя
     ненадёжно на всех платформах — на мобильных (iOS/Android) и в
     новых Chrome тонкая полоса рисуется ПОВЕРХ правого края списка
     (наезжает на шевроны групп и кнопки «Ещё N») и исчезает, когда
     прокрутка прекращается — непонятно, есть ли список ниже.
     Поэтому здесь нативная полоса глушится (scrollbar-width: none +
     ::-webkit-scrollbar: display none), а справа рисуется своя рельса:
     видна ВСЕГДА, пока список не помещается, и никогда не перекрывает
     контент — правый padding вьюпорта резервирует под неё зону.
     Прокрутка остаётся нативной (колесо/тачпад/тач/клавиатура), рельса
     — pointer-events: none, только индикатор. Позиция и размер thumb
     обновляются на scroll и ResizeObserver (вьюпорт + контент: фасеты,
     локаль и шрифты меняют высоту списка уже после монтирования).
     Используется: ProductFilter (.vertical-layout — фолбэк-скролл тела),
     ProductCategories (.categories-scroll), ProductSpecFilters
     (.spec-groups). -->
<template lang="pug">
.app-scroll-area(:class="{ 'app-scroll-area--scrollable': scrollable }")
  .app-scroll-area__viewport(
    ref="viewport"
    @scroll.passive="update"
  )
    .app-scroll-area__content(:class="contentClass")
      slot

  //- Рельса вне потока (absolute) — не скроллится с контентом;
  //- pointer-events: none — клики проходят сквозь, декоративная
  .app-scroll-area__rail(aria-hidden="true")
    .app-scroll-area__thumb(:style="thumbStyle")
</template>

<style scoped>
.app-scroll-area {
  position: relative; /* якорь рельсы */
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.app-scroll-area__viewport {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain; /* доскроллили список — не тянем страницу за собой */
  /* Нативную полосу глушим на всех платформах — её роль играет рельса */
  scrollbar-width: none;
  /* Зона под рельсу: контент (шевроны групп, кнопки «Ещё N») до неё
     не доходит — полоса физически не может что-либо перекрыть */
  padding-right: 12px;
}

.app-scroll-area__viewport::-webkit-scrollbar {
  display: none;
}

/* Контракт высоты: обёртка контента = высоте вьюпорта, а НЕ контента.
   Без этого flex-элементы внутри (секции фильтров) разрешаются против
   высоты контента — никогда не сжимаются, внутренние скроллы умирают
   и всё тело скроллится целиком. С height:100% shrink/grow работают
   как в нативном скролл-контейнере: список выше вьюпорта → секции
   сжимаются и список скроллится ВНУТРИ, переполнение обёртки гасит
   скролл самого вьюпорта */
.app-scroll-area__content {
  height: 100%;
}

/* Рельса: трек во всю высоту вьюпорта с отступом RAIL_INSET (3px,
   синхронно с константой в script) */
.app-scroll-area__rail {
  position: absolute;
  top: 3px;
  right: 3px;
  bottom: 3px;
  width: 4px;
  border-radius: 2px;
  background: var(--color-base-300);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

/* Видима всегда, пока список не помещается (и только пока) */
.app-scroll-area--scrollable .app-scroll-area__rail {
  opacity: 1;
}

.app-scroll-area__thumb {
  position: absolute;
  left: 0;
  right: 0;
  border-radius: 2px;
  background: var(--color-primary);
}
</style>

<script setup>
//- Геометрия рельсы. RAIL_INSET синхронен с top/right/bottom рельсы
//- в CSS (3px) — трек = высота вьюпорта минус два отступа
const RAIL_INSET = 3
//- Thumb не может быть меньше — иначе на длинных списках он
//- превращается в точку и «телепортируется» при прокрутке
const MIN_THUMB_PX = 24

const props = defineProps({
  //- Классы для обёртки контента (раскладка списка: flex-wrap у чипов,
  //- flex-col + gap у секций тела фильтров)
  contentClass: { type: String, default: '' },
})

const viewport = ref(null)
//- Рельса видна только у действительно переполненного списка
const scrollable = ref(false)
const thumbTop = ref(0)
const thumbHeight = ref(0)

const thumbStyle = computed(() => ({
  top: `${thumbTop.value}px`,
  height: `${thumbHeight.value}px`,
}))

//- Пересчёт геометрии: размер thumb = доля видимой части списка,
//- позиция = доля прокрутки (пропорционально треку)
const update = () => {
  const el = viewport.value
  if (!el || el.clientHeight === 0) {
    scrollable.value = false
    return
  }
  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 1) {
    scrollable.value = false
    //- Thumb тоже обнуляем: без этого после транзитных состояний
    //- раскладки остаётся призрак старого thumb
    thumbHeight.value = 0
    thumbTop.value = 0
    return
  }
  const track = el.clientHeight - RAIL_INSET * 2
  const height = Math.min(
    track,
    Math.max(MIN_THUMB_PX, Math.round((el.clientHeight / el.scrollHeight) * track)),
  )
  scrollable.value = true
  thumbHeight.value = height
  thumbTop.value = Math.round((el.scrollTop / maxScroll) * (track - height))
}

let observer = null

onMounted(() => {
  update()
  //- RO нужен, потому что высота списка меняется БЕЗ событий scroll:
  //- фасеты приходят асинхронно, раскрывается группа, меняется локаль,
  //- сжимается секция при ресайзе окна
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    observer = new ResizeObserver(() => update())
    observer.observe(viewport.value)
    if (viewport.value.firstElementChild) {
      observer.observe(viewport.value.firstElementChild)
    }
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>
