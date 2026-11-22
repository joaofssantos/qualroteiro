import { defineConfig } from '@playwright/test';

/**
 * E2E dos layouts A/B (F11). Roda contra o dev server em MODO DEMO
 * (`VITE_DEMO_MODE=true`: sem rede para a API, dados de fixtures).
 *
 * - porta alta própria (`E2E_PORT`, padrão 5291); nunca 47291/47292;
 * - `E2E_CHROME=/caminho/do/chrome` usa um Chrome instalado (perfil descartável do
 *   Playwright + `--use-mock-keychain`, que o Playwright já passa por padrão);
 * - 1 worker; rode via `agentop run --rm -- pnpm exec playwright test -c playwright.layout.config.ts`.
 */
const port = Number(process.env.E2E_PORT ?? 5291);

export default defineConfig({
  testDir: './e2e',
  testMatch: /[\\/]e2e[\\/]layout-[^\\/]*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: 'line',
  outputDir: process.env.E2E_OUT ?? 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      ...(process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {}),
      args: ['--use-mock-keychain'],
    },
  },
  webServer: {
    command: `./node_modules/.bin/vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { VITE_DEMO_MODE: 'true' },
    timeout: 120_000,
  },
});
