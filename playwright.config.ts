import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3005',
    timezoneId: 'Asia/Singapore',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx next start -p 3005',
    url: 'http://localhost:3005/login',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      RP_ORIGIN: 'http://localhost:3005',
    },
  },
});

