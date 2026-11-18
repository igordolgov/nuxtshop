import { expect, test } from '@playwright/test';

// Локализация: проверяем переключатель языка АГНОСТИЧНО к витрине —
// RU-магазин: ru (без префикса) + /en + /es; кубинская копия: es
// (без префикса) + /en, русского нет вовсе (STORE_LOCALES). Общее
// поведение одно: в шапке (только lg+) кнопка открывает меню, в меню —
// ссылки на все локали витрины, переход — обычная <a> (полная загрузка,
// SSR отдаёт целевую локаль по URL).
test('переключатель языка открывает меню и ведёт на другой язык', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'переключатель в шапке — только lg+');

  await page.goto('/');

  // ГИДРАЦИЯ: кнопка и меню есть уже в SSR-HTML, Playwright успевает
  // кликнуть ДО монтирования Vue — клик проглатывается, v-show не
  // переключается и меню остаётся hidden. Стабильно воспроизводится
  // в CI сразу после деплоя: воркер холодный, гидрация запаздывает
  // (упало на d237b5f, 3 ретрая подряд). Ждём __vue_app__ — Vue 3
  // кладёт инстанс приложения на контейнер #__nuxt при mount().
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#__nuxt');
      return !!el && '__vue_app__' in el;
    },
    undefined,
    { timeout: 20_000 },
  );

  const menu = page.locator('ul.locale-menu');
  await expect(menu).toBeAttached({ timeout: 10_000 });

  // Меню скрыто до клика (v-show); кнопка — структурный сосед меню
  // (aria-label зависит от текущей локали: «Язык — ru» / «Idioma — es»)
  await expect(menu).toBeHidden();
  const switcher = page.locator('div.relative:has(> ul.locale-menu) > button');
  await switcher.click();
  await expect(menu).toBeVisible();

  // В меню ≥2 языка: текущий (для дефолтной локали ссылка без префикса —
  // «/») + хотя бы один префиксованный. Берём первую ссылку с префиксом —
  // она гарантированно ведёт на ДРУГУЮ локаль, состав языков не важен.
  const links = menu.locator('a');
  await expect(links.first()).toBeAttached();

  const total = await links.count();
  let targetHref: string | undefined;
  for (let i = 0; i < total; i += 1) {
    const href = await links.nth(i).getAttribute('href');
    if ((href ?? '').replace(/^\//, '').split('/')[0]) {
      targetHref = href ?? undefined;
      break;
    }
  }
  expect(targetHref, 'в меню есть ссылка на другой язык').toBeTruthy();
  if (!targetHref) return;

  const code = targetHref.replace(/^\//, '').split('/')[0];
  await menu.locator(`a[href="${targetHref}"]`).click();
  await expect(page).toHaveURL(new RegExp(`\\/${code}(\\/|$)`));
  await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(code));
});
