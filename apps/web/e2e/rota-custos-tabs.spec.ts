import { expect, test } from '@playwright/test';

const LONG_DUTRA_ROUTE = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [-46.6333, -23.5505],
      [-43.1729, -22.9068],
    ],
  },
  distanceKm: 429.7,
  durationMin: 342.5,
  tolls: {
    plazas: Array.from({ length: 61 }, (_, index) => ({
      id: `dutra-${index + 1}`,
      name: `Praça Dutra ${index + 1}`,
      concessionaire: 'Concessionária Dutra',
      highway: 'BR-116',
      km: 10 + index,
      lat: -23.5 + index * 0.01,
      lng: -46.6 + index * 0.01,
    })),
    total: 0,
  },
  fuel: { liters: 42.97, cost: 257.82 },
  points: { tolls: [], fuelStations: [] },
};

test.describe('Rota & Custos — TabsList com lista longa', () => {
  test('keeps tabs 40px high, contained, keyboard reachable and panel-scrollable', async ({ page }) => {
    await page.route('**/routes/plan', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ routes: [LONG_DUTRA_ROUTE] }) });
    });

    await page.goto('/rota-custos');
    await page.getByLabel('Origem').fill('São Paulo, SP');
    await page.getByLabel('Destino').fill('Rio de Janeiro, RJ');
    await page.getByRole('button', { name: 'Calcular rota' }).click();
    await expect(page.getByRole('heading', { name: 'Resultado da rota' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Praças de pedágio' }).getByRole('listitem')).toHaveCount(61);

    for (const viewport of [
      { width: 1600, height: 1050 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const dimensions = await page.evaluate(() => {
        const tablist = document.querySelector<HTMLElement>('[role="tablist"]');
        const panel = document.querySelector<HTMLElement>('[aria-label="Custos da rota"]');
        if (!tablist || !panel) throw new Error('tabs ou painel ausentes');
        const listRect = tablist.getBoundingClientRect();
        const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')].map((tab) => {
          const rect = tab.getBoundingClientRect();
          return {
            topInside: rect.top >= listRect.top - 1,
            bottomInside: rect.bottom <= listRect.bottom + 1,
            height: rect.height,
          };
        });
        return {
          tablist: { height: listRect.height, clientWidth: tablist.clientWidth, scrollWidth: tablist.scrollWidth },
          tabs,
          pageHasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          panelHasVerticalScroll: panel.scrollHeight > panel.clientHeight,
          pageHasVerticalScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        };
      });

      expect(dimensions.tablist.height).toBeGreaterThanOrEqual(39);
      expect(dimensions.tabs).toHaveLength(4);
      for (const tab of dimensions.tabs) {
        expect(tab.topInside).toBe(true);
        expect(tab.bottomInside).toBe(true);
        expect(tab.height).toBeLessThanOrEqual(dimensions.tablist.height + 1);
      }
      expect(dimensions.pageHasHorizontalOverflow).toBe(false);
      expect(dimensions.panelHasVerticalScroll || dimensions.pageHasVerticalScroll).toBe(true);
    }

    await page.setViewportSize({ width: 1600, height: 1050 });
    const initialHeight = await page.getByRole('tablist').evaluate((node) => node.getBoundingClientRect().height);
    for (const name of ['Combustível', 'Pontos na rota', 'Alternativas', 'Pedágios']) {
      await page.getByRole('tab', { name }).click();
      await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tablist')).toHaveJSProperty('clientHeight', initialHeight);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const firstTab = page.getByRole('tab', { name: 'Pedágios' });
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Combustível' })).toBeFocused();

    await page.getByRole('tab', { name: 'Pedágios' }).click();
    const lastPlaza = page.getByRole('list', { name: 'Praças de pedágio' }).getByRole('listitem').last();
    await lastPlaza.scrollIntoViewIfNeeded();
    await expect(lastPlaza).toBeInViewport();
    const total = page.getByText('Total de pedágios');
    await total.scrollIntoViewIfNeeded();
    await expect(total).toBeInViewport();
    await expect(page.getByText(/Localização das praças informada pela ANTT/)).toBeVisible();
  });
});
