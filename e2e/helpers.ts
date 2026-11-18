// e2e/helpers.ts — общий помощник e2e-спеков.
import type { Page } from '@playwright/test';

/**
 * ГИДРАЦИЯ: элементы витрины (CTA «В корзину», меню языков и т.п.)
 * присутствуют в SSR-HTML — Playwright успевает кликнуть ДО монтирования
 * Vue, клик проглатывается и состояние (disabled/меню/бейдж) не меняется.
 * Стабильно воспроизводится в CI сразу после деплоя: воркер холодный,
 * гидрация запаздывает (флейки: d237b5f — locale-спек, 45b0158 —
 * mobile-CTA на копии CU, 3 ретрая подряд). Ждём __vue_app__ — Vue 3
 * кладёт инстанс приложения на контейнер #__nuxt при mount().
 */
export async function waitForHydration(page: Page, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#__nuxt');
      return !!el && '__vue_app__' in el;
    },
    undefined,
    { timeout },
  );
}
