# NuxtShop

Учебный интернет-магазин с фейковыми товарами. Демонстрационный проект на Nuxt 4
с SSR, авторизацией, корзиной, избранным и админ-панелью.

> ⚠️ **Учебный проект.** Товары, пользователи и пароли — вымышленные.
> Не использовать в production без существенной доработки.

## Стек

- **Фреймворк:** Nuxt 4.5.2 (Vue 3.5)
- **Роутинг:** Vue Router 5
- **Стили:** TailwindCSS 4 + daisyUI 5
- **Стейт:** Nuxt `useState`
- **Сервер:** Nitro (Nuxt), Cloudflare Workers
- **Хранилище:** Cloudflare KV (production), локальные JSON (dev)
- **Аутентификация:** PBKDF2 через Web Crypto API, сессии в KV
- **Утилиты:** Fuse.js (поиск), Chart.js (графики), nanoid (ID)
- **Пакетный менеджер:** pnpm 11
- **TypeScript:** 5.9

## Требования

- **Node.js:** 22.x или 24.x (LTS)
- **pnpm:** 10+ (рекомендуется 11)
- **ОС:** Windows 11, Linux, macOS

## Установка

    git clone https://github.com/igordolgov/nuxtshop.git
    cd nuxtshop
    pnpm install

Если pnpm блокирует postinstall-скрипты (обычно на Windows):

    pnpm approve-builds

Выбрать все пакеты (`a` + Enter), затем:

    pnpm rebuild

## Разработка

    pnpm dev

Открыть: http://localhost:3000/

## Продакшн-сборка

    pnpm build
    pnpm preview

## Деплой на Cloudflare Workers

Проект настроен для Cloudflare Workers через `wrangler.jsonc`.

    pnpm build
    npx wrangler deploy

Перед первым деплоем:

1. Установить Wrangler: `pnpm add -D wrangler`
2. Авторизоваться: `npx wrangler login`
3. Создать KV namespace: `npx wrangler kv namespace create <name>`
4. Обновить `wrangler.jsonc` с ID созданных namespace

## Данные для входа

При **первом запуске** приложения автоматически создаётся администратор
(см. `server/lib/seedAdmin.js` и `server/data/users.json`):

| Роль | Email | Пароль |
|---|---|---|
| Администратор | `admin@shop.ru` | `admin123` |

⚠️ **Смените пароль** после первого входа — через админ-панель или функцию
`resetAdminPassword()` в `server/lib/seedAdmin.js`.

⚠️ Пароль по умолчанию **захардкожен** в `seedAdmin.js`. Для реального
проекта — вынести в переменные окружения (`.env.local`) и не коммитить.

## Структура проекта

    app/
      assets/           # CSS, шрифты, изображения
      components/       # Vue-компоненты (admin/, cart/, product/)
      composables/      # useApi, useAuth, useCart, useFavorites и др.
      layouts/          # Макеты страниц
      middleware/       # Глобальные middleware
      pages/            # Маршруты (файловый роутинг Nuxt)
      plugins/          # Плагины Nuxt
      utils/            # Хелперы
    public/             # Статика (favicon, products.json)
    server/
      api/              # API-роуты Nitro
      lib/              # Бизнес-логика (auth, users, products)
      middleware/       # Серверные middleware
      utils/            # Утилиты сервера (session, KV)
    nuxt.config.ts      # Конфигурация Nuxt
    wrangler.jsonc      # Конфигурация Cloudflare Workers

## Скрипты

| Команда | Что делает |
|---|---|
| `pnpm dev` | Запуск dev-сервера с hot-reload |
| `pnpm build` | Продакшн-сборка |
| `pnpm preview` | Локальный просмотр собранного приложения |
| `pnpm generate` | Генерация статического сайта |

---

## Работа с GitHub (шпаргалка)

Репозиторий: https://github.com/igordolgov/nuxtshop

### Первоначальная настройка (один раз на новой машине)

Установить Git и GitHub CLI:

    # Windows (winget)
    winget install --id Git.Git
    winget install --id GitHub.cli

    # Linux (Debian/Ubuntu)
    sudo apt install git
    # GitHub CLI — см. https://github.com/cli/cli

Авторизоваться в GitHub CLI:

    gh auth login

Выбрать:
- GitHub.com
- HTTPS
- Login with a web browser

Проверить:

    gh auth status

### Клонирование проекта на новую машину

    git clone https://github.com/igordolgov/nuxtshop.git
    cd nuxtshop
    pnpm install

### Повседневный workflow

**1. Перед началом работы — подтянуть свежие изменения:**

    git pull

**2. Поработать, внести изменения.**

**3. Посмотреть, что изменилось:**

    git status
    git diff

**4. Добавить изменения в индекс:**

    git add .                  # все файлы
    # или выборочно:
    git add app/components/ProductCard.vue

**5. Сделать коммит:**

    git commit -m "feat: добавить фильтр по цене"

Формат сообщений:
- `feat:` — новая функциональность
- `fix:` — исправление бага
- `docs:` — документация
- `chore:` — рутина (обновление зависимостей, чистка)
- `refactor:` — рефакторинг без изменения поведения
- `style:` — форматирование

**6. Запушить на GitHub:**

    git push

### Работа с двух машин (Windows + MX Linux)

⚠️ **Главное правило:** всегда `git pull` **перед** началом работы.

**Сценарий: работали на Windows, хотите продолжить на Linux:**

На Windows:

    git add .
    git commit -m "..."
    git push

На Linux:

    git pull
    # продолжаете работу

**Если забыли `git pull` и получили `! [rejected]`:**

    git pull --rebase origin main
    git push

`--rebase` аккуратно «переложит» ваши локальные коммиты поверх удалённых.

### Полезные команды

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

### Что НЕ попадает в репозиторий

Список исключений — в файле `.gitignore`. Не коммитятся:

- `node_modules/`, `.nuxt/`, `.output/`, `dist/`
- `.env`, `.env.local` — секреты
- `server/logs/` — логи приложения
- `*.rar`, `*.zip`, `*.tar.gz` — архивы
- `dump-*.txt` — дампы
- `# File Tree*.md` — артефакты инструментов

Если случайно закоммитили лишнее:

    git rm --cached <файл>     # убрать из индекса, оставить на диске
    git commit -m "chore: удалить <файл> из репозитория"

### Ветки (для экспериментов)

Создать ветку и переключиться:

    git checkout -b experiment-new-feature

Работать, коммитить, пушить:

    git push -u origin experiment-new-feature

Вернуться в `main`:

    git checkout main

Слить ветку (если эксперимент удался):

    git merge experiment-new-feature
    git push

Удалить ветку:

    git branch -d experiment-new-feature

### Просмотр на GitHub

Открыть репозиторий в браузере:

    gh repo view --web

Или напрямую: https://github.com/igordolgov/nuxtshop

### Если что-то сломалось

**Проверить, к какому репозиторию привязан проект:**

    git remote -v

Должно быть:

    origin  https://github.com/igordolgov/nuxtshop.git

**Если URL другой (например, старый `nuxt-shop`):**

    git remote set-url origin https://github.com/igordolgov/nuxtshop.git

**Проверить, что ветка связана с удалённой:**

    git status
    # должно быть: "Your branch is up to date with 'origin/main'"

**Если `push` говорит `no upstream branch`:**

    git push -u origin main

Флаг `-u` нужен **только один раз** — потом `git push` работает без аргументов.

---

## Известные проблемы

### Windows + Nuxt 4.6.0

**Симптом:** ошибка 500 `Either manifest or precomputed data must be provided`
в `vue-bundle-renderer`.

**Причина:** баг в Nuxt 4.6.0, специфичный для Windows. На Linux та же версия
работает нормально.

**Решение:** использовать **Nuxt 4.5.2** (закреплено в `package.json` без `^`,
чтобы pnpm не подтянул более новую версию).

### pnpm 11 блокирует postinstall

**Симптом:** `ERR_PNPM_IGNORED_BUILDS` при `pnpm install`, отсутствие нативных
бинарников (`esbuild`, `@parcel/watcher`).

**Решение:** в `pnpm-workspace.yaml` должен быть блок:

    onlyBuiltDependencies:
      - '@parcel/watcher'
      - electron-winstaller
      - esbuild

Затем `pnpm install` или `pnpm approve-builds`.

### Перенос с Linux на Windows

Если проект разрабатывался на Linux, при переносе на Windows:

1. Удалить `node_modules/`, `.nuxt/`, `.output/`, `pnpm-lock.yaml`
2. `pnpm install` — пересобрать нативные бинарники
3. `pnpm approve-builds` — разрешить postinstall
4. `pnpm dev`

## Соглашения по коду

- **Компоненты:** PascalCase (`ProductCard.vue`)
- **Composables:** camelCase с префиксом `use` (`useCart.ts`)
- **API-роуты:** kebab-case (`server/api/products/add.post.js`)
- **Стили:** TailwindCSS utility-классы, кастомные — в `app/assets/css/`
- **Типы:** в `app/types/` или локально в `<script setup>`
- **Комментарии:** на русском, для сложной логики — «почему», а не «что»

## Лицензия

Учебный проект. Свободное использование в образовательных целях.
