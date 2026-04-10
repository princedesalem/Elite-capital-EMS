import React, { useEffect, useState, useRef } from 'react'
import {Link, NavLink, useLocation} from 'react-router-dom'
import { Bell } from 'lucide-react'
import {useAuth} from '../contexts/AuthContext'
import api from '../services/api'
import AvatarCircle from './AvatarCircle'
import NotificationToast from './NotificationToast'

function playNotifSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    ;[[880, 0, 0.4], [1108, 0.15, 0.55]].forEach(([freq, start, end]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + end + 0.1)
    })
  } catch {}
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function showSystemNotification(notification) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    const title = String(notification?.titre || 'Nouvelle notification EMS')
    const body = String(notification?.message || '')
    const canUseSw = typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.ready
    if (canUseSw) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: `ems-${notification?.id_notification || Date.now()}`,
        })
      }).catch(() => {
        new Notification(title, { body, icon: '/logo.png' })
      })
      return
    }
    new Notification(title, { body, icon: '/logo.png' })
  } catch {}
}

const topNavLinkStyle = ({isActive}) => ({
  display:'inline-flex',
  alignItems:'center',
  height:'30px',
  padding:'0 12px',
  fontSize:'0.84rem',
  fontWeight: isActive ? 700 : 500,
  color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
  borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
  textDecoration:'none',
})

export default function Navbar(){
  const {user,logout} = useAuth()
  const location = useLocation()
  const [employee, setEmployee] = useState(null)
  const [notificationCount, setNotificationCount] = useState(0)
  const [toast, setToast] = useState(null)
  const prevCountRef = useRef(-1)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const matricule = Number(user?.matricule || user?.sub || 0)
    if (!matricule) return undefined
    if (typeof window === 'undefined') return undefined
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return undefined
    }

    let cancelled = false

    const setupPushSubscription = async () => {
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') return

      const keyResponse = await api.get('/api/notifications/push/vapid-public-key')
      if (!keyResponse?.data?.configured || !keyResponse?.data?.public_key) return

      const registration = await navigator.serviceWorker.ready
      if (cancelled) return

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(String(keyResponse.data.public_key)),
        })
      }

      if (cancelled || !subscription) return

      await api.post('/api/notifications/push/subscribe', {
        matricule,
        subscription: subscription.toJSON(),
      })
    }

    setupPushSubscription().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [user?.matricule, user?.sub])

  useEffect(() => {
    const matricule = Number(user?.matricule || user?.sub || 0)
    if (!matricule) {
      setEmployee(null)
      return
    }
    api.get(`/employees/${matricule}`).then((res) => {
      setEmployee(res.data || null)
    }).catch(() => {
      setEmployee(null)
    })
  }, [user?.matricule, user?.sub])

  useEffect(() => {
    const matricule = Number(user?.matricule || user?.sub || 0)
    if (!matricule) {
      setNotificationCount(0)
      return undefined
    }

    let active = true
    const loadCounter = () => {
      api.get(`/api/notifications/compteur/${matricule}`).then((res) => {
        if (!active) return
        const newCount = Number(res?.data?.non_lues || 0)
        if (prevCountRef.current >= 0 && newCount > prevCountRef.current) {
          window.dispatchEvent(new CustomEvent('ems:newNotification'))
          playNotifSound()
          api.get(`/api/notifications/non-lues/${matricule}`)
            .then(r => {
              if (!active) return
              if (Array.isArray(r.data) && r.data.length > 0) {
                const first = r.data[0]
                setToast(first)
                if (document.hidden || !document.hasFocus()) {
                  showSystemNotification(first)
                }
              }
            }).catch(() => {})
        }
        prevCountRef.current = newCount
        setNotificationCount(newCount)
      }).catch(() => {
        if (!active) return
        setNotificationCount(0)
      })
    }

    loadCounter()
    const intervalId = window.setInterval(loadCounter, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [user?.matricule, user?.sub, location.pathname])

  return (
    <>
    <div className="nav">
      <div style={{display:'flex',alignItems:'center',gap:16}}>
        <div style={{fontSize:'1rem',fontWeight:'800',letterSpacing:'0.02em'}}>ELITE CAPITAL EMS</div>
        {user && (
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <NavLink to="/rh/home" style={topNavLinkStyle}>Accueil</NavLink>
            <NavLink to="/rh/dashboard" style={topNavLinkStyle}>Dashboard</NavLink>
            <NavLink to="/rh/organisation" style={topNavLinkStyle}>Organisation</NavLink>
          </div>
        )}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {user ? (
          <>
            <Link
              to="/rh/notifications"
              aria-label="Notifications"
              title="Notifications"
              style={{
                position: 'relative',
                width: 34,
                height: 34,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none'
              }}
            >
              <Bell size={17} />
              {notificationCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 999,
                    background: '#f97316',
                    color: '#fff',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(255,255,255,0.7)'
                  }}
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </Link>
            <Link to="/rh/profile" style={{color:'rgba(255,255,255,0.75)',fontSize:'0.8rem',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>
              <AvatarCircle
                photoUrl={employee?.photo_url}
                letter={(() => { try { return String(user?.matricule || user?.sub || '?')[0].toUpperCase() } catch { return '?' } })()}
                size={26}
                borderWidth={1}
                borderColor='rgba(255,255,255,0.45)'
                textColor='rgba(255,255,255,0.95)'
                fallbackBackground='rgba(255,255,255,0.2)'
              />
              {employee ? `${employee.prenom || ''} ${employee.nom || ''}`.trim() : (user?.matricule || user?.sub)} · <span style={{opacity:0.8}}>{user?.role || 'Utilisateur'}</span>
            </Link>
            <button className="button" onClick={logout} style={{padding:'5px 12px',fontSize:'0.78rem'}}>Déconnexion</button>
          </>
        ) : (
          <Link to="/login" style={{color:'rgba(255,255,255,0.9)',textDecoration:'none',fontSize:'0.82rem'}}>Se connecter</Link>
        )}
      </div>
    </div>
    {toast && <NotificationToast notification={toast} onDismiss={() => setToast(null)} />}
    </>
  )
}
