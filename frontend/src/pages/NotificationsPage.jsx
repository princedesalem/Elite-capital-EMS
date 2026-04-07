import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Bell, BellOff, CheckCircle2, XCircle, AlertTriangle, Plane,
  Home, Briefcase, MessageSquare, Star, Clock, Check, Inbox,
  ExternalLink, Trash2, Mail, RefreshCw
} from 'lucide-react'

const TYPE_CONFIG = {
  VALIDATION: { color: '#10b981', bg: '#ecfdf5', label: 'Validation', Icon: CheckCircle2 },
  REFUS: { color: '#ef4444', bg: '#fff5f5', label: 'Refus', Icon: XCircle },
  ALERTE_CONGES: { color: '#f59e0b', bg: '#fffbeb', label: 'Alerte congés', Icon: AlertTriangle },
  RAPPEL_DEPART: { color: '#3b82f6', bg: '#eff6ff', label: 'Rappel départ', Icon: Plane },
  RAPPEL_RETOUR: { color: '#3b82f6', bg: '#eff6ff', label: 'Rappel retour', Icon: Home },
  DEMANDE_MISSION: { color: '#8b5cf6', bg: '#f5f3ff', label: 'Mission', Icon: Briefcase },
  DEMANDE_EXPLICATION: { color: '#d97706', bg: '#fff7ed', label: 'Explication', Icon: MessageSquare },
  EVALUATION: { color: '#6366f1', bg: '#eef2ff', label: 'Évaluation', Icon: Star },
  CLOTURE_REQUISE: { color: '#f43f5e', bg: '#fff1f2', label: 'Clôture', Icon: Clock },
  AUTRE: { color: '#6b7280', bg: '#f9fafb', label: 'Autre', Icon: Bell },
}

function getTypeCfg(typeKey) {
  const key = (typeKey || '').replace('TypeNotificationEnum.', '').toUpperCase()
  return TYPE_CONFIG[key] || TYPE_CONFIG.AUTRE
}

function formatDate(dateStr) {
  if (!dateStr) return 'Date inconnue'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Date inconnue'
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function NotifCard({ notif, onMarkRead, onDelete, navigate }) {
  const cfg = getTypeCfg(notif.type_notification)
  const { Icon } = cfg
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '4px 1fr', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8edf2', background: notif.lue ? '#fff' : cfg.bg, boxShadow: notif.lue ? 'none' : '0 2px 8px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
      <div style={{ background: notif.lue ? '#e2e8f0' : cfg.color }} />
      <div style={{ padding: '14px 16px', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: notif.lue ? '#f1f5f9' : cfg.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={15} color={notif.lue ? '#94a3b8' : cfg.color} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{notif.titre || cfg.label}</span>
                {!notif.lue && <span style={{ width: 7, height: 7, borderRadius: 999, background: cfg.color, display: 'inline-block', flexShrink: 0 }} />}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: 1 }}>
                {cfg.label} · {formatDate(notif.date_creation)}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {!notif.lue && (
              <button
                onClick={() => onMarkRead(notif.id_notification)}
                title="Marquer comme lu"
                style={{ width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <Check size={13} />
              </button>
            )}
            <button
              onClick={() => onDelete(notif.id_notification)}
              title="Supprimer"
              style={{ width: 28, height: 28, border: '1px solid #fee2e2', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.55, paddingLeft: 40 }}>
          {notif.message}
        </p>
        {notif.id_operation && (
          <div style={{ paddingLeft: 40 }}>
            <button
              onClick={() => navigate('/rh/operations', { state: { operationId: notif.id_operation } })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px solid ${cfg.color}33`, background: cfg.color + '0d', color: cfg.color, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              <ExternalLink size={11} /> Voir l'opération #{notif.id_operation}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const matricule = Number(user?.matricule || user?.sub || 0)
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [badgeCount, setBadgeCount] = useState(0)
  const [filter, setFilter] = useState('non-lues')

  useEffect(() => { if (matricule) load() }, [matricule, filter])

  async function load() {
    setLoading(true)
    try {
      const [notifs, badge] = await Promise.all([
        api.get(`/api/notifications/${filter === 'non-lues' ? 'non-lues' : 'toutes'}/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/notifications/compteur/${matricule}`).catch(() => ({ data: { non_lues: 0 } }))
      ])
      setNotifications(Array.isArray(notifs.data) ? notifs.data : [])
      setBadgeCount(Number(badge?.data?.non_lues || 0))
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id) {
    await api.put(`/api/notifications/${id}/marquer-lue`).catch(() => null)
    load()
  }

  async function markAllRead() {
    await api.put(`/api/notifications/marquer-toutes-lues/${matricule}`).catch(() => null)
    load()
  }

  async function deleteNotif(id) {
    await api.delete(`/api/notifications/${id}`).catch(() => null)
    load()
  }

  const typeSummary = notifications.reduce((acc, n) => {
    const k = (n.type_notification || 'AUTRE').replace('TypeNotificationEnum.', '').toUpperCase()
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={20} color="#ce2b2b" /> Centre de notifications
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            {badgeCount > 0 ? `${badgeCount} notification(s) non lue(s)` : 'Tout est à jour'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            style={{ width: 34, height: 34, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
          >
            <RefreshCw size={14} />
          </button>
          {badgeCount > 0 && (
            <button
              onClick={markAllRead}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Check size={13} /> Tout marquer lu
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f8fafc', borderRadius: 10, marginBottom: 20, width: 'fit-content' }}>
        {[['non-lues', `Non lues${badgeCount > 0 ? ` (${badgeCount})` : ''}`], ['toutes', 'Toutes']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: filter === key ? '#fff' : 'transparent', color: filter === key ? '#0f172a' : '#64748b', fontWeight: filter === key ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer', boxShadow: filter === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
          >
            {key === 'non-lues' ? <Inbox size={13} /> : <Mail size={13} />} {label}
          </button>
        ))}
      </div>

      {/* Type summary badges */}
      {filter === 'toutes' && notifications.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(typeSummary).slice(0, 6).map(([type, cnt]) => {
            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.AUTRE
            return (
              <div key={type} style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
                {cfg.label} · {cnt}
              </div>
            )
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: '0.85rem' }}>Chargement...</div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BellOff size={28} color="#94a3b8" />
          </div>
          <p style={{ margin: 0, fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>
            {filter === 'non-lues' ? 'Aucune notification non lue' : 'Aucune notification'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            {filter === 'non-lues' ? 'Tout est à jour !' : "Vous n'avez reçu aucune notification."}
          </p>
        </div>
      )}

      {/* Notification cards */}
      {!loading && notifications.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {notifications.map(notif => (
            <NotifCard
              key={notif.id_notification}
              notif={notif}
              onMarkRead={markRead}
              onDelete={deleteNotif}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
