import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://localhost:8000'

  // All backend route prefixes — Vite proxies these server-side so the browser
  // never makes a cross-origin request and CORS is not an issue in development.
  const backendPrefixes = [
    '/auth', '/api', '/dashboard', '/employees',
    '/leaves', '/roles', '/docs', '/openapi.json', '/redoc', '/uploads',
  ]
  const proxy = {}
  for (const prefix of backendPrefixes) {
    proxy[prefix] = { target: apiTarget, changeOrigin: true, secure: false }
  }

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      watch: { usePolling: true, interval: 300 },
      proxy,
    },
  }
})
