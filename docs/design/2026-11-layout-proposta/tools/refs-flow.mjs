// Runs a SP->RJ route on each reference site and captures result screens (internal reference only).
import { chromium } from '../../../../apps/web/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const OUT = new URL('../refs/', import.meta.url).pathname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const only = process.env.ONLY;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-mock-keychain', '--password-store=basic'] });
const sleep = (p, ms) => p.waitForTimeout(ms);
async function pick(page, loc, text) {
  await loc.click(); await loc.pressSequentially(text, { delay: 60 }); await sleep(page, 1800);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(page, 500);
}
const flows = {
  async mapeia(page, vn) {
    await page.goto('https://www.mapeia.com.br/'); await sleep(page, 3000);
    await page.getByText('OK', { exact: true }).first().click().catch(() => {});
    await pick(page, page.getByPlaceholder('Digite a origem'), 'São Paulo, SP');
    await pick(page, page.getByPlaceholder('Digite o destino'), 'Rio de Janeiro, RJ');
    await page.getByPlaceholder('R$ / litro').fill('6').catch(() => {});
    await page.getByPlaceholder('Km / litro').fill('10').catch(() => {});
    await page.screenshot({ path: `${OUT}mapeia-${vn}-filled.png` });
    await page.getByText('Mapear').first().click(); await sleep(page, 9000);
  },
  async rotasbrasil(page, vn) {
    await page.goto('https://rotasbrasil.com.br/'); await sleep(page, 3000);
    await page.locator('#adopt-reject-all-button').click().catch(() => {});
    await page.locator('#txtEnderecoPartida').pressSequentially('São Paulo, SP', { delay: 80 }); await sleep(page, 2000);
    await page.locator('ul.ui-autocomplete li').first().click().catch(() => {}); await sleep(page, 800);
    await page.locator('#txtEnderecoChegada').pressSequentially('Rio de Janeiro, RJ', { delay: 80 }); await sleep(page, 2000);
    await page.locator('ul.ui-autocomplete li').first().click().catch(() => {}); await sleep(page, 800);
    await page.locator('#precoCombustivel').fill('6'); await page.locator('#consumo').fill('10');
    await page.screenshot({ path: `${OUT}rotasbrasil-${vn}-filled.png` });
    await page.locator('#btnSubmit').click(); await sleep(page, 12000);
  },
  async qualp(page, vn) {
    await page.goto('https://qualp.com.br/'); await sleep(page, 4000);
    await page.locator('.close-button').first().click().catch(() => {});
    await page.keyboard.press('Escape'); await sleep(page, 800);
    const opt = (t) => page.getByText(t, { exact: false }).first().click().catch(() => {});
    await page.getByPlaceholder('Origem').first().click(); await sleep(page, 800); await page.keyboard.type('São Paulo, SP', { delay: 80 }); await sleep(page, 2500); await opt('São Paulo (Cidade)'); await sleep(page, 1200);
    await page.getByPlaceholder('Destino').first().click(); await sleep(page, 800); await page.keyboard.type('Rio de Janeiro, RJ', { delay: 80 }); await sleep(page, 2500); await opt('Rio de Janeiro (Cidade)'); await sleep(page, 1200);
    await page.getByText('Consumo').first().locator('xpath=..').locator('input').first().fill('10').catch(() => {});
    await page.getByText('Preço').first().locator('xpath=..').locator('input').first().fill('6').catch(() => {});
    await page.screenshot({ path: `${OUT}qualp-${vn}-filled.png` });
    await page.getByRole('button', { name: 'CALCULAR' }).click(); await sleep(page, 12000);
  },
};
for (const [name, fn] of Object.entries(flows)) {
  if (only && only !== name) continue;
  for (const [vn, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport, isMobile: vn === 'mobile', locale: 'pt-BR' });
    const page = await ctx.newPage();
    try { await fn(page, vn); } catch (e) { console.log(name, vn, 'ERR', String(e).split('\n')[0]); }
    await page.screenshot({ path: `${OUT}${name}-${vn}-result.png` });
    if (vn === 'desktop') fs.writeFileSync(`${OUT}${name}-result-text.txt`, (await page.innerText('body').catch(() => '')).slice(0, 8000));
    await ctx.close();
  }
}
await browser.close();
