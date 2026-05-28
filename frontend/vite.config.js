import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Read version from package.json (available in Docker and locally)
const appVersion = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
    return `v${pkg.version}`
  } catch {
    return '?'
  }
})()

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://localhost:8000'

  // All backend route prefixes — Vite proxies these server-side so the browser
  // never makes a cross-origin request and CORS is not an issue in development.
  const backendPrefixes = [
    '/auth', '/api', '/dashboard', '/employees',
    '/roles', '/docs', '/openapi.json', '/redoc', '/uploads',
  ]
  // bypass: if the browser is requesting a full HTML page (navigation), serve the SPA
  // instead of proxying to the backend (which would return JSON/422 for unknown paths).
  const bypassFn = (req) => {
    const accept = req.headers.accept || ''
    if (accept.includes('text/html')) return '/index.html'
    return undefined
  }
  const proxy = {}
  for (const prefix of backendPrefixes) {
    proxy[prefix] = { target: apiTarget, changeOrigin: true, secure: false, bypass: bypassFn }
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    server: {
      host: true,
      port: 5173,
      watch: { usePolling: true, interval: 300 },
      proxy,
    },
  }
})
