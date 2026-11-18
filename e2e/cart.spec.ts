import { expect, test } from '@playwright/test';

// Вход в корзину: десктоп — иконка в шапке (HeaderCartMenu): пустая корзина —
// <a> на /cart, с товарами — кнопка дропдауна (на страницу ведёт «Корзина»
// в панели); мобильный — кнопка нижней навигации (openCart →
// navigateTo('/cart')). Скоуп header/: у футера тоже есть ссылка «Корзина»;
// скрытые дубли отфильтровываются по видимости.
const cartEntry = (page: import('@playwright/test').Page) =>
  page
    .locator(
      'header a[href*="/cart"], header button[aria-controls="header-mini-cart"], .mobile-nav-footer button:has(path[d^="M3 3h2l.4 2"])',
    )
    .filter({ visible: true })
    .first();

// Десктоп: после клика по иконке корзины с товарами открывается дропдаун
// мини-корзины — на страницу корзины ведёт кнопка «Корзина» в панели.
// Мобильный: кнопка нижней навигации ведёт на /cart напрямую.
async function goToCartPage(page: import('@playwright/test').Page) {
  await cartEntry(page).click();
  if (test.info().project.name !== 'mobile') {
    await expect(page.locator('#header-mini-cart')).toBeVisible();
    await page.locator('#header-mini-cart .mini-cart-go-cart').click();
  }
}

// Корзина: добавление с карточки → страница /cart показывает товар.
// Состояние корзины живёт в localStorage и изолировано per-test —
// прод не засоряется (заказы НЕ оформляем, только содержимое корзины).
async function openFirstProduct(page: import('@playwright/test').Page) {
  await page.goto('/');
  // :not([href*="/product/test"]) — пропускаем «тестовые» товары из
  // экспериментов в админке (кейс 2026-11-18: тестовый товар в каталоге
  // CU с битой картинкой и карточкой 404 ломал клик по первой карточке).
  const card = page.locator('a[href*="/product/"]:not([href*="/product/test"])').first();
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

  // Счётчик корзины: мини-корзина в шапке (десктоп) / нижняя навигация (мобильный)
  const badge = page
    .locator('.mini-cart-badge, .mobile-nav-footer .cart-badge')
    .filter({ visible: true })
    .first();
  await expect(badge).toBeVisible();

  // Страница корзины: заголовок и счётчик позиций отрисованы
  await goToCartPage(page);
  await expect(page).toHaveURL(/\/cart/);
  // Пустая корзина не показывается, счётчик позиций виден
  await expect(page.locator('.empty-cart-content')).toBeHidden();
  await expect(page.locator('.cart-header span.text-sm')).toBeVisible();
});
