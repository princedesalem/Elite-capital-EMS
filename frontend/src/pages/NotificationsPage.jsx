import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Bell, Inbox, Mail, XCircle, Loader, Check } from 'lucide-react'

export default function NotificationsPage() {
  const { user } = useAuth()
  const matricule = Number(user?.matricule || user?.sub || 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState([])
  const [badgeCount, setBadgeCount] = useState(0)
  const [filter, setFilter] = useState('non-lues')

  useEffect(() => {
    if (!matricule) return
    loadNotifications()
  }, [matricule])

  async function loadNotifications() {
    setLoading(true)
    setError('')
    try {
      const [notifs, badge] = await Promise.all([
        api.get(`/api/notifications/${filter === 'non-lues' ? 'non-lues' : 'toutes'}/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/notifications/compteur/${matricule}`).catch(() => ({ data: { non_lues: 0 } }))
      ])
      setNotifications(Array.isArray(notifs.data) ? notifs.data : [])
      setBadgeCount(Number(badge.data?.non_lues || 0))
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  async function marquerLue(id) {
    try {
      await api.put(`/api/notifications/${id}/marquer-lue`).catch(() => null)
      loadNotifications()
    } catch (e) {
      console.error('Erreur:', e)
    }
  }

  async function marquerToutesLues() {
    try {
      await api.put(`/api/notifications/marquer-toutes-lues/${matricule}`).catch(() => null)
      loadNotifications()
    } catch (e) {
      console.error('Erreur:', e)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '900px', marginTop: '20px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{display:'flex',alignItems:'center',gap:8}}><Bell size={20}/> Notifications ({badgeCount})</h1>
          {badgeCount > 0 && (
            <button
              className="button"
              onClick={marquerToutesLues}
              style={{ background: '#27ae60', padding: '8px 16px', display:'inline-flex', alignItems:'center', gap:6 }}
            >
              <Check size={13}/> Tout marquer comme lu
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            className={`button ${filter === 'non-lues' ? 'active' : ''}`}
            onClick={() => { setFilter('non-lues'); loadNotifications(); }}
            style={{
              background: filter === 'non-lues' ? '#3498db' : '#ecf0f1',
              color: filter === 'non-lues' ? 'white' : '#333',
              display:'inline-flex', alignItems:'center', gap:6
            }}
          >
            <Inbox size={13}/> Non-lues ({badgeCount})
          </button>
          <button
            className={`button ${filter === 'toutes' ? 'active' : ''}`}
            onClick={() => { setFilter('toutes'); loadNotifications(); }}
            style={{
              background: filter === 'toutes' ? '#3498db' : '#ecf0f1',
              color: filter === 'toutes' ? 'white' : '#333',
              display:'inline-flex', alignItems:'center', gap:6
            }}
          >
            <Mail size={13}/> Toutes
          </button>
        </div>

        {error && <div style={{ color: '#e74c3c', padding: '12px', background: '#fadbd8', borderRadius: '6px', marginBottom: '20px', display:'flex', alignItems:'center', gap:6 }}><XCircle size={14}/> {error}</div>}
        {loading && <p style={{display:'flex',alignItems:'center',gap:6}}><Loader size={14}/> Chargement des notifications...</p>}

        {!loading && notifications.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
            <p style={{display:'flex',alignItems:'center',gap:6}}><Check size={14}/> Aucune notification</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div style={{ display: 'grid', gap: '15px' }}>
            {notifications.map((notif) => (
              <div
                key={notif.id_notification}
                style={{
                  padding: '15px',
                  background: notif.lue ? '#f8f9fa' : '#fff3cd',
                  border: `2px solid ${notif.lue ? '#ddd' : '#ffc107'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>
                    {notif.type || 'Notification'} {notif.lue ? 'Lu' : 'Non lu'}
                  </h4>
                  <p style={{ margin: '0 0 8px 0', color: '#555' }}>
                    {notif.contenu || notif.message || 'N/A'}
                  </p>
                  <p style={{ margin: '0', fontSize: '0.85em', color: '#888' }}>
                    {notif.date_notification ? new Date(notif.date_notification).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                </div>
                {!notif.lue && (
                  <button
                    className="button"
                    onClick={() => marquerLue(notif.id_notification)}
                    style={{ background: '#3498db', padding: '6px 12px', marginLeft: '10px', whiteSpace: 'nowrap' }}
                  >
                    Marquer lu
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
