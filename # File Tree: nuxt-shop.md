# File Tree: nuxt-shop

**Generated:** 29.09.2026, 08:43:05
**Root Path:** `/home/igor/Документы/nuxt-shop`

```
├── app
│   ├── assets
│   │   └── css
│   │       ├── main.css
│   │       ├── scroll-indicator.css
│   │       └── tokens.css
│   ├── components
│   │   ├── admin
│   │   │   ├── AddProductModal.vue
│   │   │   ├── AdminProductItem.vue
│   │   │   ├── AdminProducts.vue
│   │   │   ├── AdminProductsDropdowns.vue
│   │   │   ├── AdminProductsFilters.vue
│   │   │   ├── AdminProductsHeader.vue
│   │   │   ├── AdminProductsTable.vue
│   │   │   ├── AdminUsers.vue
│   │   │   ├── EditProductModal.vue
│   │   │   ├── ImagePickerModal.vue
│   │   │   └── ProductForm.vue
│   │   ├── cart
│   │   ├── checkout
│   │   ├── filters
│   │   │   ├── ActiveFilters.vue
│   │   │   ├── ActivePriceFilter.vue
│   │   │   └── FilterPanel.vue
│   │   ├── layout
│   │   │   ├── CatalogHeader.vue
│   │   │   ├── DesktopSidebar.vue
│   │   │   ├── Header.vue
│   │   │   ├── MainContent.vue
│   │   │   ├── MobileFiltersPanel.vue
│   │   │   └── MobileNavFooter.vue
│   │   ├── modals
│   │   ├── products
│   │   │   ├── ProductCard.vue
│   │   │   ├── ProductCardFavorite.vue
│   │   │   ├── ProductCardGrid.vue
│   │   │   ├── ProductCardList.vue
│   │   │   ├── ProductCategories.vue
│   │   │   ├── ProductFilter.vue
│   │   │   ├── ProductGallery.vue
│   │   │   ├── ProductInfo.vue
│   │   │   ├── ProductList.vue
│   │   │   ├── ProductPriceRange.vue
│   │   │   ├── ProductSearch.vue
│   │   │   ├── ProductSort.vue
│   │   │   ├── ProductStockFavorites.vue
│   │   │   ├── ProductsSection.vue
│   │   │   ├── SimilarProducts.vue
│   │   │   └── SmartSearchInput.vue
│   │   ├── ui
│   │   │   ├── AppLoader.vue
│   │   │   ├── ImageZoom.vue
│   │   │   ├── MobileOverlay.vue
│   │   │   └── Modal.vue
│   │   ├── InstallPrompt.vue
│   │   ├── OfflineIndicator.vue
│   │   ├── ScrollToTop.vue
│   │   └── error-404.vue
│   ├── composables
│   │   ├── useAppState.js
│   │   ├── useAuth.js
│   │   ├── useCart.js
│   │   ├── useFavorites.js
│   │   ├── useFilters.js
│   │   ├── useLocalStorage.js
│   │   ├── useMobileDetection.js
│   │   ├── useNotifications.js
│   │   ├── useNotifyQueue.js
│   │   ├── useOffline.js
│   │   ├── useOfflineStorage.js
│   │   ├── useProductUtils.js
│   │   ├── useProducts.js
│   │   ├── useSearchHighlight.js
│   │   └── useUserStore.js
│   ├── layouts
│   │   ├── auth.vue
│   │   ├── custom.vue
│   │   └── default.vue
│   ├── middleware
│   │   ├── admin-auth.js
│   │   ├── auth-init.global.js
│   │   ├── manager-auth.js
│   │   └── user-auth.js
│   ├── pages
│   │   ├── admin
│   │   │   ├── index.vue
│   │   │   ├── products.vue
│   │   │   └── users.vue
│   │   ├── auth
│   │   │   ├── login.vue
│   │   │   └── register.vue
│   │   ├── cart
│   │   │   ├── checkout.vue
│   │   │   └── index.vue
│   │   ├── product
│   │   │   └── [slug].vue
│   │   ├── user
│   │   │   └── index.vue
│   │   ├── about.vue
│   │   ├── contacts.vue
│   │   ├── emergency-logout.vue
│   │   ├── favorites.vue
│   │   ├── force-reset.vue
│   │   ├── index.vue
│   │   ├── news.vue
│   │   └── settings.vue
│   ├── plugins
│   │   ├── auth.client.js
│   │   ├── error-handler.ts
│   │   ├── hydration.client.js
│   │   ├── notify.client.js
│   │   └── offline-init.client.js
│   ├── public
│   │   ├── apple-touch-icon.png
│   │   ├── favicon.ico
│   │   ├── pwa-192x192.png
│   │   ├── pwa-512x512.png
│   │   └── site.webmanifest
│   ├── app.vue
│   └── error.vue
├── backend
│   ├── data
│   │   └── users.json
│   ├── middleware
│   │   ├── auth.js
│   │   └── guest.ts
│   ├── routes
│   │   ├── admin.js
│   │   └── auth.js
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
├── plugins
├── public
│   ├── images
│   │   ├── products
│   │   │   ├── product-1762571853762-gallery-0-1762571854668.webp
│   │   │   ├── product-1762571853762-gallery-1-1762571854786.webp
│   │   │   ├── product-1762571853762-gallery-2-1762571855059.webp
│   │   │   ├── product-1762571853762-main-1762571854347.webp
│   │   │   ├── product-1762573066552-gallery-0-1762573067307.webp
│   │   │   ├── product-1762573066552-gallery-1-1762573067626.webp
│   │   │   ├── product-1762573066552-gallery-2-1762573068003.webp
│   │   │   ├── product-1762573066552-gallery-3-1762573068391.webp
│   │   │   ├── product-1762573066552-gallery-4-1762573068896.webp
│   │   │   ├── product-1762573066552-main-1762573066912.webp
│   │   │   ├── product-1762624175583-main-1762624175865.webp
│   │   │   ├── product-1762798961220-gallery-0-1763472850298.webp
│   │   │   ├── product-1762798961220-gallery-0-1763472878330.webp
│   │   │   ├── product-1762798961220-gallery-0-1763473595955.webp
│   │   │   ├── product-1762798961220-gallery-0-1763473620524.webp
│   │   │   ├── product-1762798961220-gallery-0-1763473703268.webp
│   │   │   ├── product-1762798961220-gallery-0-1763473707176.webp
│   │   │   ├── product-1762798961220-gallery-0-1763474289006.webp
│   │   │   ├── product-1762798961220-gallery-0-1763474361041.webp
│   │   │   ├── product-1762798961220-gallery-1-1763472850800.webp
│   │   │   ├── product-1762798961220-gallery-1-1763472878774.webp
│   │   │   ├── product-1762798961220-gallery-1-1763473621052.webp
│   │   │   ├── product-1762798961220-gallery-1-1763473703848.webp
│   │   │   ├── product-1762798961220-gallery-1-1763474289224.webp
│   │   │   ├── product-1762798961220-gallery-1-1763474361244.webp
│   │   │   ├── product-1762798961220-gallery-2-1763472851258.webp
│   │   │   ├── product-1762798961220-gallery-2-1763472879229.webp
│   │   │   ├── product-1762798961220-gallery-2-1763473621618.webp
│   │   │   ├── product-1762798961220-gallery-2-1763474289430.webp
│   │   │   ├── product-1762798961220-gallery-2-1763474361426.webp
│   │   │   ├── product-1762798961220-gallery-3-1763472851737.webp
│   │   │   ├── product-1762798961220-gallery-3-1763472879740.webp
│   │   │   ├── product-1762798961220-gallery-3-1763473622198.webp
│   │   │   ├── product-1762798961220-gallery-3-1763474289676.webp
│   │   │   ├── product-1762798961220-gallery-3-1763474361625.webp
│   │   │   ├── product-1762798961220-gallery-4-1763472852249.webp
│   │   │   ├── product-1762798961220-gallery-4-1763473622745.webp
│   │   │   ├── product-1762798961220-gallery-4-1763474289879.webp
│   │   │   ├── product-1762798961220-gallery-4-1763474361806.webp
│   │   │   ├── product-1762798961220-gallery-4-1763514105793.webp
│   │   │   ├── product-1762798961220-gallery-5-1763474290120.webp
│   │   │   ├── product-1762798961220-main-1762803501471.webp
│   │   │   ├── product-1763475224972-gallery-0-1763475225528.webp
│   │   │   ├── product-1763475224972-gallery-1-1763475225688.webp
│   │   │   ├── product-1763475224972-gallery-2-1763475225875.webp
│   │   │   ├── product-1763475224972-gallery-3-1763475226077.webp
│   │   │   ├── product-1763475224972-gallery-4-1763475226323.webp
│   │   │   ├── product-1763475224972-main-1763475225313.webp
│   │   │   ├── product-1763475513756-gallery-0-1763475514318.webp
│   │   │   ├── product-1763475513756-gallery-1-1763475514472.webp
│   │   │   ├── product-1763475513756-gallery-2-1763475514624.webp
│   │   │   ├── product-1763475513756-gallery-3-1763475514757.webp
│   │   │   ├── product-1763475513756-gallery-4-1763475514926.webp
│   │   │   ├── product-1763475513756-main-1763475514096.webp
│   │   │   ├── product-1764954979503-main-1764954979723.webp
│   │   │   ├── product-1766629618114-main-1766629618170.webp
│   │   │   ├── product-1766669225416-main-1766669225606.webp
│   │   │   ├── product-1766716896301-main-1766716896460.webp
│   │   │   ├── product-1766758041436-main-1766758041777.webp
│   │   │   ├── product-1766758229700-main-1766758229742.webp
│   │   │   ├── product-1766758375227-main-1766758375332.webp
│   │   │   ├── product-1766758439114-main-1766758439412.webp
│   │   │   ├── product-1766759851788-main-1766759852056.webp
│   │   │   ├── product-1767579665511-main-1767579665819.webp
│   │   │   ├── product-1769520257062-gallery-0-1769520257473.webp
│   │   │   ├── product-1769520257062-gallery-1-1769520257618.webp
│   │   │   ├── product-1769520257062-gallery-2-1769520257770.webp
│   │   │   ├── product-1769520257062-main-1769520257278.webp
│   │   │   ├── product-1770067796203-gallery-0-1770067796494.webp
│   │   │   ├── product-1770067796203-gallery-1-1770067796708.webp
│   │   │   ├── product-1770067796203-gallery-2-1770067796898.webp
│   │   │   ├── product-1770067796203-main-1770067796370.webp
│   │   │   ├── product-31-gallery-0-1788296766664.webp
│   │   │   └── product-31-main-1771520260558.webp
│   │   ├── no-image.svg
│   │   └── placeholder.jpg
│   ├── apple-touch-icon.png
│   ├── favicon.ico
│   ├── products.json
│   ├── pwa-192x192.png
│   └── pwa-512x512.png
├── server
│   ├── api
│   │   ├── admin
│   │   │   ├── users
│   │   │   │   ├── [id]
│   │   │   │   │   └── role.put.js
│   │   │   │   └── [id].delete.js
│   │   │   ├── stats.get.js
│   │   │   └── users.get.js
│   │   ├── auth
│   │   │   ├── current-user.get.js
│   │   │   ├── emergency-logout.post.js
│   │   │   ├── login.post.js
│   │   │   ├── logout.post.js
│   │   │   ├── profile.put.js
│   │   │   ├── register.post.js
│   │   │   └── user.get.js
│   │   ├── data
│   │   │   └── users.json
│   │   ├── product
│   │   │   └── [slug].js
│   │   └── products
│   │       ├── [id].delete.js
│   │       ├── [id].put.js
│   │       ├── index.get.js
│   │       └── index.post.js
│   ├── data
│   │   ├── products.json
│   │   └── users.json
│   ├── lib
│   │   ├── authHelpers.js
│   │   ├── imageCleaner.js
│   │   ├── imageOptimizer.js
│   │   ├── imageStorage.js
│   │   ├── logger.js
│   │   ├── productHelpers.js
│   │   ├── seedAdmin.js
│   │   └── userHelpers.js
│   ├── middleware
│   │   ├── debug.js
│   │   ├── redirect.js
│   │   └── session-cookies.js
│   └── utils
│       └── session.js
├── .gitignore
├── .markuplintrc
├── .oxfmtrc.json
├── .oxlintrc.json
├── README.md
├── knip.json
├── nuxt-shop.txt
├── nuxt.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tailwind.config.js
├── tsconfig.json
└── wrangler.jsonc
```

---

_Generated by FileTree Pro Extension_
