import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/report', open: 'never' }],
  ],
  use: {
    baseURL: 'https://ask.permission.ai',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1366, height: 900 },
    ignoreHTTPSErrors: true,
  },
});
