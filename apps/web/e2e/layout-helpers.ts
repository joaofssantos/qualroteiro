import { type Page, expect } from '@playwright/test';

export type LayoutId = 'a' | 'b';
export type Theme = 'light' | 'dark';

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

export const LAYOUT_KEY = 'qualroteiro:layout';
export const THEME_KEY = 'qualroteiro:theme';

/**
 * Fixa layout e tema na PRIMEIRA carga e registra cada `load` (para provar que a troca
 * em Ajustes não recarrega). O marcador em `sessionStorage` impede que o script de
 * inicialização sobrescreva uma escolha feita depois pelo usuário.
 */
export async function openApp(
  page: Page,
  opts: { layout: LayoutId; theme: Theme; viewport: ViewportName; path?: string },
): Promise<{ loads: () => number }> {
  await page.setViewportSize(VIEWPORTS[opts.viewport]);
  await page.addInitScript(
    ([layoutKey, themeKey, layout, theme]) => {
      try {
        if (!sessionStorage.getItem('e2e-init')) {
          localStorage.setItem(layoutKey!, layout!);
          localStorage.setItem(themeKey!, theme!);
          sessionStorage.setItem('e2e-init', '1');
        }
      } catch {
        /* storage indisponível */
      }
    },
    [LAYOUT_KEY, THEME_KEY, opts.layout, opts.theme],
  );
  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });
  await page.goto(opts.path ?? '/rota-custos');
  await expect(page.getByRole('combobox', { name: 'Origem' })).toBeVisible();
  return { loads: () => loads };
}

export async function pickPlace(page: Page, field: 'Origem' | 'Destino', typed: string): Promise<void> {
  await page.getByRole('combobox', { name: field }).fill(typed);
  await page.getByRole('option').first().click();
}

export async function fillSpToRj(page: Page): Promise<void> {
  await pickPlace(page, 'Origem', 'São Paulo');
  await pickPlace(page, 'Destino', 'Rio');
}

export async function calculateSpToRj(page: Page): Promise<void> {
  await fillSpToRj(page);
  await page.getByRole('button', { name: 'Calcular rota' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado da rota' })).toBeVisible();
}

/** Aguarda o MapLibre terminar de desenhar (estilo + tiles) antes de capturar pixels. */
export async function waitMapIdle(page: Page): Promise<void> {
  await expect(page.getByRole('region', { name: 'Mapa da rota' })).toBeVisible();
  await page.waitForTimeout(2500);
}

export async function switchLayoutInSettings(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('radio', { name: label }).click();
  // Trocar o shell remonta os Ajustes (o diálogo fecha sozinho); se ficou aberto, fecha.
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

export async function setTheme(page: Page, theme: Theme): Promise<void> {
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((theme === 'dark') !== dark) {
    await page.getByRole('button', { name: /Alternar para tema/ }).click();
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
    .toBe(theme === 'dark');
}
