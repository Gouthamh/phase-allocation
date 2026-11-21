import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';
const target = new URL(baseURL);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password ||
    target.pathname !== '/' || target.search || target.hash) {
  throw new Error('BASE_URL must be an HTTP(S) origin without credentials, a path, query, or fragment.');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: target.origin,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testMatch: '**/*.api.spec.ts' },
    { name: 'chromium', testMatch: '**/*.ui.spec.ts', use: devices['Desktop Chrome'] },
    { name: 'firefox', testMatch: '**/*.ui.spec.ts', use: devices['Desktop Firefox'] },
    { name: 'webkit', testMatch: '**/*.ui.spec.ts', use: devices['Desktop Safari'] },
  ],
});
