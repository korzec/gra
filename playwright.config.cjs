const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'nocny-kurs-two-browser.spec.cjs',
  timeout: 60000,
  expect: { timeout: 20000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:8765',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/nocny-kurs/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
