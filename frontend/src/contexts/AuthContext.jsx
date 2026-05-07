import React, {createContext, useContext, useEffect, useRef, useState} from 'react'
import api from '../services/api'
import jwt_decode from 'jwt-decode'
import {useNavigate} from 'react-router-dom'

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const ACTIVITY_EVENTS = ['mousemove','mousedown','keydown','touchstart','scroll','click']

const AuthContext = createContext()

/**
 * Abonne le navigateur aux notifications push via l'API Web Push.
 * Récupère la clé publique VAPID depuis le backend, demande la permission
 * à l'utilisateur, puis enregistre le endpoint de push auprès du serveur.
 *
 * @param {number|string} matricule - Matricule de l'utilisateur connecté.
 */
async function subscribeToPush(matricule) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    // Récupère la clé publique VAPID
    const { data } = await api.get('/api/notifications/push/vapid-public-key')
    if (!data?.configured || !data?.public_key) return

    const registration = await navigator.serviceWorker.ready

    // Convertit la clé base64url en Uint8Array pour applicationServerKey
    const b64 = (data.public_key + '===').slice(0, data.public_key.length + (4 - data.public_key.length % 4) % 4)
    const raw = Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

    // Abonne ou récupère l'abonnement existant
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: raw,
    })

    // Envoie le endpoint + clés au backend
    await api.post('/api/notifications/push/subscribe', {
      matricule: Number(matricule),
      subscription: subscription.toJSON(),
    })
  } catch {
    // Erreur silencieuse — la push n'est pas critique
  }
}

export function AuthProvider({children}){
  const [user,setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState(null)
  const navigate = useNavigate()
  const inactivityTimer = useRef(null)
  const lastActivityRef = useRef(Date.now())

  // ── Inactivity + veille auto-logout ─────────────────────────────
  useEffect(() => {
    if (!user) return
    const reset = () => {
      lastActivityRef.current = Date.now()
      clearTimeout(inactivityTimer.current)
      inactivityTimer.current = setTimeout(() => {
        logout()
      }, INACTIVITY_TIMEOUT)
    }
    reset()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Détection du réveil machine : quand la page redevient visible,
    // vérifier si le délai d'inactivité a été dépassé pendant la veille
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT) {
          logout()
        } else {
          reset()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(inactivityTimer.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(()=>{
    // Si sessionStorage n'a pas le flag, c'est une nouvelle session navigateur
    // (machine redémarrée ou navigateur fermé) → forcer la re-connexion
    if (!sessionStorage.getItem('session_alive')) {
      localStorage.removeItem('ec_token')
      localStorage.removeItem('access_token')
      localStorage.removeItem('session_id')
      localStorage.removeItem('session_date')
      setLoading(false)
      return
    }
    const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
    if(token){
      try{
        const data = jwt_decode(token)
        setUser(data)
        // Réabonner aux notifications push si déjà connecté
        subscribeToPush(data.matricule || data.sub)

        // Créer/restaurer la session quotidienne
        const storedSessionId = localStorage.getItem('session_id')
        const storedSessionDate = localStorage.getItem('session_date')
        const todayStr = new Date().toISOString().slice(0, 10)
        if (storedSessionId && storedSessionDate === todayStr) {
          // Session d'aujourd'hui déjà enregistrée — restaurer l'ID
          setSessionId(parseInt(storedSessionId))
        } else {
          // Nouvelle journée ou pas de session → créer une session quotidienne
          const mat = data.matricule || data.sub
          if (mat) {
            api.post('/employees/sessions/login', { matricule: parseInt(mat) })
              .then(res => {
                setSessionId(res.data.id_session)
                localStorage.setItem('session_id', res.data.id_session)
                localStorage.setItem('session_date', todayStr)
              }).catch(() => {})
          }
        }
      }catch(e){localStorage.removeItem('ec_token'); localStorage.removeItem('access_token')}
    }
    // Auth check terminé — autoriser les ProtectedRoute à décider
    setLoading(false)
  },[])

  async function login({matricule,password,mfaCode}){
    // FastAPI expects form data with proper Content-Type header
    const formData = new FormData()
    formData.append('matricule', matricule)
    formData.append('password', password)
    if(mfaCode) formData.append('mfaCode', mfaCode)
    const res = await api.post('/auth/login', formData, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    }).catch(e=>{throw e})
    const {access_token}=res.data
    localStorage.setItem('ec_token',access_token)
    localStorage.setItem('access_token',access_token)
    sessionStorage.setItem('session_alive','1')
    const data = jwt_decode(access_token)
    setUser(data)

    // Abonner aux notifications push après connexion
    subscribeToPush(data.matricule || data.sub)

    // Record session login
    try {
      const sessionRes = await api.post('/employees/sessions/login', { matricule: parseInt(matricule) })
      const { id_session } = sessionRes.data
      setSessionId(id_session)
      localStorage.setItem('session_id', id_session)
      localStorage.setItem('session_date', new Date().toISOString().slice(0, 10))
    } catch (err) {
      console.error('Erreur enregistrement session:', err)
    }

    return data
  }

  async function loginWithToken(token){
    // token reçu via lien email
    localStorage.setItem('ec_token',token)
    localStorage.setItem('access_token',token)
    sessionStorage.setItem('session_alive','1')
    const data = jwt_decode(token)
    setUser(data)

    // Record session login
    try {
      const sessionRes = await api.post('/employees/sessions/login', { matricule: parseInt(data.matricule) })
      const { id_session } = sessionRes.data
      setSessionId(id_session)
      localStorage.setItem('session_id', id_session)
      localStorage.setItem('session_date', new Date().toISOString().slice(0, 10))
    } catch (err) {
      console.error('Erreur enregistrement session:', err)
    }

    return data
  }

  async function logout(){
    // Record session logout
    const id_session = sessionId || localStorage.getItem('session_id')
    if (id_session) {
      try {
        await api.put(`/employees/sessions/${id_session}/logout`)
      } catch (err) {
        console.error('Erreur enregistrement déconnexion:', err)
      }
    }

    localStorage.removeItem('ec_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('session_id')
    localStorage.removeItem('session_date')
    sessionStorage.removeItem('session_alive')
    setUser(null)
    setSessionId(null)
    navigate('/login')
  }

  function silentLogout(){
    localStorage.removeItem('ec_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('session_id')
    localStorage.removeItem('session_date')
    sessionStorage.removeItem('session_alive')
    setUser(null)
    setSessionId(null)
  }

  return (
    <AuthContext.Provider value={{user,loading,login,loginWithToken,logout,silentLogout,sessionId}}>{children}</AuthContext.Provider>
  )
}

export function useAuth(){return useContext(AuthContext)}
