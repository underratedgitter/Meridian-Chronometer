import { defineConfig, devices } from '@playwright/test';

function resolveBaseURL() {
  const raw = process.env.BASE_URL;
  if (!raw) return 'http://localhost:8085';
  try {
    const u = new URL(raw);
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (u.protocol === 'http:' || u.protocol === 'https:')) {
      return raw;
    }
  } catch {}
  return 'http://localhost:8085';
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: resolveBaseURL(),
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node server.js',
    port: 8085,
    reuseExistingServer: !process.env.CI,
    timeout: 15000
  }
});
