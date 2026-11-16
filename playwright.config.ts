import { defineConfig, devices } from '@playwright/test';

// E2E-тесты (Playwright) — смоук-прогон против ЖИВОЙ витрины.
// Цель задаётся env E2E_BASE_URL (по умолчанию — прод RU-магазина);
// локальный запуск: `pnpm test:e2e`, CI: job e2e в .github/workflows/ci.yml
// после успешного деплоя.
//
// Тесты ТОЛЬКО читающие + локальные состояния (корзина/избранное —
// localStorage, изолируется per-test): заказы и формы (оформление,
// «сообщить о поступлении», отзывы) в прод НЕ отправляются.
const BASE_URL = process.env.E2E_BASE_URL ?? 'https://nuxt-shop.igordolgov1972.workers.dev';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // 10s: прод на free-тарифе может быть холодным (SWR/старт воркера)
  expect: { timeout: 10_000 },
  // Каталог/карточки грузятся после гидратации — параллель не мешает
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    // Trace/скриншот только на упавших — артефакт загружается в CI
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Десктоп: двухколоночная раскладка, фильтры в сайдбаре
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    // Мобильный: нижняя навигация, фиксированная CTA «В корзину»
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
