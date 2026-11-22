import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Os specs de layout (A/B) usam o modo demo e têm configuração própria.
  testIgnore: /[\\/]e2e[\\/]layout-[^\\/]*\.spec\.ts$/,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5176',
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 5176',
    url: 'http://127.0.0.1:5176',
    reuseExistingServer: !process.env.CI,
  },
});
