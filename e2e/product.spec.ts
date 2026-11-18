import { expect, test } from '@playwright/test';

// Счётчик корзины: десктоп — badge мини-корзины в шапке (.mini-cart-badge),
// мобильный — cart-badge в нижней навигации; скрытые дубли отфильтровываем
const cartBadge = (page: import('@playwright/test').Page) =>
  page
    .locator('.mini-cart-badge, .mobile-nav-footer .cart-badge')
    .filter({ visible: true })
    .first();

// Открытая карточка товара (переходим с каталога — не хардкодим slug:
// сид-товары стабильны, но каталог может редактироваться из админки).
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

test('карточка: название, цена, блок характеристик', async ({ page }) => {
  await openFirstProduct(page);

  // Цена: денежный формат (₽/$/CUP) виден в секции цены
  const priceSection = page.locator('.product-info .price-section');
  await expect(priceSection).toBeVisible();
  await expect(priceSection).toContainText(/[\d\u00a0\s][\d\u00a0\s.,]*\s?(₽|\$|CUP)/u);

  // Характеристики: свернутый/развернутый <details> с заголовком раздела
  await expect(page.locator('.product-info details').first()).toBeVisible();

  // Кнопка добавления: на десктопе инлайн (lg:block), на мобильном —
  // фиксированная CTA; в этой проверке достаточно ВИДИМОЙ хотя бы одной
  const addButtons = page
    .locator('.product-info div[class~="lg:block"] button, .fixed-bottom-cart-button button')
    .filter({ visible: true });
  await expect(addButtons.first()).toBeVisible();
});

test('мобильный: фиксированная CTA «В корзину» работает', async ({ page }) => {
  // Только мобильный проект: CTA скрыта на десктопе (lg:hidden)
  test.skip(test.info().project.name !== 'mobile', 'CTA видна только на мобильных');

  await openFirstProduct(page);

  const cta = page.locator('.fixed-bottom-cart-button button');
  await expect(cta).toBeVisible();
  await expect(cta).toBeEnabled();

  await cta.click();
  // После добавления кнопка гаснет (disabled + зелёная) — состояние в localStorage
  await expect(cta).toBeDisabled();
  // Счётчик корзины в нижней навигации появился
  await expect(cartBadge(page)).toBeVisible();
});

test('десктоп: кнопка «В корзину» в карточке работает', async ({ page }) => {
  // Только десктопный проект
  test.skip(test.info().project.name !== 'desktop', 'инлайн-кнопка видна только на lg+');

  await openFirstProduct(page);

  const addBtn = page.locator('.product-info div[class~="lg:block"] button');
  await expect(addBtn).toBeVisible();
  await expect(addBtn).toBeEnabled();

  await addBtn.click();
  await expect(addBtn).toBeDisabled();
  await expect(cartBadge(page)).toBeVisible();
});
