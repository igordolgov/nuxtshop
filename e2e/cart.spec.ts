import { expect, test } from '@playwright/test';

// Вход в корзину: десктоп — <a> на /cart в шапке, мобильный — кнопка
// нижней навигации (openCart → navigateTo('/cart')); скрытые дубли
// отфильтровываются по видимости.
const cartEntry = (page: import('@playwright/test').Page) =>
  page
    .locator('a[href*="/cart"], .mobile-nav-footer button:has(path[d^="M3 3h2l.4 2"])')
    .filter({ visible: true })
    .first();

// Корзина: добавление с карточки → страница /cart показывает товар.
// Состояние корзины живёт в localStorage и изолировано per-test —
// прод не засоряется (заказы НЕ оформляем, только содержимое корзины).
async function openFirstProduct(page: import('@playwright/test').Page) {
  await page.goto('/');
  const card = page.locator('a[href*="/product/"]').first();
  await card.waitFor({ state: 'visible', timeout: 15_000 });
  await card.click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.locator('.product-info h1')).toBeVisible();
}

test('товар из карточки появляется на странице корзины', async ({ page }) => {
  await openFirstProduct(page);

  // Мобильный проект — фиксированная CTA, десктопный — инлайн-кнопка
  const isMobile = test.info().project.name === 'mobile';
  const addBtn = isMobile
    ? page.locator('.fixed-bottom-cart-button button')
    : page.locator('.product-info div[class~="lg:block"] button');
  await expect(addBtn).toBeVisible();
  await expect(addBtn).toBeEnabled();
  await addBtn.click();
  await expect(addBtn).toBeDisabled();

  // Счётчик корзины: шапка (десктоп) / нижняя навигация (мобильный)
  const badge = page
    .locator('.indicator .badge, .mobile-nav-footer .cart-badge')
    .filter({ visible: true })
    .first();
  await expect(badge).toBeVisible();

  // Страница корзины: заголовок и счётчик позиций отрисованы
  await cartEntry(page).click();
  await expect(page).toHaveURL(/\/cart/);
  // Пустая корзина не показывается, счётчик позиций виден
  await expect(page.locator('.empty-cart-content')).toBeHidden();
  await expect(page.locator('.cart-header span.text-sm')).toBeVisible();
});
