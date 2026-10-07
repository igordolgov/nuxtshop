<!-- CartItem.vue - дочерний компонент элемента корзины -->
<template lang="pug">
.cart-item(:class="{ 'item-removing': isRemoving }")
  .item-image
    NuxtImg(
      :src="item.image || '/images/placeholder.jpg'"
      :alt="item.name"
      @error="handleImageError"
    )
    .item-badges
      .discount-badge(v-if="item.discount > 0") -{{ item.discount }}%
  
  .item-details
    h3.item-name {{ item.name }}
    p.item-category(v-if="item.category") {{ item.category }}
    
    .price-section
      .current-price {{ formatPrice(item.currentPrice) }}
      .old-price(v-if="item.originalPrice && item.originalPrice > item.currentPrice")
        | {{ formatPrice(item.originalPrice) }}
    
    .stock-info(:class="getStockClass(item.stock)")
      | {{ getStockText(item.stock) }}
  
  .item-controls
    .quantity-controls
      button.quantity-btn(
        @click="decreaseQuantity"
        :disabled="item.quantity <= 1 || isProcessing"
      ) −
      
      input.quantity-input(
        type="number"
        v-model.number="localQuantity"
        :min="1"
        :max="item.stock"
        @change="validateQuantity"
        :disabled="isProcessing"
      )
      
      button.quantity-btn(
        @click="increaseQuantity"
        :disabled="item.quantity >= item.stock || isProcessing"
      ) +
    
    .item-actions
      button.remove-btn(
        @click="removeItem"
        :disabled="isProcessing"
      )
        span Удалить
      
      button.wishlist-btn(@click="moveToWishlist")
        span В избранное
</template>

<script>
export default {
  name: 'CartItem',
  props: {
    item: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      isRemoving: false,
      isProcessing: false,
      localQuantity: this.item.quantity
    }
  },
  watch: {
    localQuantity(newVal) {
      if (newVal !== this.item.quantity) {
        this.$emit('update-quantity', this.item.id, newVal)
      }
    }
  },
  methods: {
    decreaseQuantity() {
      if (this.localQuantity > 1) {
        this.localQuantity--
      }
    },
    increaseQuantity() {
      if (this.localQuantity < this.item.stock) {
        this.localQuantity++
      }
    },
    validateQuantity() {
      if (this.localQuantity < 1) {
        this.localQuantity = 1
      }
      if (this.localQuantity > this.item.stock) {
        this.localQuantity = this.item.stock
      }
    },
    removeItem() {
      this.isRemoving = true
      setTimeout(() => {
        this.$emit('remove-item', this.item.id)
      }, 400)
    },
    moveToWishlist() {
      // Логика перемещения в избранное
    },
    handleImageError(event) {
      event.target.src = '/images/placeholder.jpg'
    },
    getStockClass(stock) {
      if (stock === 0) return 'out-of-stock'
      if (stock < 10) return 'low-stock'
      return 'in-stock'
    },
    getStockText(stock) {
      if (stock === 0) return 'Нет в наличии'
      if (stock < 10) return `Осталось ${stock} шт.`
      return 'В наличии'
    },
    formatPrice(price) {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
      }).format(price)
    }
  }
}
</script>