NuxtShop

Учебный интернет-магазин с фейковыми товарами. Демонстрационный проект на Nuxt 4с SSR, авторизацией, корзиной, избранным и админ-панелью.

    ⚠️ Учебный проект. Товары, пользователи и пароли — вымышленные.Не использовать в production без существенной доработки.

Стек

    Фреймворк: Nuxt 4.6.1 (закреплён в package.json без ^) + Vue 3.5
    Роутинг: файловый роутинг Nuxt (Vue Router 4)
    Стили: TailwindCSS 4 + daisyUI 5
    Стейт: Pinia 4 (@pinia/nuxt), локальное состояние — useState
    Сервер: Nitro (Nuxt), пресет cloudflare-module → Cloudflare Workers
    Хранилище: Cloudflare KV (production); dev — in-memory(данные сбрасываются при перезапуске) — см. server/lib/storage.ts
    Аутентификация: PBKDF2-SHA256 через Web Crypto API, сессии в KV
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

Данные для входа

Администратор задаётся сидом server/data/users.json: при первом обращениик хранилищу пользователей readUsers() (server/lib/userHelpers.ts)загружает сид в Workers KV. Отдельный скрипт инициализации не нужен.
Роль Email Пароль
Администратор admin@shop.ru admin123

⚠️ Смените пароль после первого входа — через админ-панель(раздел «Пользователи»).

⚠️ PBKDF2-хэш пароля по умолчанию хранится прямо в сиде(алгоритм — server/lib/password.ts). Для реального проекта не оставляйтепублично известные учётные данные: замените хэш в сиде до первого деплояили смените пароль сразу после входа.
Экстренный сброс пароля администратора

Если доступ ко всем админ-аккаунтам потерян, пароль меняется напрямую в KV(ключ data:users, биндинг KV — команды по умолчанию работают с удалённымnamespace; для локального dev-хранилища добавьте флаг --local):

# 1. Бэкап текущих пользователей — ОБЯЗАТЕЛЬНО перед правкамиnpx wrangler kv key get "data:users" --binding=KV > users-backup.json# В Windows PowerShell 5.x '>' пишет файл в UTF-16 — надёжнее так:# npx wrangler kv key get "data:users" --binding=KV | Out-File -Encoding utf8 users-backup.json# 2. В users-backup.json замените поле "password" нужного пользователя# на хэш, сгенерированный сниппетом ниже.# 3. Залить обратноnpx wrangler kv key put "data:users" --path users-backup.json --binding=KV

Изменения в KV распространяются до ~60 секунд.

Хэш генерируется тем же алгоритмом, что в server/lib/password.ts(консоль браузера, F12):

// ⚙️ Настройка: подставьте новый пароль вместо 'НОВЫЙ_ПАРОЛЬ'(async (pw = 'НОВЫЙ_ПАРОЛЬ') => { // ⚙️ Настройка: 20000 — как в текущем сиде (безопасно для Free-плана, // лимит 10ms CPU). Число итераций читается из самого хэша, поэтому // любое значение совместимо с comparePassword(). const ITER = 20000; const enc = new TextEncoder(); const salt = crypto.getRandomValues(new Uint8Array(16)); const key = await crypto.subtle.importKey( 'raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'], ); const bits = new Uint8Array(await crypto.subtle.deriveBits( { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256, )); const b64 = (b) => btoa(String.fromCharCode(...b)); console.log(`pbkdf2$${ITER}$${b64(salt)}$${b64(bits)}`);})();

Структура проекта

app/ assets/ # CSS (Tailwind, токены тем) components/ # Vue-компоненты (admin/, cart/, products/ и др.) composables/ # useApi, useAuth, useCart, useFavorites и др. layouts/ # Макеты страниц middleware/ # Роут- и глобальные middleware pages/ # Маршруты (файловый роутинг Nuxt) plugins/ # Клиентские плагиныpublic/ # Статика (favicon, images/products)server/ api/ # API-роуты Nitro data/ # Сиды: users.json, products.json lib/ # Бизнес-логика (storage, password, helpers) middleware/ # Серверные middleware utils/ # Серверные утилиты (автоимпорт Nitro)nuxt.config.ts # Конфигурация Nuxtwrangler.jsonc # Конфигурация Cloudflare Workers

Скрипты
Команда Что делает
pnpm dev Запуск dev-сервера с hot-reload
pnpm build Продакшн-сборка
pnpm preview Локальная эмуляция Workers (wrangler dev; сначала pnpm build)
pnpm deploy Сборка + деплой на Cloudflare
pnpm generate Генерация статического сайта
pnpm lint:markup Проверка шаблонов markuplint
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
    .env, .env.local — секреты
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
Известные проблемы
Windows + Nuxt 4.6.0

Симптом: ошибка 500 Either manifest or precomputed data must be providedв vue-bundle-renderer.

Причина: баг в Nuxt 4.6.0, специфичный для Windows. На Linux та же версияработала нормально.

Решение: в проекте закреплён Nuxt 4.6.1 (в package.json без ^ —pnpm не подтянет более новую версию). На 4.6.1 проблема не воспроизводится.Перед обновлением Nuxt проверяйте сборку на Windows.
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

Соглашения по коду

    Компоненты: PascalCase (ProductCard.vue)
    Composables: camelCase с префиксом use (useCart.ts)
    API-роуты: kebab-case (server/api/products/add.post.js)
    Стили: TailwindCSS utility-классы, кастомные — в app/assets/css/
    Типы: в app/types/ или локально в <script setup>
    Комментарии: на русском, для сложной логики — «почему», а не «что»

Лицензия

Учебный проект. Свободное использование в образовательных целях.
