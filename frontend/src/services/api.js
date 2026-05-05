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
import { emit, DATA_CHANGED } from '../utils/eventBus'

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

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

// URLs dont les mutations ne doivent pas déclencher un rechargement des pages.
// Ex: marquer-vu est un POST de traçage (audit) qui ne change pas les données affichées.
const SILENT_URL_PATTERNS = [/\/marquer-vu\//]

api.interceptors.response.use(
  response => {
    try {
      const method = String(response?.config?.method || '').toLowerCase()
      const url = response?.config?.url || ''
      const isSilent = SILENT_URL_PATTERNS.some(p => p.test(url))
      if (MUTATING_METHODS.has(method) && !isSilent) {
        emit(DATA_CHANGED, {
          url,
          method,
          status: response?.status,
        })
      }
    } catch {
      // ne jamais bloquer une réponse API pour un événement
    }
    return response
  },
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
