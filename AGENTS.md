# AGENTS.md — правила работы ИИ-агентов с репозиторием nuxtshop

Концентрат правил: что нельзя ломать и как проверять свои изменения.
Подробности и обоснования — в README.md (разделы «Известные проблемы и уроки», «Кэширование», «SSR-гидратация каталога»).

## 1. Контекст

- Учебный SSR-магазин: Nuxt 4.6.3 + Vue 3.5, TailwindCSS 4 + daisyUI 5 (темы `corporate`/`business`), Nitro → Cloudflare Workers (`cloudflare-module`), данные в Cloudflare KV, PWA (`@vite-pwa/nuxt`), i18n ru/en/es (`@nuxtjs/i18n`), авторизация PBKDF2-SHA256, заказы + Telegram-бот.
- Аналитика конверсии — Cloudflare Web Analytics (бикон БЕЗ cookies): скрипт подключается в `app/app.vue` только при непустом `NUXT_PUBLIC_CF_BEACON_TOKEN` (vars в wrangler.jsonc; сам токен публичен). Сайт заводится в дашборде: Analytics & Logs → Web Analytics → Add a site → manual install (API-создание требует права «Web Analytics: Edit», у деплой-токена его нет). Пустая переменная = бикон не подключается.
- Владелец работает с двух машин (Windows + Linux) и правит код вручную: не доверяй своей «памяти» о состоянии файлов — перечитывай перед правкой.

## 2. Критические запреты (нарушение = сломан прод)

- **НЕ возвращать pinia / @pinia/nuxt.** Глобальное состояние — только `useState` / `useAsyncData`. Модуль удалён сознательно, комментарии в `nuxt.config.ts` — источник правды.
- **НЕ добавлять модуль `@nuxtjs/tailwindcss`.** Tailwind 4 подключён плагином `@tailwindcss/vite` в `nuxt.config.ts` → `vite.plugins`. Конфигурация — CSS-first в `app/assets/css/main.css` (daisyUI — плагин Tailwind). Файл `tailwind.config.js` не создавать.
- **НЕ использовать IPX; `NuxtImg` обязателен для контентных картинок; провайдер — кастомный `cfworkers`, НЕ `none` и НЕ встроенный `cloudflare`.** Встроенный `cloudflare` строит `/cdn-cgi/image/*` — схема включается только на собственной зоне, на `*.workers.dev` не работает; поэтому провайдер `app/providers/cfWorkersImage.ts` строит `/img?src=…&w=…`, а `server/routes/img.ts` применяет Cloudflare Image Transformations методом `fetch(оригинал, { cf: { image } })` («Transform via fetch» — единственный документированный способ для workers.dev). Проверено по исходнику @nuxt/image 2.2.1: явные `srcset`/`sizes`/`loading`/`fetchpriority`/`decoding`/`draggable` доезжают до DOM как fallthrough-атрибуты и перекрывают сгенерированные; `@load`/`@error` работают через emit компонента (на SSR ещё ставится inline `onerror`→`data-error` — фикс гонки гидратации); ref на `NuxtImg` возвращает инстанс компонента (`defineExpose({ imgEl })`), не `<img>`. **Запрещены мёртвые пропсы `provider`, `placeholder`, `fallback`** — мусор в DOM/непредсказуемое поведение; подмену битых картинок делать только в `@error`-обработчике. **Сырой `<img>` допустим только там, где template ref обязан отдавать DOM-элемент**: зум-модалка `ProductGallery.vue` (`zoomImageRef` → getBoundingClientRect/transform), `ProductCardGrid.vue` (`imageEl.complete` — фикс гонки гидратации), легаси `ui/ImageZoom.vue`. Поведение `/img` по средам: `pnpm dev` — cf-опции игнорируются, отдаётся оригинал; `wrangler dev` — low-fi mock; прод — реальные трансформации (квота Images: 5 000 уникальных/мес бесплатно, дальше $0.50/1 000; результаты CF кэширует сам). Роут строго валидирует query (только `src` с префиксами `/images/products/*` и `/api/images/*` + w/h/q/f/fit — SSRF-защита, логика в `server/utils/imgTransform.ts` покрыта тестами) и при любой ошибке трансформации ИЛИ флаге `NUXT_PUBLIC_IMG_TRANSFORM=off` отвечает 302/307 на оригинал — картинки не ломается, теряется только оптимизация; откат — переменная в vars/дашборде БЕЗ пересборки. Внешние URL (Unsplash — уже с auto=format&q=75) провайдером не трогаются. Ручные `:srcset` из `productSrcset` (`/images/products/small/` 400w + 800w) пока ведут на оригиналы мимо трансформатора — переход на авторский srcset по `sizes`: предложено закрыть как «не делаем» (трансформатор уже отдаёт webp; заметного выигрыша LCP не даёт) — решение за владельцем. Картинки жмутся в webp при загрузке в админке (`useImageResize`, canvas); ресайз-варианты — утилита `app/utils/productImage.ts` (`getValidImageUrl`, `productSrcset`).
- **НЕ возвращать vue-tsc — проверка типов `.vue` невозможна.** TypeScript 7.0.2 (нативный Go-порт) несовместим с vue-tsc: тот делает `require.resolve('typescript/lib/tsc')`, а в TS 7 экспорта `./lib/tsc` нет (ERR_PACKAGE_PATH_NOT_EXPORTED). Для чистых `.ts` действует скрипт `typecheck` (частичный возврат, этап 2): `tsc --noEmit -p .nuxt/tsconfig.server.json && tsc --noEmit -p .nuxt/tsconfig.shared.json` — покрывает `server/`, `shared/` и чистые `.ts` из `app/` (noUncheckedIndexedAccess/strict), но НЕ `.vue` (для них — oxlint + vitest + markuplint + build, см. раздел 6). Запускать после `pnpm install` (генерирует `.nuxt`); при правках серверных типов держать зелёным. Обоснование запрета vue-tsc — КОПИРУЙ.txt в корне репо.
- **НЕ добавлять маршруты в `nitro.prerender.routes`**, кроме `/offline`: на этапе сборки KV недоступен. `/`, `/news`, `/about`, `/contacts`, каталог и карточки товаров рендерятся на рантайме.
- **НЕ возвращать `swr` для HTML-страниц** в `routeRules`: Opera/Android неделями держали устаревшие копии после деплоя. HTML — `max-age=0, must-revalidate`; `swr` только у `/robots.txt` (86400) и `/sitemap.xml` (3600).
- **НЕ переводить внешние отправки (Telegram, email) на `ctx.waitUntil()`.** На `cloudflare-module` фоновые задачи не доставляются (проверено A/B-тестом; правило зафиксировано в шапке `server/api/orders/index.post.ts`). Только синхронные `await` в `try/catch`.
- **НЕ кэшировать SSR HTML в PWA.** HTML не входит в `workbox.globPatterns`, `navigateFallback` отключён сознательно (иначе «/user открывает главную»). Расширять `runtimeCaching` на страницы запрещено: `/api/products` — NetworkFirst, картинки — CacheFirst, больше ничего.
- **НЕ менять `name`, KV `id` и `compatibility_date` в `wrangler.jsonc`** без явной просьбы владельца: привязано к живому воркеру (KV, секреты, домен). `compatibility_date` менять только парой с `compatibilityDate` в `nuxt.config.ts`.
- **НЕ обновлять пиновые версии без ведома владельца:** `nuxt` 4.6.3 — точный пин без `^` (баг 4.6.0 на Windows: «Either manifest or precomputed data must be provided»); `typescript` 7.0.2 — точный пин (совместимость vue-tsc не гарантирована на других 7.x); `h3` — только 1.x (v2 придёт с Nuxt 5 / Nitro v3).
- **НЕ коммитить секреты.** `.env`, `.env.local`, `.dev.vars` в .gitignore — не «чинить» это. Токены `TELEGRAM_*` не инлайнить в код; секреты задаются `npx wrangler secret put` и переживают деплой сами.
- **НЕ запускать `pnpm deploy` без явной просьбы владельца** — это прод.

## 3. Среда

- Node.js 22.x или 24.x (минимум 22.21 для Nuxt CLI v4). pnpm 12 — фиксируется полем `packageManager` (`corepack enable`).
- Postinstall-скрипты: блок `allowBuilds` (esbuild, unrs-resolver, workerd) уже в `pnpm-workspace.yaml`. Ошибка `ERR_PNPM_IGNORED_BUILDS` → `pnpm approve-builds` → `pnpm rebuild`.
- Две среды: `pnpm dev` — KV in-memory (данные сбрасываются при рестарте), Telegram — тихий no-op; `pnpm preview` (wrangler dev + `.dev.vars`) и прод — реальные. Интеграции бота и KV проверять только на preview/проде.
- Windows: пути с `[id]` — только `-LiteralPath`; `>` в PowerShell 5.x пишет UTF-16 (надёжнее `| Out-File -Encoding utf8`); «Port 3000 is in use» = жив старый dev-процесс.

## 4. Карта кода

```text
app/                 витрина: pages/ (файловый роутинг), components/ (admin/, cart/, layout/, products/),
                     composables/ (useApi, useAuth, useCart, useFavorites, useProducts, useImageResize…),
                     layouts/, middleware/, plugins/, assets/css/ (Tailwind + токены тем), utils/ (автоимпорт)
server/api/          API-роуты Nitro (products, orders, auth, telegram, admin, images)
server/routes/       файловые роуты: robots.txt, sitemap.xml (+ /api/images/[...key])
server/lib/          бизнес-логика: storage, password, cache, seoHelpers, telegram, telegramCommands, email
server/middleware/   серверные middleware
server/data/         сиды: users.json, products.json (auto-сид при первом readUsers(), отдельной инициализации нет)
server/utils/        серверные утилиты (автоимпорт Nitro)
shared/              код и типы, общие для app и server (siteContent.ts, messengerLinks.ts)
i18n/locales/        ru.json, en.json, es.json (langDir: 'locales')
tests/unit/          юнит-тесты vitest (серверная логика)
public/              статика: images/products/, _headers (HTTP-кэш статики), иконки PWA
```

Конфиги: `nuxt.config.ts`, `wrangler.jsonc` (единственный конфиг Wrangler), `pnpm-workspace.yaml`, `knip.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `.markuplintrc`, `vitest.config.ts`.

## 5. Соглашения по коду

- Компоненты — `PascalCase.vue`; composables — `use*.ts`; API-роуты — `kebab-case` (`index.post.ts`, `[slug].get.ts`).
- Имена файлов страниц не переименовывать без нужды: `routeRules` матчятся по литеральным префиксам, для локалей `/en`, `/es` правила продублированы.
- pug-шаблоны: классы со спецсимволами (`lg:block`, `hover:bg-*`, `w-3/4`, `py-2.5`, `sm:hidden`) — ТОЛЬКО внутри `class="..."`. Точечный синтаксис — только классы из букв/цифр/дефисов. Контроль перед коммитом (ожидание: пусто):
  `rg -n "[\w]+\.[\w-]*:" app -g "*.vue"`
- Локализация: все строки UI — в `i18n/locales/{ru,en,es}.json`. Стратегия `prefix_except_default` (ru без префикса), `detectBrowserLanguage` выключен — авто-редиректы по языку не добавлять.
- Стейт: ключи `useState` стабильные (`'catalog-products'`). Всё, что читает `localStorage`/`window` (сортировка, isMobile, избранное), — через `onNuxtReady` или «пустой первый кадр» + ресинхронизация после гидратации: первый рендер обязан совпадать с SSR.
- Картинки: `NuxtImg` с явными `width`/`height` под классы, `loading="lazy"` вне первого экрана, `decoding="async"`; первый слайд галереи — `eager` + `fetchpriority="high"` (кандидат в LCP); ручной `srcset` из `productSrcset` + парный `sizes`. Сырой `<img>` — только по исключению из раздела 2.
- Серверные хелперы в новых файлах импортировать из `nuxt/server`, не из `h3` (совместимость с будущим Nitro v3). Прямых зависимостей от версий h3 v2 не создавать.
- HTTP-кэш статики (public/_headers): `/_nuxt/*` и `/images/products/*` — год, immutable; `/sw.js`, `/registerSW.js` — no-cache. Не трогать без нужды — иначе застрянут обновления PWA.

## 6. Обязательные проверки после изменений

```bash
pnpm exec oxlint   # линтер (@baptistecrouzet/nuxt-oxlint; в CI — отдельный шаг)
pnpm test          # vitest, tests/unit — ожидание 502 passed (37 файлов)
pnpm lint:markup   # markuplint по app/**/*.vue
pnpm fmt:check     # oxfmt (исправление: pnpm fmt)
pnpm knip          # неиспользуемые экспорты; «unused» для auto-import компонентов не верить — проверять rg по имени
pnpm build         # дождаться «✨ Build complete» в конце вывода
```

Скрипт `typecheck` — частичный, только чистые `.ts` (server/ + shared/, нативный `tsc`, без `.vue` — vue-tsc несовместим с TS 7.0.2, подробности в разделе 2 и КОПИРУЙ.txt в корне репо); запускать его после правок серверных типов. После правок каталога/гидратации: `curl -s http://localhost:3000/ | grep -c card-title` (ожидание ≥ 31) и консоль браузера без hydration-варнингов на десктопе и мобильном viewport.

После правок трансформатора `/img`: `curl -s -o /dev/null -w "%{http_code} %{content_type}" "http://localhost:3000/img?src=%2Fimages%2Fproducts%2F<файл>.webp&w=200"` → `200 image/webp` (в `pnpm dev` — оригинал без ресайза), плохой `src` → `400`; с `NUXT_PUBLIC_IMG_TRANSFORM=off` в vars → `302` на оригинал. На проде после деплоя: открыть карточку товара, в DevTools → Network у картинок пути `/img?src=…` и статус 200 (или 302 — если сработал откат).

Деплой — только по явной просьбе владельца: `rg "маркер"` по каждому правленому файлу (подмена содержимого между файлами не даёт ошибок сборки, но молча ломает страницу) → `pnpm build` (дочитать до «✨ Build complete») → `pnpm deploy` (дочитать до «Current Version ID», записать его).

## 7. Контрольные точки подсистем

- **Каталог/SSR:** каталог живёт в `useState('catalog-products')`; `index.vue` грузит через `await useAsyncData('catalog-load', …)` в setup и возвращает `true` (не дублировать payload); первая страница карточек заполняется синхронно в `reset()`; скелетон — только фолбэк ошибки/офлайна.
- **Заказы:** `POST /api/orders` — суммы пересчитывает сервер (клиентские игнорируются), проверка склада, запись в KV `data:orders` со статусом `new` и историей; источники правды — сервер, не localStorage.
- **Отмена заказа покупателем / «Полезно» / ответ магазина:** гард отмены — `CUSTOMER_CANCELLABLE_STATUSES` (`new`/`confirmed`) в `server/lib/orderHelpers.ts` + `canCustomerCancel`; эндпоинт `POST /api/my/orders/[id]/cancel` проверяет владение на сервере (чужой заказ = 404), отмена подтверждённого возвращает склад через `updateOrderStatus`. Отметки «полезно» — `helpfulBy` в KV-отзыве (`toggleHelpful`); наружу отдаётся только счётчик и `likedByMe` через `publicReviewView` (id пользователей НЕ утекают). Ответ магазина — `shopReply`: `PUT /api/admin/reviews/[id]/reply` (пустой `text` = удалить), показ на витрине в `ProductReviews.vue`.
- **Telegram:** webhook проверяет `X-Telegram-Bot-Api-Secret-Token` + whitelist `TELEGRAM_ADMIN_USER_IDS`; команды `/pending`, `/stats`, `/stock`; кнопки идемпотентны. Диагностика по порядку: тест `api.telegram.org` → `npx wrangler secret list` (наличие ≠ валидность) → `npx wrangler deployments list` → `npx wrangler tail`.
- **SEO:** `robots.txt`/`sitemap.xml` — `server/routes/` + `server/lib/seoHelpers.ts` (покрыто тестами); домен — `NUXT_PUBLIC_SITE_URL`, иначе домен запроса; после деплоя проверить `/robots.txt`, `/sitemap.xml`.
- **Кэш каталога:** `server/lib/cache.ts` — TTL 60 c (= окно глобальной консистентности KV), single-flight, выдаёт глубокую копию (можно мутировать); инвалидация в `writeProducts`; метрики — `/api/admin/stats` → `stats.cache`.
- **Пароли/сессии:** PBKDF2-SHA256 (`server/lib/password.ts`), формат хэша `pbkdf2$iterations$salt$hash` (итерации читаются из хэша); сессии в KV. Экстренный сброс пароля — только по процедуре README (бэкап `data:users` обязателен до правок).

## 8. Git

- Коммиты — conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `style:`.
- Перед началом работы `git pull`; конфликт `! [rejected]` → `git pull --rebase origin main`.
- `package.json` и `pnpm-lock.yaml` коммитить вместе (CI использует `--frozen-lockfile`).
- Не коммитятся: `node_modules/`, `.nuxt/`, `.output/`, `dist/`, `.env*`, `.dev.vars`, `server/logs/`, архивы и дампы.
- ⚠️ `.gitignore` исключает `*.md` кроме README.md — чтобы этот файл попал в репозиторий, добавь в `.gitignore` строки `!AGENTS.md` и (при желании) `!CLAUDE.md`.
