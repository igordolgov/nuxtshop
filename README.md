NuxtShop

Учебный интернет-магазин с фейковыми товарами. Демонстрационный проект на Nuxt 4с SSR, авторизацией, корзиной, избранным, заказами и админ-панелью.

    ⚠️ Учебный проект. Товары, пользователи и пароли — вымышленные.Не использовать в production без существенной доработки.

Стек

    Фреймворк: Nuxt 4.6.1 (закреплён в package.json без ^) + Vue 3.5
    Роутинг: файловый роутинг Nuxt (Vue Router 4)
    Стили: TailwindCSS 4 + daisyUI 5 (темы: corporate/business)
    Стейт: Pinia 4 (@pinia/nuxt), локальное состояние — useState
    Сервер: Nitro (Nuxt), пресет cloudflare-module → Cloudflare Workers
    Хранилище: Cloudflare KV (production); dev — in-memory(данные сбрасываются при перезапуске) — см. server/lib/storage.ts
    Аутентификация: PBKDF2-SHA256 через Web Crypto API, сессии в KV
    Заказы: KV (data:orders), цены считает сервер, статусы с историей
    Уведомления админу: Telegram Bot API (карточки заказов с кнопками,команды /pending /stats /stock)
    PWA: @vite-pwa/nuxt (Workbox, оффлайн-режим)
    Модули: @nuxt/image, @nuxt/icon
    Утилиты: @vueuse/core, idb (IndexedDB)
    Пакетный менеджер: pnpm 12 (поле packageManager)

Требования

    Node.js: 22.x или 24.x (LTS)
    pnpm: 12 (версия фиксируется полем packageManager; удобно через corepack enable)
    ОС: Windows 11, Linux, macOS

Установка

git clone https://github.com/igordolgov/nuxtshop.gitcd nuxtshoppnpm install

Если pnpm блокирует postinstall-скрипты (обычно на Windows):

pnpm approve-builds

Выбрать все пакеты (a + Enter), затем:

pnpm rebuild

Разработка

pnpm dev

Открыть: http://localhost:3000/

⚠️ В dev-режиме Telegram и KV недоступны (секретов и биндингов нет):KV работает in-memory, Telegram-отправка корректно пропускается.Интеграцию с ботом тестируйте на проде или через pnpm preview + .dev.vars.
Продакшн-сборка

pnpm buildpnpm preview # локальная эмуляция Workers (wrangler dev)

Деплой на Cloudflare Workers

Проект настроен для Cloudflare Workers (nitro.preset: 'cloudflare-module',конфиг — wrangler.jsonc). Деплой одной командой:

pnpm deploy # = nuxt build && wrangler deploy

Перед первым деплоем:

    Установить Wrangler: pnpm add -D wrangler
    Авторизоваться: npx wrangler login
    Создать KV namespace: npx wrangler kv namespace create <name>
    Прописать ID namespace в wrangler.jsonc. ⚙️ Настройка: биндингобязан называться KV — это имя читает server/lib/storage.ts

Секреты и переменные воркера (Settings → Variables and Secrets)
Имя Тип Назначение
KV KV Namespace хранилище (товары, пользователи, заказы, сессии)
TELEGRAM_BOT_TOKEN Secret токен бота (BotFather)
TELEGRAM_ADMIN_CHAT_ID Secret адресат карточек: id группы (-100...) и/или список через запятую
TELEGRAM_ADMIN_USER_IDS Secret кто может жать кнопки/слать команды (id пользователей, через запятую)
TELEGRAM_WEBHOOK_SECRET Secret проверка, что webhook зовёт Telegram
NUXT_PUBLIC_API_BASE Text пусто (API на том же домене)
NUXT_PUBLIC_SITE_URL Text пусто — канонический адрес сайта для robots.txt/sitemap.xml/JSON-LD (см. раздел SEO); без него берётся домен запроса

Регистрация webhook (один раз после деплоя):

npx wrangler secret put TELEGRAM_WEBHOOK_SECRETInvoke-RestMethod "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<домен>/api/telegram/webhook&secret_token=<СЕКРЕТ>"

⚠️ Правило деплоя (проверено болезненно)

    Ctrl+S всем изменённым файлам; контроль ключевой строки: rg "маркер" файл
    pnpm build — дождаться ✨ Build complete в конце
    pnpm deploy — дождаться Current Version ID: в конце (записать)
    Секреты переживают деплой сами (wrangler secret put не требуется повторять)

Данные для входа

Администратор задаётся сидом server/data/users.json: при первом обращениик хранилищу пользователей readUsers() (server/lib/userHelpers.ts)загружает сид в Workers KV. Отдельный скрипт инициализации не нужен.
Роль Email Пароль
Администратор admin@shop.ru admin123

⚠️ Смените пароль после первого входа — через админ-панель.

⚠️ PBKDF2-хэш пароля по умолчанию хранится прямо в сиде(алгоритм — server/lib/password.ts). Для реального проекта не оставляйтепублично известные учётные данные: замените хэш в сиде до первого деплояили смените пароль сразу после входа.
Экстренный сброс пароля администратора

Если доступ ко всем админ-аккаунтам потерян, пароль меняется напрямую в KV(ключ data:users, биндинг KV; команды по умолчанию работают с удалённымnamespace; для локального dev-хранилища добавьте флаг --local):

# 1. Бэкап текущих пользователей — ОБЯЗАТЕЛЬНО перед правкамиnpx wrangler kv key get "data:users" --binding=KV > users-backup.json# В Windows PowerShell 5.x '>' пишет файл в UTF-16 — надёжнее так:# npx wrangler kv key get "data:users" --binding=KV | Out-File -Encoding utf8 users-backup.json# 2. В users-backup.json замените поле "password" нужного пользователя# на хэш, сгенерированный сниппетом ниже.# 3. Залить обратноnpx wrangler kv key put "data:users" --path users-backup.json --binding=KV

Изменения в KV распространяются до ~60 секунд.

Хэш генерируется тем же алгоритмом, что в server/lib/password.ts(консоль браузера, F12):

// ⚙️ Настройка: подставьте новый пароль вместо 'НОВЫЙ_ПАРОЛЬ'(async (pw = 'НОВЫЙ_ПАРОЛЬ') => { // ⚙️ 20000 — как в текущем сиде (безопасно для Free-плана, // лимит 10ms CPU). Число итераций читается из самого хэша, // поэтому любое значение совместимо с comparePassword() const ITER = 20000; const enc = new TextEncoder(); const salt = crypto.getRandomValues(new Uint8Array(16)); const key = await crypto.subtle.importKey( 'raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'], ); const bits = new Uint8Array(await crypto.subtle.deriveBits( { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256, )); const b64 = (b) => btoa(String.fromCharCode(...b)); console.log(`pbkdf2$${ITER}$${b64(salt)}$${b64(bits)}`);})();

Заказы и Telegram-бот

Подсистема заказов: клиент оформляет заказ (POST /api/orders), серверсам пересчитывает суммы (клиентские суммы игнорируются), проверяет склад,создаёт запись в KV со статусом new и историей изменений.

Telegram-бот (server/lib/telegram.ts, telegramCommands.js, webhook):

    Карточка нового заказа в группу админов: состав, сумма, контакты
        inline-кнопки «✅ Подтвердить / ❌ Отменить»;
    Нажатие кнопки → статус меняется в KV, карточка перерисовывается;
    Команды: /pending (новые заказы), /stats (статистика за сегодня),/stock (заканчивающиеся товары), /help;
    Доступ: whitelist по TELEGRAM_ADMIN_USER_IDS + проверкаX-Telegram-Bot-Api-Secret-Token;
    Идемпотентность: повторные нажатия/доставки не дублируют историю.

Клиент видит свои заказы и их статусы на странице «Мои заказы»(/user/orders) — источник правды сервер, не localStorage.
Структура проекта

app/ assets/ # CSS (Tailwind, токены тем) components/ # Vue-компоненты (admin/, cart/, layout/, products/) composables/ # useApi, useAuth, useCart, useFavorites и др. layouts/ # Макеты страниц middleware/ # Роут- и глобальные middleware pages/ # Маршруты (файловый роутинг Nuxt) plugins/ # Клиентские плагиныpublic/ # Статика (favicon, images/products)server/ api/ # API-роуты Nitro (products, orders, auth, telegram) data/ # Сиды: users.json, products.json lib/ # Бизнес-логика (storage, password, helpers, telegram, email) middleware/ # Серверные middleware routes/ # Файловые роуты Nitro: robots.txt, sitemap.xml utils/ # Серверные утилиты (автоимпорт Nitro)tests/ # Юнит-тесты vitest (tests/unit)nuxt.config.ts # Конфигурация Nuxtwrangler.jsonc # Конфигурация Cloudflare Workers

Скрипты
Команда Что делает
pnpm dev Запуск dev-сервера с hot-reload
pnpm build Продакшн-сборка
pnpm preview Локальная эмуляция Workers (wrangler dev; сначала pnpm build)
pnpm deploy Сборка + деплой на Cloudflare
pnpm generate Генерация статического сайта
pnpm lint:markup Проверка шаблонов markuplint
pnpm test Юнит-тесты серверной логики (vitest)
pnpm fmt / pnpm fmt:check Форматирование oxfmt
pnpm knip Поиск неиспользуемых файлов и экспортов
pnpm cf:typegen Генерация типов Cloudflare (wrangler types)
Работа с GitHub (шпаргалка)

Репозиторий: https://github.com/igordolgov/nuxtshop
Первоначальная настройка (один раз на новой машине)

Установить Git и GitHub CLI:

# Windows (winget)winget install --id Git.Gitwinget install --id GitHub.cli# Linux (Debian/Ubuntu)sudo apt install git# GitHub CLI — см. https://github.com/cli/cli

Авторизоваться в GitHub CLI:

gh auth login

Выбрать:

    GitHub.com
    HTTPS
    Login with a web browser

Проверить:

gh auth status

Клонирование проекта на новую машину

git clone https://github.com/igordolgov/nuxtshop.gitcd nuxtshoppnpm install

Повседневный workflow

1. Перед началом работы — подтянуть свежие изменения:

git pull

2. Поработать, внести изменения.

3. Посмотреть, что изменилось:

git statusgit diff

4. Добавить изменения в индекс:

git add . # все файлы# или выборочно:git add app/components/ProductCard.vue

5. Сделать коммит:

git commit -m "feat: добавить фильтр по цене"

Формат сообщений:

    feat: — новая функциональность
    fix: — исправление бага
    docs: — документация
    chore: — рутина (обновление зависимостей, чистка)
    refactor: — рефакторинг без изменения поведения
    style: — форматирование

6. Запушить на GitHub:

git push

Работа с двух машин (Windows + MX Linux)

⚠️ Главное правило: всегда git pull перед началом работы.

Сценарий: работали на Windows, хотите продолжить на Linux:

На Windows:

git add .git commit -m "..."git push

На Linux:

git pull# продолжаете работу

Если забыли git pull и получили ! [rejected]:

git pull --rebase origin maingit push

--rebase аккуратно «переложит» ваши локальные коммиты поверх удалённых.
Полезные команды

Посмотреть историю:

git log --oneline -10

Посмотреть, что изменилось в конкретном коммите:

git show <hash>

Отменить незакоммиченные изменения в файле:

git restore app/components/ProductCard.vue

Вернуть файл к состоянию последнего коммита:

git checkout HEAD -- app/components/ProductCard.vue

Посмотреть, какие файлы изменены:

git status

Сравнить текущее состояние с последним коммитом:

git diff

Что НЕ попадает в репозиторий

Список исключений — в файле .gitignore. Не коммитятся:

    node_modules/, .nuxt/, .output/, dist/
    .env, .env.local, .dev.vars — секреты
    server/logs/ — логи приложения
    *.rar, *.zip, *.tar.gz — архивы
    dump-*.txt, nuxt-shop.txt — дампы и выгрузки проекта
    # File Tree*.md — артефакты инструментов

Если случайно закоммитили лишнее:

git rm --cached <файл> # убрать из индекса, оставить на дискеgit commit -m "chore: удалить <файл> из репозитория"

Ветки (для экспериментов)

Создать ветку и переключиться:

git checkout -b experiment-new-feature

Работать, коммитить, пушить:

git push -u origin experiment-new-feature

Вернуться в main:

git checkout main

Слить ветку (если эксперимент удался):

git merge experiment-new-featuregit push

Удалить ветку:

git branch -d experiment-new-feature

Просмотр на GitHub

Открыть репозиторий в браузере:

gh repo view --web

Или напрямую: https://github.com/igordolgov/nuxtshop
Если что-то сломалось

Проверить, к какому репозиторию привязан проект:

git remote -v

Должно быть:

origin https://github.com/igordolgov/nuxtshop.git

Если URL другой (например, старый nuxt-shop):

git remote set-url origin https://github.com/igordolgov/nuxtshop.git

Проверить, что ветка связана с удалённой:

git status# должно быть: "Your branch is up to date with 'origin/main'"

Если push говорит no upstream branch:

git push -u origin main

Флаг -u нужен только один раз — потом git push работает без аргументов.
SEO: robots.txt, sitemap.xml, JSON-LD

Что генерируется (server/routes/, логика — server/lib/seoHelpers.ts, покрыта юнит-тестами):

    robots.txt — закрывает /admin, /user, /cart, /favorites, /api/; ссылается на sitemap (кэш Cloudflare сутки, swr 86400);
    sitemap.xml — статические страницы + все товары из KV с lastmod (кэш час, swr 3600);
    карточка товара — SSR-мета: title, description, Open Graph, twitter:card, canonical и JSON-LD schema.org/Product (цена, валюта, наличие InStock/OutOfStock, абсолютные ссылки на изображения).

Настройка домена: по умолчанию берётся домен входящего запроса. За прокси Cloudflare этого обычно достаточно, но для гарантии задайте в Workers Settings переменную NUXT_PUBLIC_SITE_URL (например, https://ваш-домен) — она приоритетнее.

После деплоя проверьте https://ваш-домен/robots.txt и https://ваш-домен/sitemap.xml (домены в sitemap должны быть продакшенские), затем отправьте sitemap в Google Search Console и Яндекс Вебмастер.
Кэширование и производительность

Слои кэша от долгоживущих к коротким:

    пререндер на билде (nitro.prerender): /, /about, /contacts, /news, /offline — статический HTML в бандле;
    SWR routeRules (nuxt.config.ts): карточки /product/** (3600 c), robots.txt (86400 c), sitemap.xml (3600 c) — первый запрос рендерит и кэширует, следующие получают кэш, обновление в фоне;
    кэш каталога в изоляте (server/lib/cache.ts): readProducts держит массив товаров 60 c — один запрос KV за окно TTL на изолят Workers; параллельные запросы делят один полёт (single-flight), результат выдаётся глубокой копией, поэтому вызывающие могут сортировать и фильтровать его свободно;
    PWA-кэш браузера (workbox runtimeCaching): /api/products — NetworkFirst, картинки — CacheFirst.

Почему TTL каталога именно 60 секунд: у Workers KV глобальная консистентность до ~60 c — запись становится видна везде в течение минуты. Кэш с тем же окном не добавляет новой «устареваемости», но убирает почти все чтения KV: бесплатный лимит (100 000 чтений/день) расходуется только на реальные промахи, а не на каждый запрос каталога.

Инвалидация: writeProducts (любое изменение товара — админка, Telegram) сбрасывает кэш текущего изолята; изменения с других изолятов подтянутся не позже TTL. Счётчики видны в /api/admin/stats (поле stats.cache): hit ratio = hits / (hits + misses) — доля запросов, обошедшихся без чтения KV.

Lighthouse и Core Web Vitals

Что уже сделано для метрик (LCP / CLS / TBT):

    галерея товара (ProductGallery): первый слайд — eager + fetchpriority=high (кандидат в LCP), остальные — loading=lazy: лежат за overflow-hidden границей и догружаются при свайпе, не конкурируя с главной картинкой за пропускную способность;
    все превью (каталог, корзина, профиль, заказы, админ-модалки) — явные width/height, совпадающие с классами w-24/w-20/w-14/w-12 (резерв места до загрузки, CLS), loading=lazy вне первого экрана, decoding=async;
    HTTP-кэш статики (public/_headers): /_nuxt/* и /images/products/* — год, immutable (хэшированные имена), /sw.js и /registerSW.js — no-cache, иначе обновления PWA застрянут в HTTP-кэше;
    head: preconnect добавляется только на внешний API (NUXT_PUBLIC_API_BASE_URL); мёртвый preconnect на localhost:3001 убран — раньше каждый посетитель открывал TCP+TLS-соединение в никуда (аудит «Preconnect to required origins»).

Как мерить:

    PageSpeed Insights (pagespeed.web.dev) по URL прода — самый быстрый способ;
    локально: pnpm build && pnpm preview, затем npx lighthouse http://localhost:8787 --view (нужен Chrome);
    полевые данные — Search Console, отчёт Core Web Vitals (CrUX).

Известное ограничение (снято): раньше каталог на главной рендерился на клиенте (store заполнялся в onMounted) — SSR отдавал скелетон, и LCP главной зависел от скорости /api/products. Решено SSR-гидратацией каталога — см. раздел ниже.

Про картинки и IPX: провайдер ipx @nuxt/image на Cloudflare Workers не работает (sharp недоступен на воркерах), поэтому image.provider = none: картинки сжимаются в webp при загрузке в админке (useImageResize, canvas) и отдаются как есть. Не указывайте provider="ipx" на NuxtImg — компонент не распознаёт лишний пропс и сльёт его в DOM как невалидный атрибут.

SSR-гидратация каталога

Что сделано (LCP главной — теперь карточки товаров в серверном HTML, а не скелетон):

    состояние товаров перенесено на useState('catalog-products') (useProducts.js): на сервере значение уходит в payload, при гидратации клиент получает каталог без повторного запроса /api/products;
    index.vue загружает каталог в setup через await useAsyncData('catalog-load', ...) — SSR ждёт данные и рендерит карточки; хендлер возвращает true, чтобы массив не дублировался в payload (товары живут в useState);
    getState в index.vue читает состояние и на сервере (раньше — только defaultValue): все читаемые поля — useState/computed из useProducts/useFilters и существуют в обоих окружениях;
    ProductsSection заполняет первую страницу карточек синхронно в reset() (было — после nextTick внутри async-watcher, что оставляло серверный HTML с пустой сеткой); isLoadingInitial сбрасывается до первого await — всё, что после await, в SSR HTML не попадает;
    сердечко избранного в ProductCardGrid рендерится до монтирования «пустым» (избранное живёт в localStorage, сервер его не знает): первый кадр совпадает с SSR без hydration mismatch, реальное состояние дожимается сразу после гидратации; флаги isFavorite в каталоге ресинхронизируются на клиенте мутацией на месте;
    сортировка из localStorage (productSort) применяется через onNuxtReady — сервер не видит localStorage и рендерит с дефолтной сортировкой, первый кадр обязан совпасть;
    ширина окна в useMobileDetection применяется через onNuxtReady, а не синхронно при первом вызове: мобильный клиент гидратируется с isMobile=false (как сервер), раскладка перестраивается после монтирования — раньше это давало hydration mismatch (v-if сайдбара/футера, классы сетки) и падения patch после гидратации на телефонах;
    скелетон на главной остался фолбэком ошибки/офлайна: showSkeleton = каталог пуст И (не смонтировано ИЛИ идёт загрузка).

Важно: '/' выведена из nitro.prerender.routes и переведена на routeRules swr 60. Пререндер запёк бы товары на момент билда — новые товары из /admin не появлялись бы на главной до следующего деплоя. Теперь: первый запрос рендерит HTML на рантайме с актуальным каталогом из KV, дальше — кэш с фоновой ревалидацией раз в минуту (окно согласовано с TTL кэша readProducts — тоже 60 c). Паттерн тот же, что у /product/** (swr 3600). Статикой остались только контентные страницы: /about, /contacts, /news, /offline.

Как проверить: curl -s http://localhost:3000/ | grep -c card-title (ожидание: 31+, было 0); в браузере консоль без hydration-варнингов на десктопе и мобильном viewport; PageSpeed Insights — LCP главной из категории «хорошие».

Известные проблемы и уроки
Windows + Nuxt 4.6.0

Симптом: ошибка 500 Either manifest or precomputed data must be providedв vue-bundle-renderer.

Причина: баг в Nuxt 4.6.0, специфичный для Windows. На Linux та же версияработала нормально.

Решение: в проекте закреплён Nuxt 4.6.1 (в package.json без ^ —pnpm не подтянет более новую версию). Перед обновлением Nuxt проверяйтесборку на Windows.
pnpm 10–12 блокируют postinstall

Симптом: ERR_PNPM_IGNORED_BUILDS при pnpm install, отсутствие нативныхбинарников (esbuild, @parcel/watcher).

Решение: в pnpm-workspace.yaml должен быть блок:

onlyBuiltDependencies: - '@parcel/watcher' - electron-winstaller - esbuild

Затем pnpm install или pnpm approve-builds.
Перенос с Linux на Windows

Если проект разрабатывался на Linux, при переносе на Windows:

    Удалить node_modules/, .nuxt/, .output/, pnpm-lock.yaml
    pnpm install — пересобрать нативные бинарники
    pnpm approve-builds — разрешить postinstall
    pnpm dev

Telegram-уведомления не приходят — чек-порядок диагностики

    Тест бота в браузере (исключает токен/chat_id):https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>&text=тест
    npx wrangler secret list — все секреты на месте(наличие ≠ валидность значения — пункт 1 проверяет значения)
    npx wrangler deployments list — код на проде новее последнейсмены секретов
    Синхронная отладочная версия + npx wrangler tail — читать строки[telegram] ...
    Тестировать только на проде — в pnpm dev секретов нет,отправка корректно пропускается (тихий no-op)

⚠️ ctx.waitUntil() не доставляет фоновые задачи

В связке Nitro cloudflare-module + Nuxt 4.6 фоновые задачи черезctx.waitUntil() не выполняются (изолят завершается с ответом;проверено A/B-тестом: синхронная версия доставляет, waitUntil — нет).Все внешние отправки (Telegram, email) — синхронные await,fail-safe (try/catch, не ломают основной ответ). Решение зафиксированов шапке server/api/orders/index.post.js — не «улучшать» обратно.
pug + Tailwind: классы со спецсимволами

В pug точка — разделитель классов, двоеточие — block-expansion.Классы со спецсимволами (lg:block, hover:bg-*, w-3/4, py-2.5,sm:hidden) — ТОЛЬКО внутри class="...". Точечный синтаксис —только классы из букв/цифр/дефисов.

Контроль перед коммитом (ожидание: пусто):

rg -n "[\w]+\.[\w-]_:" app -g "_.vue"

Другие уроки отладки

    Файл не сохранён до деплоя — в прод уходит старый код; правило:Ctrl+S → rg "маркер" файла → build (дочитать до Build complete) →deploy (дочитать до Current Version ID)
    Ghost-серверы: «Port 3000 is in use» — старый dev жив; передстартом: taskkill /F /IM node.exe
    Две среды — два поведения: Telegram/KV работают только на проде(или preview + .dev.vars); dev — для UI
    knip не отслеживает auto-imported компоненты — «unused» по нимпроверять только rg по имени
    wrangler secret list показывает наличие, не валидность — значенияпроверять ручным вызовом API
    PowerShell: пути с [id] — только -LiteralPath; > пишет UTF-16
    При массовых заменах файлов проверять первую строку-шапку (<!-- путь/назначение -->): подмена содержимого между файлами (user/index.vue с кодом каталога) не даёт ошибок сборки, но молча ломает страницу. Контроль: rg "уникальный маркер" файл до деплоя.

Соглашения по коду

    Компоненты: PascalCase (ProductCard.vue)
    Composables: camelCase с префиксом use (useCart.ts)
    API-роуты: kebab-case (server/api/products/index.post.js)
    Стили: TailwindCSS utility-классы, кастомные — в app/assets/css/
    В pug-шаблонах классы со спецсимволами (:, ., /, [, ],включая десятичные (py-2.5) и брейкпоинты (lg:block)) — тольковнутри class="..."; контроль: rg -n "[\w]+\.[\w-]*:" app -g "*.vue"
    Типы: в app/types/ или локально в <script setup>
    Server TS: catch (error) — unknown; текст ошибки —error instanceof Error ? error.message : String(error); сужениеопциональных полей секретов — локальные переменные с прямой проверкой
    Внешние отправки (Telegram/email) — синхронные, fail-safe(не бросают, логируют оба исхода), не ломают основной ответ
    Пороги устройства/ориентации — только в useMobileDetection.js,не дублировать локальными вычислениями
    Комментарии: на русском, для сложной логики — «почему», а не «что»

Лицензия

Учебный проект. Свободное использование в образовательных целях.