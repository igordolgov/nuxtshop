import { expect, test } from '@playwright/test';

// Локализация: RU-витрина — ru (без префикса) + /en + /es.
// Переключатель живёт в ДЕСКТОПНОЙ шапке (lg+): на мобильных язык —
// раздел в бургер-меню, поэтому проверяем только десктопный проект.
test('переключатель языка открывает меню и ведёт на /en', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'переключатель в шапке — только lg+');

  await page.goto('/');

  // На RU-витрине три локали → переключатель присутствует
  const menu = page.locator('ul.locale-menu');
  await expect(menu).toBeAttached({ timeout: 10_000 });

  // Меню скрыто до клика (v-show); кнопка-переключатель с aria-label «… — ru»
  await expect(menu).toBeHidden();
  await page.locator('button[aria-label$="— ru"]').click();
  await expect(menu).toBeVisible();

  // Доступные языки: en и es (текущий ru отмечен)
  await expect(menu.locator('a[href^="/en"]')).toBeVisible();
  await expect(menu.locator('a[href^="/es"]')).toBeVisible();

  // Переход на английский — обычная ссылка (полная загрузка, SSR отдаёт /en)
  await menu.locator('a[href^="/en"]').click();
  await expect(page).toHaveURL(/\/en/);
  await expect(page.locator('html')).toHaveAttribute('lang', /en/);
});
