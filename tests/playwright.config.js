const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:8123' },
  webServer: {
    command: 'python -m http.server 8123 --bind 127.0.0.1',
    cwd: '..',
    url: 'http://127.0.0.1:8123/index.html',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
