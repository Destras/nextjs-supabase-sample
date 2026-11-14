import { loadEnvConfig } from '@next/env'
import { defineConfig, devices } from '@playwright/test'

// Load .env.local / .env with the same precedence Next.js uses for the app,
// so the E2E harness sees the same NEXT_PUBLIC_SUPABASE_* values without a
// new dependency (dotenv) or a second source of truth.
loadEnvConfig(process.cwd())

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // No `webServer` block by design: the dev server is started manually, the
  // same convention the `playwright-uat` skill already uses.
  projects: [
    {
      name: 'preflight',
      testMatch: /preflight\.setup\.ts/,
    },
    {
      name: 'auth',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['preflight'],
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth'],
      testMatch: /.*\.spec\.ts/,
    },
  ],
})
