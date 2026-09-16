import { chromium } from '/Users/joaofsantos/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,executablePath:'/Users/joaofsantos/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.getByLabel('Origem', {exact:true}).fill('Sao Paulo');
  const origin = page.getByRole('listbox').getByRole('option').first();
  await origin.waitFor({timeout:20000});
  console.log('Origin suggestion:', await origin.innerText());
  await origin.click();
  await page.getByLabel('Destino', {exact:true}).fill('Rio de Janeiro');
  const destination = page.getByRole('listbox').getByRole('option').first();
  await destination.waitFor({timeout:20000});
  console.log('Destination suggestion:', await destination.innerText());
  await destination.click();
  const responsePromise = page.waitForResponse(r => r.url().includes('/routes/plan') && r.request().method() === 'POST', {timeout:60000});
  await page.getByRole('button', {name:'Calcular rota',exact:true}).click();
  const response = await responsePromise;
  const body = await response.json();
  assert.equal(response.status(),200,JSON.stringify(body));
  assert.ok(body.routes?.length > 0);
  console.log(JSON.stringify({status:response.status(),routes:body.routes.length,distanceKm:body.routes[0].distanceKm}));
  await page.screenshot({path:'/private/tmp/qualroteiro-ui-results/routing-live.png',fullPage:true});
} finally { await browser.close(); }
