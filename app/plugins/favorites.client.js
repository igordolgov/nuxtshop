// plugins/favorites.client.js
export default defineNuxtPlugin((nuxtApp) => {
  const favorites = useFavorites()
  
  return {
    provide: {
      favorites: {
        items: favorites.favorites,
        add: favorites.addToFavorites,
        remove: favorites.removeFromFavorites,
        clear: favorites.clearFavorites,
        isFavorite: favorites.isFavorite,
        toggle: favorites.toggleFavorite
      }
    }
  }
})