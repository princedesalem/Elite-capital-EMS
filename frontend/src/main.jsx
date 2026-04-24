import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/buttons.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then((reg) => {
      // Force update check each load (PWA mobile)
      try { reg.update() } catch {}
    }).catch(() => {})
  })
  // Auto-reload when a new SW takes control, and when it sends an update signal
  let reloaded = false
  const safeReload = () => {
    if (reloaded) return
    reloaded = true
    try { window.location.reload() } catch {}
  }
  navigator.serviceWorker.addEventListener('controllerchange', safeReload)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.type === 'SW_UPDATED') safeReload()
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
