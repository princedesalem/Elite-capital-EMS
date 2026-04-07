/**
 * Instance Axios configurée pour l'application EMS.
 *
 * - En développement : baseURL = '' (Vite proxy routes /api, /auth, /uploads, etc.)
 * - En production : VITE_API_URL ou même origine si non défini
 *
 * Intercepteurs automatiques :
 * - REQUEST : ajoute le header Authorization (token JWT depuis localStorage)
 * - RESPONSE : sur 401 hors /auth/login, nettoie les tokens et redirige vers /login
 */
import axios from 'axios'

// In development Vite proxies all backend paths, so relative URLs work without CORS.
// In production the build embeds VITE_API_URL (or falls back to empty = same origin).
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401 && !error.config.url?.includes('/auth/login')) {
      localStorage.removeItem('ec_token')
      localStorage.removeItem('access_token')
      localStorage.removeItem('session_id')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
