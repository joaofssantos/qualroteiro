// Internal reference captures of competitor home pages. Inside `agentop run --rm`; disposable profile.
import { chromium } from '../../../../apps/web/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const OUT = new URL('../refs/', import.meta.url).pathname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sites = (process.env.SITES ?? 'mapeia=https://mapeia.com.br/,rotasbrasil=https://rotasbrasil.com.br/,qualp=https://qualp.com.br/').split(',').map(s => s.split(/=(.+)/));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-mock-keychain', '--password-store=basic'] });
for (const [name, url] of sites) for (const [vn, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, isMobile: vn === 'mobile', locale: 'pt-BR' });
  const page = await ctx.newPage();
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    console.log(name, vn, r?.status(), page.url(), await page.title());
    await page.screenshot({ path: `${OUT}${name}-${vn}-home.png` });
    if (vn === 'desktop') {
      await page.screenshot({ path: `${OUT}${name}-${vn}-home-full.png`, fullPage: true });
      fs.writeFileSync(`${OUT}${name}-text.txt`, (await page.innerText('body')).slice(0, 6000));
    }
  } catch (e) { console.log(name, vn, 'ERR', String(e).split('\n')[0]); }
  await ctx.close();
}
await browser.close();
