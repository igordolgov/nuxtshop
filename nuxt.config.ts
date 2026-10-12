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
    plugins: [tailwindcss(), isProd ? removeConsole({ includes: ['log', 'debug'] }) : null].filter(
      Boolean,
    ) as any,
    // Список чистый: только реально используемые пакеты.
    // Записи @vue/devtools-* (если появятся) добавляет сам Nuxt —
    // предупреждение NUXT_B7002 на прод не влияет.
    optimizeDeps: {
      include: ['@vueuse/core', 'idb', 'pinia', 'vue', 'vue-router'],
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
      routes: ['/', '/about', '/contacts', '/news', '/offline'],
    },
    routeRules: {
      '/product/**': { swr: 3600 },
    },
  },

  modules: [
    '@nuxt/image',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
    '@baptistecrouzet/nuxt-oxlint',
  ],

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
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /\/(cart|favorites|user|product)/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages-cache',
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
          },
        },
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
    provider: 'none',
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
      htmlAttrs: { lang: 'ru' },
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
        { rel: 'preconnect', href: process.env.API_BASE || 'http://localhost:3001' },
        { rel: 'dns-prefetch', href: 'https://api.iconify.design' },
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
    // Мягкий fade между страницами — классы .fade-* уже есть в main.css.
    // Тяжёлым страницам (админка) отключается локально:
    //   definePageMeta({ pageTransition: false })
    pageTransition: { name: 'fade', mode: 'out-in' },
    layoutTransition: false,
  },

  css: ['~/assets/css/main.css'],
});
