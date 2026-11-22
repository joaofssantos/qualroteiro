import { expect, test } from '@playwright/test';

import { defineLayoutSuite } from './layout-suite';
import {
  VIEWPORTS,
  type ViewportName,
  calculateSpToRj,
  openApp,
  switchLayoutInSettings,
} from './layout-helpers';

defineLayoutSuite('a');

for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
  test(`A → B → A em Ajustes (${viewport}) sem recarregar, com um único mapa e o resultado preservado`, async ({ page }) => {
    const { loads } = await openApp(page, { layout: 'a', theme: 'light', viewport });
    await calculateSpToRj(page);
    const mapNode = await page.locator('.maplibregl-map').elementHandle();
    expect(loads()).toBe(1);

    await switchLayoutInSettings(page, /Custos primeiro/);
    await expect(page.getByRole('heading', { name: 'Resultado da rota' })).toBeVisible();
    await expect(page.locator('.maplibregl-map')).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('qualroteiro:layout'))).toBe('b');

    await switchLayoutInSettings(page, /Mapa primeiro/);
    await expect(page.getByRole('heading', { name: 'Resultado da rota' })).toBeVisible();
    await expect(page.locator('.maplibregl-map')).toHaveCount(1);
    expect(await mapNode!.evaluate((node) => node.isConnected)).toBe(true);
    expect(loads()).toBe(1);
  });
}
