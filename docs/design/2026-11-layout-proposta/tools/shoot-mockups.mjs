// Screenshots of the static mockups (file://), disposable profile. Run inside `agentop run --rm`.
import { chromium } from '../../../../apps/web/node_modules/@playwright/test/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-mock-keychain', '--password-store=basic'] });
const pages = ['a-consulta', 'a-resultado', 'a-praca', 'b-consulta', 'b-resultado', 'b-praca'];
const only = process.env.ONLY;
for (const [vn, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: vn === 'mobile' ? 2 : 1, colorScheme: theme });
    for (const p of pages) {
      if (only && !p.startsWith(only)) continue;
      const page = await ctx.newPage();
      const sheets = vn === 'mobile' && p.startsWith('a-') && p !== 'a-consulta' ? ['peek', 'half', 'full'] : [null];
      for (const sh of sheets) {
        await page.goto(`file://${ROOT}mockups/${p}.html?theme=${theme}${sh ? `&sheet=${sh}` : ''}`);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${ROOT}screens/${p}-${vn}-${theme}${sh ? '-' + sh : ''}.png`, fullPage: false });
      }
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
