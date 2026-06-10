<!-- app/components/products/SimilarProducts.vue -->
<template lang="pug">
.similar-products(
	v-if="products.length > 0"
	class="px-2 pb-15 lg:mt-0 lg:mb-3 lg:pb-3"
)
	.container.mx-auto.px-2(class="lg:px-4")
		h2.text-xl.font-semibold.mb-2(class="lg:text-2xl lg:mb-3") Похожие товары:
		
		.grid.grid-cols-2.gap-1(
			class="sm:grid-cols-3 lg:grid-cols-4 lg:gap-4"
		)
			.similar-product-card(
				v-for="item in products"
				:key="item.id"
			)
				.card.bg-base-100.shadow-md.transition-all.duration-300.h-full.flex.flex-col.group(class="hover:shadow-lg")
					//- Кнопки действий
					.absolute.top-1.left-2.z-10
						button.btn.btn-circle.btn-xs(
							:class="item.isFavorite ? 'btn-error text-error-content' : 'btn-ghost bg-base-100/80'"
							@click.stop="$emit('toggle-favorite', item.id)"
							:title="item.isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'"
						)
							svg.w-4.h-4(
								:class="item.isFavorite ? 'fill-current' : 'fill-none stroke-current text-base-content/70'"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								stroke-width="1.5"
							)
								path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")
					
					.absolute.top-1.right-2.z-10
						button.btn.btn-circle.btn-xs(
							@click.stop="$emit('add-to-cart', item)"
							:disabled="!item.inStock || isInCart(item.id)"
							:class="isInCart(item.id) ? 'btn-success text-success-content' : 'btn-primary text-primary-content'"
							:title="isInCart(item.id) ? 'Уже в корзине' : 'Добавить в корзину'"
						)
							svg.w-6.h-6(
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							)
								path(
									v-if="!isInCart(item.id)"
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 6v6m0 0v6m0-6h6m-6 0H6"
								)
								path(
									v-else
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M5 13l4 4L19 7"
								)

					//- Ссылка на товар
					NuxtLink.flex-1.flex.flex-col(:to="getProductUrl(item)" prefetch)
						figure.p-1.pt-0.flex.justify-center.items-center(class="lg:h-40")
							NuxtImg.rounded-box.w-full.object-cover.max-w-full(
								:src="getValidImageUrl(item.image)"
								:alt="item.name"
								@error="handleImageError"
								draggable="false"
								placeholder
								:fallback="fallbackImage"
								:width="400"
								:height="300"
								provider="ipx"
							)
						
						.card-body.p-1.flex-1.flex.flex-col
							.flex-1
								h3.card-title.text-xs.font-semibold.text-base-content.line-clamp-2.mb-1(class="lg:text-sm") {{ item.name }}
								p.text-xs.text-base-content.opacity-70.line-clamp-2.max-h-10(class="lg:text-xs") {{ item.description }}
							
							.flex.items-center.justify-between.-mt-1.border-t.border-base-200
								.text-md.font-bold.text-sky-600 {{ formatPrice(item.price) }}
								.text-xs(
									:class="item.inStock ? 'text-success' : 'text-error'"
								) {{ item.inStock ? 'В наличии' : 'Нет в наличии' }}
</template>

<script setup>
const props = defineProps({
	products: { type: Array, default: () => [] },
	isInCart: { type: Function, required: true }
})

defineEmits(['toggle-favorite', 'add-to-cart'])

const { getProductUrl } = useCart()

const fallbackImage = '/images/placeholder.jpg'

const getValidImageUrl = (url) => {
	if (!url) return fallbackImage
	if (url.startsWith('data:')) return url
	if (url.startsWith('/')) return url
	if (url.includes('unsplash.com')) return url
	if (url.startsWith('http')) return url
	return fallbackImage
}

const formatPrice = (price) => {
	if (!price && price !== 0) return '0 ₽'
	return `${price.toLocaleString('ru-RU')} ₽`
}

const handleImageError = (event) => {
	if (event?.target) event.target.src = fallbackImage
}
</script>

<style scoped>
.similar-products {
	width: 100%;
}

.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>