import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, expect, test } from '@playwright/test';

import { auditContrast, auditFocus, auditTargets } from './layout-audit';
import {
  type LayoutId,
  type Theme,
  VIEWPORTS,
  type ViewportName,
  calculateSpToRj,
  fillSpToRj,
  openApp,
  waitMapIdle,
} from './layout-helpers';
import { countTokenPixels, measureMapContrast } from './layout-map-contrast';

const THEMES: Theme[] = ['light', 'dark'];
const REPORT_DIR = process.env.E2E_REPORT_DIR;

function record(name: string, data: unknown): void {
  if (!REPORT_DIR) return;
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

async function shot(page: Page, name: string): Promise<void> {
  if (!REPORT_DIR) return;
  mkdirSync(REPORT_DIR, { recursive: true });
  await page.screenshot({ path: join(REPORT_DIR, `${name}.png`) });
}

/** Número exibido em cada pino de praça == número da lista (1-based). */
async function expectPinsMatchList(page: Page): Promise<void> {
  const rows = page.getByRole('list', { name: 'Praças de pedágio' }).getByRole('listitem');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  const pins = page.locator('button.maplibregl-marker').filter({ hasText: /^\d+$/ });
  await expect(pins).toHaveCount(count);
  for (let i = 0; i < count; i += 1) {
    await expect(pins.nth(i)).toHaveText(String(i + 1));
    await expect(rows.nth(i)).toContainText(new RegExp(`^${i + 1}(?!\\d)`));
  }
}

export function defineLayoutSuite(layout: LayoutId): void {
  for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
    for (const theme of THEMES) {
      const id = `${layout}-${viewport}-${theme}`;
      test.describe(`layout ${layout} · ${viewport} · ${theme}`, () => {
        test('calcula SP→RJ, mostra o total, abre uma praça e os pinos batem com a lista', async ({ page }) => {
          await openApp(page, { layout, theme, viewport });
          await calculateSpToRj(page);

          await expect(page.getByText('R$ 310,72').first()).toBeVisible();
          await expectPinsMatchList(page);

          const list = page.getByRole('list', { name: 'Praças de pedágio' });
          await list.getByRole('button').first().click();
          const drawer = page.getByRole('dialog');
          await expect(drawer.getByRole('heading', { name: 'Arujá' })).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(drawer).toBeHidden();

          await waitMapIdle(page);
          await shot(page, `${id}-resultado`);
        });

        if (layout === 'b') {
          test('pinos e prévia aparecem antes do Calcular', async ({ page }) => {
            await openApp(page, { layout, theme, viewport });
            await fillSpToRj(page);

            await expect(page.getByRole('button', { name: /^Origem: / })).toBeVisible();
            await expect(page.getByRole('button', { name: /^Destino: / })).toBeVisible();
            await expect(page.getByText(/≈ \d+ km/)).toBeVisible({ timeout: 10_000 });
            await expect(page.getByRole('heading', { name: 'Resultado da rota' })).toHaveCount(0);

            await waitMapIdle(page);
            expect(await countTokenPixels(page, '--route-alt')).toBeGreaterThan(150);
            await shot(page, `${id}-previa`);
          });
        } else {
          test('sem prévia antes do Calcular', async ({ page }) => {
            await openApp(page, { layout, theme, viewport });
            await fillSpToRj(page);
            await expect(page.getByRole('button', { name: /^Origem: / })).toBeVisible();
            await expect(page.getByText(/≈ \d+ km/)).toHaveCount(0);
            await waitMapIdle(page);
            expect(await countTokenPixels(page, '--route-alt')).toBeLessThan(40);
          });
        }

        test('auditoria: contraste de texto, alvos de toque e foco visível', async ({ page }) => {
          await openApp(page, { layout, theme, viewport });
          await calculateSpToRj(page);
          await waitMapIdle(page);

          const contrast = await auditContrast(page);
          const targets = await auditTargets(page);
          const focus = await auditFocus(page);
          record(`audit-${id}`, { contrast, targets, focus });

          expect.soft(contrast.failures, 'texto abaixo do contraste mínimo').toEqual([]);
          expect.soft(focus.invisible, 'elementos sem foco visível').toEqual([]);
          if (viewport === 'mobile') {
            expect.soft(targets.small, 'alvos < 44 px no mobile').toEqual([]);
          }
        });

        test('contraste real de rota e pinos sobre o mapa renderizado', async ({ page }) => {
          await openApp(page, { layout, theme, viewport });
          await calculateSpToRj(page);
          await waitMapIdle(page);

          const report = await measureMapContrast(page);
          record(`mapcontrast-${id}`, report);

          expect(report.route.routePixels).toBeGreaterThan(50);
          expect.soft(report.route.routeVsCasing, 'traço vs contorno ≥ 3:1').toBeGreaterThanOrEqual(3);
          expect.soft(report.route.outerEdgeMin, 'borda externa (contorno ou traço) vs mapa-base ≥ 3:1').toBeGreaterThanOrEqual(3);
          for (const pin of report.pins) {
            if (pin.textVsFill >= 0) expect.soft(pin.textVsFill, `número do pino ${pin.label} ≥ 4,5:1`).toBeGreaterThanOrEqual(4.5);
            // O preenchimento é o que identifica o pino; o anel branco/escuro é só realce.
            expect.soft(pin.fillVsBasemap, `preenchimento do pino ${pin.label} vs mapa ≥ 3:1`).toBeGreaterThanOrEqual(3);
          }
        });
      });
    }
  }
}
