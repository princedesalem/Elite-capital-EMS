import React, { useEffect, useState, useRef } from 'react'
import {Link, NavLink, useLocation} from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
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

    // Clé de session (par matricule) pour éviter de re-déclencher le toast/son
    // après un simple refresh de page. Le toast se redéclenche :
    //  - à chaque nouvelle session (nouvelle ouverture de navigateur/tab),
    //  - dès qu'une notification d'ID supérieur à la dernière vue apparaît.
    const storageKey = `ems:lastSeenNotifId:${matricule}`
    const readLastSeen = () => {
      try { return Number(window.sessionStorage.getItem(storageKey) || 0) || 0 } catch { return 0 }
    }
    const writeLastSeen = (id) => {
      try { window.sessionStorage.setItem(storageKey, String(id)) } catch {}
    }

    // Affiche le toast et joue le son dans le MÊME tick synchrone pour qu'ils
    // apparaissent au même instant (pas de latence entre les deux).
    const triggerToastAndSound = (notif) => {
      setToast(notif)
      playNotifSound()
      if (document.hidden || !document.hasFocus()) {
        showSystemNotification(notif)
      }
      window.dispatchEvent(new CustomEvent('ems:newNotification'))
    }

    const loadCounter = async () => {
      try {
        const res = await api.get(`/api/notifications/compteur/${matricule}`)
        if (!active) return
        const newCount = Number(res?.data?.non_lues || 0)
        const prevCount = prevCountRef.current
        const firstLoadInSession = prevCount < 0
        const countIncreased = !firstLoadInSession && newCount > prevCount

        setNotificationCount(newCount)
        prevCountRef.current = newCount

        // Pas besoin d'examiner la liste si aucune non-lue, ou si ni 1er load,
        // ni nouvelle notif.
        if (newCount <= 0) return
        if (!firstLoadInSession && !countIncreased) return

        const listRes = await api.get(`/api/notifications/non-lues/${matricule}`)
        if (!active) return
        const list = Array.isArray(listRes?.data) ? listRes.data : []
        if (list.length === 0) return

        const latest = list[0]
        const latestId = Number(latest?.id_notification || 0)
        const lastSeen = readLastSeen()

        if (latestId > lastSeen) {
          triggerToastAndSound(latest)
          writeLastSeen(latestId)
        }
      } catch {
        if (!active) return
        setNotificationCount(0)
      }
    }

    loadCounter()
    const intervalId = window.setInterval(loadCounter, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [user?.matricule, user?.sub, location.pathname])

  if (location.pathname === '/login') return null

  return (
    <>
    <div className="nav">
      <div style={{display:'flex',alignItems:'center',gap:16,minWidth:0,flex:'1 1 auto'}}>
        {/* Mobile: leave space for hamburger (36px) rendered by RHLayout */}
        <div
          className="nav-brand"
          style={{fontSize:'1rem',fontWeight:'800',letterSpacing:'0.02em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}
        >
          <span className="hide-on-mobile">ELITE CAPITAL EMS</span>
          <span className="show-on-mobile">EMS</span>
        </div>
        {user && (
          <div className="hide-on-mobile" style={{display:'flex', alignItems:'center', gap:8}}>
            <NavLink to="/rh/home" style={topNavLinkStyle}>Accueil</NavLink>
            <NavLink to="/rh/dashboard" style={topNavLinkStyle}>Dashboard</NavLink>
            <NavLink to="/rh/organisation" style={topNavLinkStyle}>Organisation</NavLink>
            <NavLink to="/rh/documentation" style={topNavLinkStyle}>Documentation</NavLink>
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
                  border: '1px solid rgba(2,22,46,0.18)',
                  background: 'rgba(255,255,255,0.7)',
                  color: '#02162e',
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
                    background: '#c00000',
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
            <Link to="/rh/profile" style={{color:'#02162e',fontSize:'0.8rem',textDecoration:'none',display:'flex',alignItems:'center',gap:6,minWidth:0,fontWeight:600,minWidth:0}}>
              <AvatarCircle
                photoUrl={employee?.photo_url}
                letter={(() => { try { return String(user?.matricule || user?.sub || '?')[0].toUpperCase() } catch { return '?' } })()}
                size={26}
                borderWidth={1}
                borderColor='rgba(2,22,46,0.2)'
                textColor='#02162e'
                fallbackBackground='rgba(255,255,255,0.78)'
              />
              <span className="hide-on-mobile" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:180}}>
                {employee ? `${employee.prenom || ''} ${employee.nom || ''}`.trim() : (user?.matricule || user?.sub)} · <span style={{color:'rgba(2,22,46,0.78)'}}>{employee?.role || (user?.role && user.role !== 'Utilisateur' ? user.role : null) || 'Employé'}</span>
              </span>
            </Link>
            <button className="button hide-on-mobile" onClick={logout} style={{padding:'5px 12px',fontSize:'0.78rem'}}>Déconnexion</button>
            <button
              className="button show-on-mobile"
              onClick={logout}
              aria-label="Déconnexion"
              title="Déconnexion"
              style={{padding:'6px 8px',fontSize:'0.78rem',alignItems:'center',justifyContent:'center',minHeight:32}}
            >
              <LogOut size={16} />
            </button>
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
