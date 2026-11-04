// nuxt.config.ts
// Конфигурация Nuxt для проекта nuxt-shop:
// Tailwind CSS 4 + daisyUI, PWA (Workbox), Cloudflare (nitro preset),
// оптимизация сборки (terser/lightningcss), автосбор иконок и изображений.

import tailwindcss from '@tailwindcss/vite';
import removeConsole from 'vite-plugin-remove-console';

const isProd = process.env.NODE_ENV === 'production';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Клиентский API-базовый URL. Пусто по умолчанию → useApi ходит на
  // /api/** того же origin (Nitro). Задать на рантайме можно env-ом
  // NUXT_PUBLIC_API_BASE_URL (см. vars в wrangler.jsonc) — тогда useApi
  // будет ходить на внешний сервер, а в <head> добавится preconnect.
  // siteUrl: канонический origin для og:image/JSON-LD/sitemap — на
  // Cloudflare Workers getRequestURL() отдаёт http://localhost, поэтому
  // боевой домен задаётся env-переменной (vars в wrangler.jsonc);
  // пусто (dev) — берём origin запроса.
  runtimeConfig: {
    public: {
      apiBaseUrl: '',
      siteUrl: '',
      // Аварийный выключатель трансформатора /img: 'off' → роут отвечает
      // 302 на оригинал. Меняется vars в wrangler.jsonc / дашборде БЕЗ
      // пересборки. Пусто — трансформации включены.
      imgTransform: '',
    },
  },

  experimental: {
    componentIslands: true,
    inlineRouteRules: true,
  },

  vite: {
    build: {
      minify: 'terser',
      cssMinify: 'lightningcss',
      terserOptions: {
        compress: { drop_debugger: true, passes: 2 },
        format: { comments: false },
      },
      target: 'es2022',
      sourcemap: false,
      reportCompressedSize: false,
      modulePreload: { polyfill: false },
      chunkSizeWarningLimit: 1000,
    },
    css: {
      devSourcemap: false,
      transformer: 'lightningcss',
    },
    // Условное spread вместо [.filter(Boolean) as any]: типы точные, any не нужен
    plugins: [tailwindcss(), ...(isProd ? [removeConsole({ includes: ['log', 'debug'] })] : [])],
    // Список чистый: только реально используемые пакеты (pinia снята —
    // стейт на useState, см. вердикт по модулям в этапе 6).
    // Записи @vue/devtools-* (если появятся) добавляет сам Nuxt —
    // предупреждение NUXT_B7002 на прод не влияет.
    optimizeDeps: {
      include: ['@vueuse/core', 'idb', 'vue', 'vue-router'],
    },
  },

  nitro: {
    preset: 'cloudflare-module',
    esbuild: {
      options: { target: 'es2022' },
    },
    experimental: {
      asyncContext: true,
    },
    minify: true,
    sourceMap: false,
    compressPublicAssets: {
      brotli: true,
      gzip: true,
    },
    prerender: {
      crawlLinks: false,
      // ВАЖНО: '/' здесь НЕТ — каталог должен рендериться на рантайме
      // (SSR со свежими товарами из KV, см. useAsyncData в index.vue).
      // Пререндер главной запёк бы товары на момент билда: новые товары
      // из /admin не появлялись бы до следующего деплоя.
      // То же для '/news', '/about' и '/contacts': новости (data:news) и
      // контент страниц (data:content) редактируются из адинки, а KV на
      // этапе сборки недоступен — статика застыла бы на сиде/дефолтах.
      // Живой рендер каждый запрос — кэш-заголовки см. в routeRules ниже.
      routes: ['/offline'],
    },
    routeRules: {
      // Публичные SSR-страницы: браузер всегда ревалидирует HTML по ETag.
      // Раньше тут был swr: 60 (только CDN-директива s-maxage — для браузера
      // её нет), и Opera/Android неделями держала старую копию после деплоя:
      // пользователь не видел новых фич, пока не делал жёсткое обновление.
      // Без swr рендер выполняется на каждый запрос (воркер + KV — быстро),
      // зато HTML всегда свежий: правки из /admin/news и /admin/content
      // видны мгновенно, бургер-меню обновляется сразу после деплоя.
      // (routeRules.headers для swr-маршрутов Nitro перебивает — поэтому
      // свр для HTML убраны совсем; не-HTML-заголовки довешивает
      // server/plugins/html-cache-control.ts.)
      '/': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/news': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/about': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/contacts': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      // Карточка товара. На карточке выводится «Осталось: N шт.»
      // (ProductInfo.vue), а наличие меняется при каждом подтверждении/
      // отмене заказа (Telegram-вебхук, админка) — HTML всегда ревалидируется,
      // покупатель видит актуальный остаток сразу.
      // /api/product/[slug] не кэшируется.
      '/product/**': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      // SEO-файлы генерируются сервером (server/routes); кэш с фоновым
      // обновлением: robots — сутки, sitemap — час
      '/robots.txt': { swr: 86400 },
      '/sitemap.xml': { swr: 3600 },
      // Локализованные префиксы /en и /es повторяют правила исходных
      // маршрутов: routeRules матчятся по литеральному префиксу пути,
      // '/product/**' НЕ покрывает '/en/product/**' — нужны дубли.
      '/en': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/es': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/en/news': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/es/news': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/en/about': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/es/about': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/en/contacts': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/es/contacts': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/en/product/**': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
      '/es/product/**': { headers: { 'Cache-Control': 'max-age=0, must-revalidate' } },
    },
  },

  modules: [
    '@nuxt/image',
    '@nuxt/icon',
    '@vite-pwa/nuxt',
    '@nuxtjs/i18n',
    '@baptistecrouzet/nuxt-oxlint',
    // '@pinia/nuxt' УДАЛЁН (этап 6, вердикт по модулям): в коде нет ни
    // одного defineStore/импорта pinia — стейт живёт в useState/composables.
    // Пакеты pinia и @pinia/nuxt сняты с зависимостей.
  ],

  // Локализация витрины: ru (по умолчанию, без префикса), en (/en), es (/es).
  // Стратегия prefix_except_default: язык ВСЕГДА виден в URL (кроме ru) —
  // детерминированный SSR без hydration mismatch (в отличие от cookie-детекта).
  // detectBrowserLanguage отключён сознательно: авто-редирект по языку браузера
  // ломал бы swr-кэш главной и SEO (один URL — один язык).
  // Админка (/admin/**) локализуется теми же префиксами (/en/admin, /es/admin):
  // RU-версия без префикса, EN/ES — через переключатель в шапке. Персонал
  // может работать на любом из трёх языков витрины.
  i18n: {
    defaultLocale: 'ru',
    strategy: 'prefix_except_default',
    // baseUrl для абсолютных hreflang/alternate-ссылок (SEO)
    baseUrl: 'https://nuxt-shop.igordolgov1972.workers.dev',
    locales: [
      { code: 'ru', language: 'ru-RU', name: 'Русский', file: 'ru.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'es', language: 'es-ES', name: 'Español', file: 'es.json' },
    ],
    langDir: 'locales',
    // Отключаем авто-редирект по языку браузера: SSR всегда рендерит
    // язык из URL. Переключение — только руками через переключатель.
    detectBrowserLanguage: false,
  },

  oxlint: {
    checker: {
      configFile: '.oxlintrc.json',
      path: 'app',
      failOnError: false,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
    devOptions: { enabled: false, type: 'module' },
    client: { installPrompt: true, registerPlugin: true },
    strategies: 'generateSW',
    manifest: {
      name: 'Магазин',
      short_name: 'Магазин',
      description: 'Интернет-магазин с оффлайн поддержкой',
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/',
      start_url: '/',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      // SSR-режим: HTML НЕ кэшируем — навигации всегда в сеть,
      // страницы рендерит сервер. Раньше html был в globPatterns и
      // navigateFallback отдавал кэшированную главную вместо
      // динамических страниц (/user и др.): «/user открывает главную».
      globPatterns: ['**/*.{js,css,png,svg,ico,woff,woff2}'],

      // Явно отключаем navigateFallback (для SSR он не нужен).
      // Оффлайн-UX обеспечивает /offline-страница через OfflineIndicator.
      navigateFallback: undefined,

      runtimeCaching: [
        // ⚠️ Запись «pages-cache» с паттерном /(cart|favorites|user|product)/i
        // УДАЛЕНА: кэшировала SSR-HTML (персональные страницы!) и по
        // подстроке цепляла /api/auth/user и /api/products.
        // JSON каталога кэшируем точечно:
        {
          urlPattern: /\/api\/products/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-products',
            networkTimeoutSeconds: 10,
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
      ],
    },
  },

  icon: {
    provider: 'iconify',
    collections: ['heroicons', 'mdi'],
    componentName: 'Icon',
    clientBundle: {
      scan: true,
      sizeLimitKb: 256,
    },
  },

  image: {
    // Кастомный провайдер (app/providers/cfWorkersImage.ts): NuxtImg строит
    // /img?src=...&w=... — server/routes/img.ts применяет Cloudflare Image
    // Transformations методом fetch(url, { cf: { image } }), единственный
    // работающий на *.workers.dev (встроенный `cloudflare` строит
    // /cdn-cgi/image/* — только для собственной зоны). НЕ возвращать 'none'
    // и не указывать встроенный 'cloudflare' — см. AGENTS.md §2.
    provider: 'cfworkers',
    providers: {
      cfworkers: {
        name: 'cfworkers',
        provider: '~/providers/cfWorkersImage',
        options: { baseURL: '/img' },
      },
    },
    format: ['webp'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536,
    },
    presets: {
      product: { modifiers: { format: 'webp', quality: 80, width: 400, height: 400 } },
      thumbnail: { modifiers: { format: 'webp', quality: 70, width: 150, height: 150 } },
    },
  },

  components: [{ path: '~/components', pathPrefix: false }],

  imports: {
    dirs: ['composables', 'stores', 'utils', 'utils/**'],
    autoImport: true,
  },

  app: {
    head: {
      title: 'Интернет-магазин',
      // lang на <html> выставляет @nuxtjs/i18n (useLocaleHead в app.vue)
      // по текущей локали маршрута — статический 'ru' убран.
      meta: [
        { name: 'description', content: 'Лучший интернет-магазин' },
        { name: 'keywords', content: 'товары, покупки, магазин' },
        { name: 'format-detection', content: 'telephone=no' },
        // viewport-fit=cover ОБЯЗАТЕЛЕН: без него env(safe-area-inset-*) = 0,
        // и фиксированные слои (нижнее меню, FAB) прилипают к жестовой полосе iPhone
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        // Цвет статус-бара/окна PWA под каждую тему (Android, Safari 15+).
        // ⚙️ НАСТРОЙКА: тёмное значение подогнать под base-100 темы business
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#1e293b' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Магазин' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        // preconnect — ТОЛЬКО на внешний API, если он задан на сборке.
        // Раньше здесь был жёсткий preconnect на API_BASE || 'http://localhost:3001':
        // в проде API_BASE не задан → каждый посетитель открывал TCP+TLS к
        // localhost:3001 (аудит Lighthouse «Preconnect to required origins»).
        // Клиент ходит на /api/** того же origin — preconnect ему не нужен.
        // Имя переменной согласовано с runtimeConfig.public.apiBaseUrl.
        ...(process.env.NUXT_PUBLIC_API_BASE_URL
          ? [{ rel: 'preconnect', href: process.env.NUXT_PUBLIC_API_BASE_URL } as const]
          : []),
        // Preconnect к images.unsplash.com удалён: фото каталога переехали
        // на /images/products/* (тот же origin) — греть чужой origin больше
        // не для чего, соединение только тормозило первый рендер.
        // Иконки, не попавшие в клиентский бандл (clientBundle.scan
        // покрывает шаблоны), дозагружаются с api.iconify.design.
        // preconnect вместо dns-prefetch: заранее открывает соединение.
        { rel: 'preconnect', href: 'https://api.iconify.design' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
      ],
      script: [
        {
          // Тема до первой отрисовки. Только валидные имена тем:
          // старый мусор ('light'/'dark') мигрирует на тему по настройке ОС.
          innerHTML: `(function(){try{var t=localStorage.getItem('theme');if(t!=='corporate'&&t!=='business'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'business':'corporate';localStorage.setItem('theme',t);}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          type: 'text/javascript',
          tagPosition: 'head',
        },
      ],
    },
    // Переход между страницами: подъём + проявление (классы .page-* в
    // main.css) — app-ощущение без потери скорости (out-in 0.12+0.2 с).
    // Тяжёлым страницам (админка) отключается локально:
    //   definePageMeta({ pageTransition: false })
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: false,
  },

  css: ['~/assets/css/main.css'],
});
