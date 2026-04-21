const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '**/health.spec.js',
  timeout: 15_000,
  retries: 0,
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://host.docker.internal:5173',
    headless: true,
  },
})
