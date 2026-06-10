import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  ssr: true,
  compatibilityDate: '2025-07-15',

  devtools: { enabled: false },

  devServer: {
    port: 3000
  },

  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true,
    componentIslands: true,
    inlineRouteRules: true,
    watchPayload: false
  },

  vite: {
    server: {
      hmr: {
        port: 24679
      }
    },
    build: {
      cssMinify: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log']
        }
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              const match = id.match(/node_modules\/([^/]+)/);
              if (match) {
                const pkg = match[1];
                // ✅ fixed OR operators
                if (pkg === 'vue' || pkg === '@vue' || pkg === 'vue-router' || pkg === 'pinia') {
                  return 'vue-vendor';
                }
                if (pkg.includes('iconify') || pkg.includes('heroicons')) {
                  return 'icons';
                }
                return 'vendor';
              }
            }
            // return undefined for non-node_modules
          },
        },
      },
      target: 'es2022',
      sourcemap: false,
      modulePreload: {
        polyfill: false
      }
    },
    experimental: {
      inlineSSRStyles: true
    },
    css: {
      devSourcemap: false,
      transformer: 'postcss'
    },
    plugins: [tailwindcss() ],
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia'],
      exclude: ['@nuxt/icon']
    }
  },

  hooks: {
    'vite:extendConfig': (config) => {
      config.vue = config.vue || {};
      config.vue.template = config.vue.template || {};
      config.vue.template.preprocessOptions = {
        pug: {
          doctype: 'html'
        }
      }
    }
  },

  nitro: {
    serveStatic: true,
    publicAssets: [
      { dir: 'public', baseURL: '/' },
      { dir: '.nuxt/dev-sw-dist', baseURL: '/' }
    ],
    experimental: {
      asyncContext: true,
      headNext: true,
      templateUtils: true,
      treeshakeClientOnly: true,
      componentIslands: true,
      sharedPrerenderData: true
    },
    maxMemory: 512,
    minify: true,
    sourceMap: false,
    compressPublicAssets: {
      brotli: true,
      gzip: true
    },
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      ignore: ['/admin', '/manager']
    },
    sourcemap: {
      client: false,
      server: false
    },
    development: {
      viteRuntime: true
    },
    optimization: {
      keyedComposables: [
        { name: 'useAsyncData', argumentLength: 3 },
        { name: 'useFetch', argumentLength: 3 },
        { name: 'useLazyAsyncData', argumentLength: 3 },
        { name: 'useLazyFetch', argumentLength: 3 }
      ]
    },
    routeRules: {
      '/_nuxt/**': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }
      },
      '/images/**': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }
      },
      '/product/**': {
        swr: 3600,
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }
      }
    }
  },

  modules: [
    '@nuxt/image',
    '@nuxt/icon',
    '@nuxthub/core',
    '@pinia/nuxt',
    '@vite-pwa/nuxt'
  ],

    // ============================================
  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],

    devOptions: {
      enabled: false,
      type: 'module'
    },

    client: {
      installPrompt: true,
      registerPlugin: true
    },

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
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
      ]
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
            expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
          }
        },
        {
          urlPattern: /\/api\/products/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-products',
            networkTimeoutSeconds: 10,
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }
          }
        }
      ]
    }
  },

  // ============================================
  // Настройки иконок
  // ============================================
  icon: {
    provider: 'iconify',
    iconify: {
      autoInstall: true,
      collections: ['heroicons', 'mdi']
    },
    componentName: 'Icon'
  },


  // ✅ Moved misplaced image config into its own section
  image: {
    format: ['webp', 'avif'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536
    },
    presets: {
      product: {
        modifiers: { format: 'webp', quality: 80, width: 400, height: 400 }
      },
      thumbnail: {
        modifiers: { format: 'webp', quality: 70, width: 150, height: 150 }
      }
    }
  },

  components: [
    { path: '~/components', pathPrefix: false, extensions: ['.vue', '.pug'] },
    { path: '~/components/ui', prefix: '', extensions: ['.vue', '.pug'], global: false },
    { path: '~/components/layout', prefix: 'Layout', extensions: ['.vue', '.pug'], global: false },
    { path: '~/components/products', prefix: 'Product', extensions: ['.vue', '.pug'], global: false },
    { path: '~/components/filters', prefix: 'Filter', extensions: ['.vue', '.pug'], global: false },
    { path: '~/components/cart', prefix: 'Cart', extensions: ['.vue', '.pug'], global: false },
    { path: '~/components/admin', prefix: 'Admin', extensions: ['.vue', '.pug'], global: false },
    { path: '~/components/modals', prefix: 'Modal', extensions: ['.vue', '.pug'], global: false }
  ],

  imports: {
    dirs: ['composables', 'composables/', 'stores', 'stores/', 'utils', 'utils/**'],
    autoImport: true
  },

  app: {
    head: {
      title: 'Интернет-магазин',
      htmlAttrs: { lang: 'ru' },
      meta: [
        { name: 'description', content: 'Лучший интернет-магазин' },
        { name: 'keywords', content: 'товары, покупки, магазин' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'theme-color', content: '#ffffff' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Магазин' }
      ],
      link: [
        { rel: 'preconnect', href: process.env.API_BASE || 'http://localhost:3001' },
        { rel: 'dns-prefetch', href: 'https://api.iconify.design' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' }
      ],
      script: [
        {
          innerHTML: `(function() {
            try {
              var theme = localStorage.getItem('theme') || 'light';
              document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {}
          })();`,
          type: 'text/javascript',
          tagPosition: 'head'
        }
      ]
    },
    pageTransition: false,
    layoutTransition: false
  },

  css: ['~/assets/css/main.css'],

  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  },

  features: {
    inlineStyles: true,
    noScripts: false
  }
});