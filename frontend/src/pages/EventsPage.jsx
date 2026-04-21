import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { CalendarDays, Plus, CheckCircle, Clock, FileText, X, MapPin, Users, Edit3, Trash2 } from 'lucide-react'
import '../styles/Operations.css'
import { confirmDialog } from '../components/ui/bridge'

const STATUTS_EVENT = [
  { value: 'brouillon', label: 'Brouillon', color: '#64748b', bg: '#f8fafc' },
  { value: 'en_attente', label: 'En attente', color: '#94a3b8', bg: '#f8fafc' },
  { value: 'approuve', label: 'Approuvé', color: '#021630', bg: '#f8fafc' },
  { value: 'refuse', label: 'Refusé', color: '#ce2b2b', bg: '#fef2f2' },
  { value: 'termine', label: 'Terminé', color: '#475569', bg: '#f1f5f9' },
]

const TYPES_EVENT = ['Réunion', 'Formation', 'Conférence', 'Ceremonie', 'Team Building', 'Séminaire', 'Autre']

const emptyForm = {
  titre: '', type: 'Réunion', description: '', lieu: '',
  date_debut: '', date_fin: '', organisateur: '', capacite: '',
  statut: 'brouillon',
}

export default function EventsPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterType, setFilterType] = useState('tous')
  const [searchQ, setSearchQ] = useState('')

  const role = String(user?.role || '').toUpperCase()
  const isEventManager = ['RH', 'PCA', 'ADMIN', 'AG'].includes(role)
  const isReadOnlyEvents = !isEventManager

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const res = await api.get('/api/events')
      setEvents(Array.isArray(res.data) ? res.data : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    if (!isEventManager) return
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/api/events/${editingId}`, { ...form })
      } else {
        await api.post('/api/events', { ...form, created_by: user?.matricule || null })
      }
      await loadEvents()
    } catch { /* silent */ }
    resetForm()
  }

  const deleteEvent = async (id) => {
    if (!isEventManager) return
    const ok = await confirmDialog({ title: 'Supprimer l’événement', message: 'Êtes-vous sûr de vouloir supprimer cet événement ?', variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    try {
      await api.delete(`/api/events/${id}`)
      await loadEvents()
    } catch { /* silent */ }
  }

  const editEvent = (ev) => {
    if (!isEventManager) return
    setForm({ titre: ev.titre, type: ev.type || 'Réunion', description: ev.description || '', lieu: ev.lieu || '', date_debut: ev.date_debut || '', date_fin: ev.date_fin || '', organisateur: ev.organisateur || '', capacite: ev.capacite || '', statut: ev.statut })
    setEditingId(ev.id); setShowForm(true)
  }

  const changeStatut = async (id, statut) => {
    if (!isEventManager) return
    try {
      await api.patch(`/api/events/${id}/statut`, { statut })
      await loadEvents()
    } catch { /* silent */ }
  }

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false) }

  const getStatut = (v) => STATUTS_EVENT.find(s => s.value === v) || STATUTS_EVENT[0]

  const filtered = events.filter(ev => {
    if (isReadOnlyEvents && !['approuve', 'termine'].includes(String(ev.statut || ''))) return false
    if (filterStatut !== 'tous' && ev.statut !== filterStatut) return false
    if (filterType !== 'tous' && ev.type !== filterType) return false
    if (searchQ && !ev.titre.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  })

  const counts = {
    brouillon: events.filter(e => e.statut === 'brouillon').length,
    en_attente: events.filter(e => e.statut === 'en_attente').length,
    approuve: events.filter(e => e.statut === 'approuve').length,
  }

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #021630 0%, #112033 100%)', color: 'white', padding: '20px 24px', borderRadius: '10px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={22} /> {"Événements"}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>{"Événements à venir et passés"}</p>
          </div>
          {isEventManager && (
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> {"Créer un événement"}
            </button>
          )}
        </div>
      </div>

      {/* Status summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: "Brouillon", count: counts.brouillon, color: '#64748b', bg: '#f8fafc' },
          { label: "En Attente", count: counts.en_attente, color: '#94a3b8', bg: '#f8fafc' },
          { label: "Approuvé", count: counts.approuve, color: '#021630', bg: '#f8fafc' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#021630', fontWeight: 700 }}>{editingId ? "Modifier l'événement" : "Nouvel événement"}</h3>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>{"Titre"} <span style={{ color: '#ce2b2b' }}>*</span></label>
                <input className="form-control" value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} required placeholder="Titre de l'événement" />
              </div>
              <div className="form-group">
                <label>{"Type"}</label>
                <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {TYPES_EVENT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>{"Description"}</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{"Date de début"} <span style={{ color: '#ce2b2b' }}>*</span></label>
                <input className="form-control" type="datetime-local" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{"Date de fin"}</label>
                <input className="form-control" type="datetime-local" value={form.date_fin} onChange={e => setForm({ ...form, date_fin: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{"Localisation"}</label>
                <input className="form-control" value={form.lieu} onChange={e => setForm({ ...form, lieu: e.target.value })} placeholder="Ex: Salle de conférence A" />
              </div>
              <div className="form-group">
                <label>{"Organisateur"}</label>
                <input className="form-control" value={form.organisateur} onChange={e => setForm({ ...form, organisateur: e.target.value })} placeholder="Nom de l'organisateur" />
              </div>
              <div className="form-group">
                <label>{"Capacité"}</label>
                <input className="form-control" type="number" min="1" value={form.capacite} onChange={e => setForm({ ...form, capacite: e.target.value })} placeholder="Nb personnes" />
              </div>
            </div>
            {isEventManager && (
              <div className="form-group">
                <label>{"Statut"}</label>
                <select className="form-control" value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}>
                  {STATUTS_EVENT.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">{editingId ? "Enregistrer" : "Créer"}</button>
              <button type="button" className="btn" onClick={resetForm} style={{ background: 'var(--bg)', color: '#475569' }}>{"Annuler"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.85rem', minWidth: 200 }} placeholder="Rechercher..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        <select style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem', background: 'var(--card)' }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
          <option value="tous">Tous les statuts</option>
          {STATUTS_EVENT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem', background: 'var(--card)' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="tous">Tous les types</option>
          {TYPES_EVENT.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>{filtered.length} événement(s)</span>
      </div>

      {/* Events list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
          <CalendarDays size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0 }}>{"Aucun événement"}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map(ev => {
            const st = getStatut(ev.statut)
            return (
              <div key={ev.id} style={{ background: 'var(--card)', border: `1px solid ${st.color}33`, borderTop: `4px solid ${st.color}`, borderRadius: 10, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', background: 'var(--bg)', padding: '2px 7px', borderRadius: 20 }}>{ev.type}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: st.color, background: st.bg, padding: '2px 7px', borderRadius: 20 }}>{st.icon} {st.label}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)', fontWeight: 700 }}>{ev.titre}</h3>
                  </div>
                  {isEventManager && (
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => editEvent(ev)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#475569' }}><Edit3 size={12} /></button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#ce2b2b' }}><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {ev.description && <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.4 }}>{ev.description}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ev.date_debut && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#64748b' }}>
                      <Clock size={11} /> {new Date(ev.date_debut).toLocaleString('fr-FR')} {ev.date_fin && `→ ${new Date(ev.date_fin).toLocaleString('fr-FR')}`}
                    </div>
                  )}
                  {ev.lieu && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#64748b' }}>
                      <MapPin size={11} /> {ev.lieu}
                    </div>
                  )}
                  {ev.organisateur && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#64748b' }}>
                      <Users size={11} /> {ev.organisateur} {ev.capacite && `• ${ev.capacite} places`}
                    </div>
                  )}
                </div>
                {isEventManager && ev.statut === 'en_attente' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => changeStatut(ev.id, 'approuve')} className="btn btn-success" style={{ flex: 1, fontSize: '0.78rem', padding: '5px 8px' }}>Approuver</button>
                    <button onClick={() => changeStatut(ev.id, 'refuse')} className="btn btn-danger" style={{ flex: 1, fontSize: '0.78rem', padding: '5px 8px' }}>Refuser</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
