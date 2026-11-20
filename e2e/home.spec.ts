import { expect, test } from '@playwright/test';

// Каталог должен успеть догрузиться после гидратации (SSR отдаёт каркас,
// товары приходят с /api/products) — щедрый таймаут на первую карточку.
const FIRST_PRODUCT = 'a[href*="/product/"]:not([href*="/product/test"])';

// Вход в корзину: десктоп — <a> на /cart в шапке (HeaderCartMenu), мобильный —
// пункт нижней навигации (NuxtLink <a> на /cart; раньше button c openCart);
// скрытые дубли (иконка шапки на мобильных) отфильтровываются по видимости.
const cartEntry = (page: import('@playwright/test').Page) =>
  page
    .locator('a[href*="/cart"], .mobile-nav-footer :is(a, button):has(path[d^="M3 3h2l.4 2"])')
    .filter({ visible: true })
    .first();

test('главная открывается: шапка, каталог, футер', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  // Шапка сайта
  await expect(page.locator('header').first()).toBeVisible();

  // Вход в корзину доступен на обоих макетах
  await expect(cartEntry(page)).toBeVisible();

  // Каталог: есть хотя бы одна карточка товара
  await expect(page.locator(FIRST_PRODUCT).first()).toBeVisible({ timeout: 15_000 });

  // Футер: на десктопе — SiteFooter, на мобильном — нижняя навигация
  const footer = page.locator('footer').filter({ visible: true }).first();
  await expect(footer).toBeVisible();
});

test('клик по карточке ведёт на страницу товара', async ({ page }) => {
  await page.goto('/');
  const card = page.locator(FIRST_PRODUCT).first();
  await card.waitFor({ state: 'visible', timeout: 15_000 });

  await card.click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.locator('.product-info h1')).toBeVisible();
});
