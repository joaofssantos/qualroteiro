import { chromium } from '/Users/joaofsantos/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out = '/private/tmp/qualroteiro-ui-results';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Users/joaofsantos/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5173');
  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await page.getByText('Entre para planejar viagens', { exact: true }).waitFor();
  results.push({ test: 'Planejamento sem login', passed: true });
  await page.screenshot({ path: `${out}/public-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/public-mobile.png`, fullPage: true });
  results.push({ test: 'Overflow mobile publico', overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  await page.close();

  const ui = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  ui.setDefaultTimeout(12000);
  ui.on('pageerror', e => errors.push(e.message));
  await ui.route('**/src/core/auth/AuthProvider.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const AuthProvider = ({children}) => children; export const AuthActions = () => null;' }));
  await ui.route('**/src/core/auth/AuthContext.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const useQualAuth = () => auth; const auth = {isConfigured:true,isLoaded:true,isSignedIn:true,userName:"QA",getToken:async()=>"test-only"}; export const missingAuth = auth; export const AuthContext = {};' }));
  const item = (id, title, order) => ({ id, title, order, tripDayId: 'day-1', moduleId: 'hospedagem', kind: 'stay', payload: { placeName: title, address: 'Rua Teste', checkIn: '2026-10-01', checkOut: '2026-10-02', pricePerNight: 100 }, costEstimate: 100 });
  const initial = { id: 'qa-trip', userId: 'qa', title: 'Viagem QA', startDate: '2026-10-01', endDate: '2026-10-02', createdAt: '2026-09-15T12:00:00Z', updatedAt: '2026-09-15T12:00:00Z', days: [{ id: 'day-1', tripId: 'qa-trip', date: '2026-10-01', order: 0, items: [item('a', 'Hotel A', 0), item('b', 'Hotel B', 1), item('c', 'Hotel C', 2)] }, { id: 'day-2', tripId: 'qa-trip', date: '2026-10-02', order: 1, items: [] }] };
  let trip = structuredClone(initial);
  let patches = [];
  await ui.route(url => /^\/(api\/)?trips(?:\/|$)/.test(url.pathname), async route => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON();
      const id = new URL(request.url()).pathname.split('/').pop();
      patches.push({ id, body });
      return route.fulfill({ json: { id, ...body } });
    }
    return route.fulfill({ json: new URL(request.url()).pathname.endsWith('/trips') ? { trips: [{ ...trip, dayCount: 2, itemCount: 3 }] } : trip });
  });
  await ui.goto('http://localhost:5173/planejamento-viagem');
  await ui.getByRole('link', { name: /Viagem QA/ }).click();
  await ui.getByRole('button', { name: 'Reordenar Hotel A', exact: true }).waitFor();
  results.push({ test: 'Abrir viagem e orçamento (mocks)', budget: await ui.getByTestId('trip-budget-total').innerText() });
  const order = () => ui.locator('li').allTextContents();
  async function drag(from, to) {
    const a = await ui.getByRole('button', { name: from, exact: true }).boundingBox();
    const b = await ui.getByRole('button', { name: to, exact: true }).boundingBox();
    await ui.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await ui.mouse.down();
    await ui.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
    await ui.mouse.up();
    await ui.locator('[aria-busy="false"]').waitFor();
  }
  await drag('Reordenar Hotel A', 'Reordenar Hotel B');
  results.push({ test: 'Arrastar A para posicao B', order: await order(), patches: structuredClone(patches) });
  await ui.screenshot({ path: `${out}/drag-a-to-b.png`, fullPage: true });
  patches = [];
  await drag('Reordenar Hotel C', 'Reordenar Hotel A');
  results.push({ test: 'Arrastar C para posicao A', order: await order(), patches: structuredClone(patches) });
  await ui.setViewportSize({ width: 390, height: 844 });
  await ui.screenshot({ path: `${out}/planning-mobile.png`, fullPage: true });
  results.push({ test: 'Overflow mobile planejamento', overflow: await ui.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  results.push({ test: 'Erros JavaScript', errors });
} catch (error) {
  results.push({ test: 'Execution error', error: error.stack });
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
