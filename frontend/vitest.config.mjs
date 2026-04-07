import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
        minForks: 1,
      },
    },
    onConsoleLog(log) {
      // suppress React act() warning flood which clogs the output pipe
      if (log.includes('not wrapped in act') || log.includes('Future Flag Warning')) return false
    },
  },
})
