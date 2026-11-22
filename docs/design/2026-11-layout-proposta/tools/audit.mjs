// Screenshots of the CURRENT app (demo mode, fixtures only). Run inside `agentop run --rm`.
import { chromium } from '../../../../apps/web/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5199';
const OUT = new URL('../audit/', import.meta.url).pathname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-mock-keychain', '--password-store=basic'] });
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
for (const [name, viewport] of Object.entries(sizes).filter(([n]) => !process.env.ONLY || n === process.env.ONLY)) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: name === 'mobile' });
    await ctx.addInitScript((t) => localStorage.setItem('qualroteiro:theme', t), theme);
    const page = await ctx.newPage();
    await page.goto(BASE + '/');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}${name}-${theme}-1-form.png` });
    try {
      await page.getByLabel('Origem').pressSequentially('São Paulo', { delay: 40 });
      await page.getByRole('option').first().waitFor({ timeout: 8000 });
      await page.getByRole('option').first().click();
      await page.getByLabel('Destino').pressSequentially('Rio de Janeiro', { delay: 40 });
      await page.getByRole('option').first().waitFor({ timeout: 8000 });
      await page.getByRole('option').first().click();
      await page.screenshot({ path: `${OUT}${name}-${theme}-2-form-filled.png`, fullPage: true });
      await page.getByRole('button', { name: /Calcular rota/ }).dispatchEvent('click');
      await page.waitForURL(/resultado/, { timeout: 8000 });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${OUT}${name}-${theme}-3-result.png` });
      await page.screenshot({ path: `${OUT}${name}-${theme}-3-result-full.png`, fullPage: true });
      for (const tab of ['Combustível', 'Pontos na rota', 'Alternativas']) {
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}${name}-${theme}-4-${tab.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.png` });
      }
    } catch (e) { console.log('flow error', name, theme, String(e).split('\n')[0]); await page.screenshot({ path: `${OUT}err-${name}-${theme}.png` }); }
    await ctx.close();
  }
}
await browser.close();
