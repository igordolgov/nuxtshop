<!-- app/components/admin/AdminProductsTable.vue -->
<template lang="pug">
.h-full.flex.flex-col.bg-base-100
  //- Загрузка
  .flex-1.flex.items-center.justify-center(v-if="loading")
    div.text-center
      span.loading.loading-spinner.loading-lg.text-primary
      p.mt-3.text-base.opacity-70 Загрузка товаров...

  //- Пустое состояние
  .flex-1.flex.items-center.justify-center(v-else-if="products.length === 0")
    div.text-center
      .text-5xl.mb-3.opacity-30 📦
      h3.text-lg.font-semibold.mb-2 Товары не найдены
      p.text-sm.opacity-70.mb-3 {{ emptyMessage }}
      button.btn.btn-primary.btn-sm(@click="$emit('refresh')" type="button") Обновить

  //- Таблица с товарами
  .flex-1.flex.flex-col.min-h-0(v-else)
    //- Прокручиваемая область с таблицей
    .table-wrapper.flex-1.overflow-auto
      //- Десктопная таблица
      .desktop-table(class="hidden sm:block")
        table.table.table-zebra.w-full
          thead.sticky.top-0.bg-base-200.z-10
            tr
              th.w-14 Фото
              th Название
              th.w-20.text-right Цена
              th.w-24 Категории
              th.w-20 Кол-во
              th.w-20 Действия
          tbody
            tr(v-for="product in products" :key="product.id")
              td
                .avatar
                  .mask.mask-squircle.w-9.h-9.bg-base-200
                    img(
                      v-if="getSafeImage(product.image)"
                      :src="getSafeImage(product.image)"
                      :alt="product.name"
                      @error="onImageError($event)"
                    )
                    .w-full.h-full.flex.items-center.justify-center(v-else)
                      icon(name="heroicons:photo" size="16")

              td
                NuxtLink.font-medium.hover-underline(
                  :to="getProductUrl(product)"
                  v-html="highlightText(product.name)"
                  prefetch
                )
                .text-xs.opacity-50(v-if="product.description" class="mt-0.5") 
                  | {{ truncate(product.description, 50) }}

              td.text-right
                .font-semibold {{ formatPrice(product.price) }}₽

              td
                .flex.flex-wrap(class="gap-0.5")
                  span.badge.badge-xs.badge-secondary.text-white.opacity-70.rounded-sm(
                    v-for="cat in getCategories(product.categories)"
                    :key="cat"
                  ) {{ cat }}

              td
                .badge.badge-sm.min-w-10.rounded-sm(
                  :class="product.inStock ? 'badge-success' : 'badge-error'"
                )
                  | {{ product.inStock ? `${product.stockQuantity || 0}` : 'Нет' }}

              td
                .flex.gap-4
                  button.text-info.cursor-pointer(
                    @click="$emit('edit', product)"
                    type="button"
                  )
                    icon(name="heroicons:pencil-square" size="16")
                  button.text-error.cursor-pointer(
                    @click="$emit('delete', product)"
                    type="button"
                  )
                    icon(name="heroicons:trash" size="16")

      //- Мобильный список карточек
      .mobile-cards.flex.flex-col.p-0.pb-12(class="sm:hidden")
        .card.bg-base-200.shadow-sm(
          v-for="product in products"
          :key="product.id"
        )
          .card-body.p-3
            .flex.gap-3
              //- Фото
              .avatar.flex-shrink-0
                .mask.mask-squircle.w-12.h-12.bg-base-300
                  img(
                    v-if="getSafeImage(product.image)"
                    :src="getSafeImage(product.image)"
                    :alt="product.name"
                    @error="onImageError($event)"
                  )
                  .w-full.h-full.flex.items-center.justify-center(v-else)
                    icon(name="heroicons:photo" size="20")

              //- Инфо
              .flex-1.min-w-0
                NuxtLink.font-medium.text-sm.block.truncate(
                  :to="getProductUrl(product)"
                  v-html="highlightText(product.name)"
                  prefetch
                )
                .flex.items-center.gap-2.mt-1
                  span.font-bold.text-sm {{ formatPrice(product.price) }}₽
                  .badge.badge-sm.font-medium.rounded-sm(
                    :class="product.inStock ? 'badge-success' : 'badge-error'"
                  )
                    | {{ product.inStock ? `${product.stockQuantity || 0} шт` : 'Нет' }}

              //- Действия - увеличенные кнопки
              .flex.gap-2.items-center
                button.btn.btn-circle.btn-ghost.text-info(
                  @click="$emit('edit', product)"
                  type="button"
                )
                  icon(name="heroicons:pencil-square" size="20")
                button.btn.btn-circle.btn-ghost.text-error(
                  @click="$emit('delete', product)"
                  type="button"
                )
                  icon(name="heroicons:trash" size="20")
</template>

<script setup>
const props = defineProps({
  products: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  emptyMessage: { type: String, default: 'Добавьте первый товар' },
  stats: { type: Object, default: () => ({}) }
})

defineEmits(['edit', 'delete', 'refresh'])

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU').format(price || 0)
}

const getProductUrl = (product) => `/product/${product.slug || product.id}`

const getSafeImage = (url) => {
  if (!url || url.includes('placeholder')) return null
  return url
}

const getCategories = (cats) => {
  return Array.isArray(cats) ? cats.slice(0, 2) : []
}

const truncate = (text, length) => {
  if (!text) return ''
  return text.length > length ? text.slice(0, length) + '...' : text
}

const highlightText = (text) => {
  if (!props.searchQuery || !text) return text
  const q = props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${q})`, 'gi'), '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>')
}

const onImageError = (e) => { e.target.style.display = 'none' }
</script>

<style scoped>
.table {
  font-size: 16px;
}

.table th {
  font-size: 14px;
  font-weight: 600;
  padding: 6px 10px;
  white-space: nowrap;
}

.table td {
  padding: 6px 10px;
  vertical-align: middle;
}

.table tbody tr {
  height: 44px;
}

.hover-underline:hover {
  text-decoration: underline;
}

.table-wrapper {
  min-height: 0;
}

.desktop-table {
  display: none;
}

.mobile-cards {
  display: flex;
}

@media (min-width: 640px) {
  .desktop-table {
    display: block;
  }
  
  .mobile-cards {
    display: none;
  }
}
</style>