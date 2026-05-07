import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { CalendarDays, Plus, Clock, X, MapPin, Users, Edit3, Trash2, ChevronDown, ChevronUp, UserCheck, UserX, Search, UserPlus } from 'lucide-react'
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
  const [inscriptionsOpen, setInscriptionsOpen] = useState({})
  const [inscriptionsData, setInscriptionsData] = useState({})
  const [inscriptionsLoading, setInscriptionsLoading] = useState({})
  const [addSearch, setAddSearch] = useState({})
  const [addResults, setAddResults] = useState({})

  // Modal participants (événement existant)
  const [modalEvId, setModalEvId] = useState(null)
  const [modalAudSelEnt, setModalAudSelEnt] = useState(null)
  const [modalAudSelDir, setModalAudSelDir] = useState(null)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSearchResults, setModalSearchResults] = useState([])

  // Participants du formulaire de création
  const [formParticipants, setFormParticipants] = useState([])  // [{matricule, prenom, nom}]
  const [formPSearch, setFormPSearch] = useState('')
  const [formPResults, setFormPResults] = useState([])
  const [audienceEntites, setAudienceEntites] = useState([])
  const [audienceDirs, setAudienceDirs] = useState([])
  const [audienceDepts, setAudienceDepts] = useState([])
  const [audienceAllEmps, setAudienceAllEmps] = useState([])
  const [formAudSelEnt, setFormAudSelEnt] = useState(null)  // {value, label}
  const [formAudSelDir, setFormAudSelDir] = useState(null)  // {value, label, id_entite}

  const role = String(user?.role || '').toUpperCase()
  const isEventManager = ['RH', 'PCA', 'ADMIN', 'AG'].includes(role)
  const isReadOnlyEvents = !isEventManager

  useEffect(() => {
    loadEvents()
  }, [])

  // Charger entités + directions + depts + tous les employés (partagé form + modal)
  useEffect(() => {
    if ((showForm && !editingId || modalEvId) && audienceAllEmps.length === 0) {
      api.get('/employees/autocomplete/entites').then(r => setAudienceEntites(Array.isArray(r.data) ? r.data : []))
      api.get('/employees/autocomplete/directions').then(r => setAudienceDirs(Array.isArray(r.data) ? r.data : []))
      api.get('/employees/autocomplete/departements').then(r => setAudienceDepts(Array.isArray(r.data) ? r.data : []))
      api.get('/employees/').then(r => setAudienceAllEmps(Array.isArray(r.data) ? r.data : []))
    }
  }, [showForm, editingId, modalEvId])

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
        const res = await api.post('/api/events', { ...form, created_by: user?.matricule || null })
        if (formParticipants.length > 0 && res.data?.id) {
          await api.post(`/api/events/${res.data.id}/inscriptions`, {
            matricules: formParticipants.map(p => p.matricule)
          })
        }
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

  const resetForm = () => {
    setForm(emptyForm); setEditingId(null); setShowForm(false)
    setFormParticipants([]); setFormPSearch(''); setFormPResults([])
    setFormAudSelEnt(null); setFormAudSelDir(null)
  }

  const selectAudience = (filterFn) => {
    const newList = audienceAllEmps
      .filter(filterFn)
      .map(e => ({ matricule: e.matricule, prenom: e.prenom || '', nom: e.nom || '' }))
    setFormParticipants(newList)
  }

  const toggleInscriptions = async (evId) => {
    const isOpen = inscriptionsOpen[evId]
    setInscriptionsOpen(p => ({ ...p, [evId]: !isOpen }))
    if (!isOpen) {
      setInscriptionsLoading(p => ({ ...p, [evId]: true }))
      try {
        const r = await api.get(`/api/events/${evId}/inscriptions`)
        setInscriptionsData(p => ({ ...p, [evId]: Array.isArray(r.data) ? r.data : [] }))
      } catch {
        setInscriptionsData(p => ({ ...p, [evId]: [] }))
      } finally {
        setInscriptionsLoading(p => ({ ...p, [evId]: false }))
      }
    }
  }

  const refreshInscriptions = async (evId) => {
    try {
      const r = await api.get(`/api/events/${evId}/inscriptions`)
      setInscriptionsData(p => ({ ...p, [evId]: Array.isArray(r.data) ? r.data : [] }))
    } catch {}
  }

  const markPresence = async (evId, matricule, statut) => {
    try {
      await api.patch(`/api/events/${evId}/inscriptions/${matricule}/presence`, { statut })
      setInscriptionsData(p => ({
        ...p,
        [evId]: (p[evId] || []).map(i => i.matricule === matricule ? { ...i, statut } : i),
      }))
    } catch { /* silent */ }
  }

  const addParticipant = async (evId, matricule) => {
    try {
      await api.post(`/api/events/${evId}/inscriptions`, { matricules: [matricule] })
      await refreshInscriptions(evId)
      setAddSearch(p => ({ ...p, [evId]: '' }))
      setAddResults(p => ({ ...p, [evId]: [] }))
    } catch { /* silent */ }
  }

  const removeParticipant = async (evId, matricule) => {
    try {
      await api.delete(`/api/events/${evId}/inscriptions/${matricule}`)
      setInscriptionsData(p => ({
        ...p,
        [evId]: (p[evId] || []).filter(i => i.matricule !== matricule),
      }))
    } catch { /* silent */ }
  }

  const markAll = async (evId, statut) => {
    const list = inscriptionsData[evId] || []
    await Promise.all(list.map(i => markPresence(evId, i.matricule, statut)))
  }

  const openParticipantsModal = async (ev) => {
    setModalEvId(ev.id)
    setModalAudSelEnt(null); setModalAudSelDir(null)
    setModalSearch(''); setModalSearchResults([])
    // Charger les inscriptions si pas encore chargées
    setInscriptionsLoading(p => ({ ...p, [ev.id]: true }))
    try {
      const r = await api.get(`/api/events/${ev.id}/inscriptions`)
      setInscriptionsData(p => ({ ...p, [ev.id]: Array.isArray(r.data) ? r.data : [] }))
    } catch {
      setInscriptionsData(p => ({ ...p, [ev.id]: [] }))
    } finally {
      setInscriptionsLoading(p => ({ ...p, [ev.id]: false }))
    }
  }

  const closeModal = () => {
    setModalEvId(null)
    setModalAudSelEnt(null); setModalAudSelDir(null)
    setModalSearch(''); setModalSearchResults([])
  }

  // Inscrire tous les employés d'une audience (filtre) en ignorant les déjà inscrits
  const addAudienceToEvent = async (evId, filterFn) => {
    const already = new Set((inscriptionsData[evId] || []).map(i => String(i.matricule)))
    const toAdd = audienceAllEmps.filter(filterFn).map(e => e.matricule).filter(m => !already.has(String(m)))
    if (toAdd.length === 0) return
    try {
      await api.post(`/api/events/${evId}/inscriptions`, { matricules: toAdd })
      await refreshInscriptions(evId)
    } catch { /* silent */ }
  }

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

            {/* ── Section Participants (création uniquement) ── */}
            {!editingId && isEventManager && (
              <div style={{ marginTop: 8, border: '1px solid #d0dff0', borderRadius: 8, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ background: '#eef4fb', borderBottom: '1px solid #d0dff0', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={13} color="#021630" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#021630' }}>Participants</span>
                  {formParticipants.length > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#021630', color: '#fff', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px' }}>
                      {formParticipants.length} sélectionné(s)
                    </span>
                  )}
                </div>

                <div style={{ padding: '10px 12px' }}>
                  {/* ── Niveau 1 : Entités ── */}
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                    {formAudSelDir ? `${formAudSelEnt?.label} › ${formAudSelDir.label}` : formAudSelEnt ? formAudSelEnt.label : 'Audience'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {/* Bouton "Tout" — toujours visible */}
                    <button type="button"
                      onClick={() => { selectAudience(() => true); setFormAudSelEnt(null); setFormAudSelDir(null) }}
                      style={{ padding: '4px 11px', borderRadius: 99, border: '1.5px solid #021630', background: !formAudSelEnt ? '#021630' : '#f8fafc', color: !formAudSelEnt ? '#fff' : '#021630', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      Tout
                    </button>
                    {/* Boutons entités */}
                    {!formAudSelEnt && audienceEntites.map(ent => (
                      <button key={ent.value} type="button"
                        onClick={() => { setFormAudSelEnt(ent); setFormAudSelDir(null) }}
                        style={{ padding: '4px 11px', borderRadius: 99, border: '1.5px solid #d0dff0', background: '#f8fafc', color: '#021630', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                        {ent.label}
                      </button>
                    ))}

                    {/* ── Niveau 2 : Directions de l'entité sélectionnée ── */}
                    {formAudSelEnt && !formAudSelDir && (() => {
                      const dirs = audienceDirs.filter(d => d.id_entite === formAudSelEnt.value)
                      // Départements rattachés directement à l'entité (sans direction)
                      const deptsOrphelins = audienceDepts.filter(d => d.id_entite === formAudSelEnt.value && !d.id_direction)
                      return (
                        <>
                          {/* Retour */}
                          <button type="button" onClick={() => setFormAudSelEnt(null)}
                            style={{ padding: '4px 10px', borderRadius: 99, border: '1.5px solid #e2e8f0', background: '#fff', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            ← retour
                          </button>
                          {/* Toute l'entité */}
                          <button type="button" onClick={() => selectAudience(emp => emp.id_entite === formAudSelEnt.value)}
                            style={{ padding: '4px 11px', borderRadius: 99, border: '1.5px solid #021630', background: '#eef4fb', color: '#021630', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                            Tout {formAudSelEnt.label}
                          </button>
                          {/* Directions */}
                          {dirs.map(dir => (
                            <button key={dir.value} type="button"
                              onClick={() => setFormAudSelDir(dir)}
                              style={{ padding: '4px 11px', borderRadius: 99, border: '1.5px solid #d0dff0', background: '#f8fafc', color: '#021630', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                              {dir.label}
                            </button>
                          ))}
                          {/* Départements orphelins (sans direction) — séparateur visuel si les deux existent */}
                          {deptsOrphelins.length > 0 && dirs.length > 0 && (
                            <span style={{ alignSelf: 'center', color: '#cbd5e1', fontSize: '0.7rem', margin: '0 2px' }}>|</span>
                          )}
                          {deptsOrphelins.map(dept => (
                            <button key={dept.value} type="button"
                              onClick={() => selectAudience(emp => emp.dept_id === dept.value)}
                              style={{ padding: '4px 10px', borderRadius: 99, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                              {dept.label}
                            </button>
                          ))}
                        </>
                      )
                    })()}

                    {/* ── Niveau 3 : Départements de la direction sélectionnée ── */}
                    {formAudSelDir && (() => {
                      const depts = audienceDepts.filter(d => d.id_direction === formAudSelDir.value)
                      return (
                        <>
                          {/* Retour direction */}
                          <button type="button" onClick={() => setFormAudSelDir(null)}
                            style={{ padding: '4px 10px', borderRadius: 99, border: '1.5px solid #e2e8f0', background: '#fff', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            ← retour
                          </button>
                          {/* Toute la direction */}
                          <button type="button" onClick={() => selectAudience(emp => emp.id_direction === formAudSelDir.value)}
                            style={{ padding: '4px 11px', borderRadius: 99, border: '1.5px solid #021630', background: '#eef4fb', color: '#021630', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                            Toute la direction
                          </button>
                          {depts.length === 0
                            ? <span style={{ fontSize: '0.72rem', color: '#94a3b8', alignSelf: 'center' }}>Aucun département</span>
                            : depts.map(dept => (
                              <button key={dept.value} type="button"
                                onClick={() => selectAudience(emp => emp.dept_id === dept.value)}
                                style={{ padding: '4px 11px', borderRadius: 99, border: '1.5px solid #d0dff0', background: '#f8fafc', color: '#475569', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                {dept.label}
                              </button>
                            ))
                          }
                        </>
                      )
                    })()}
                  </div>

                  {/* Recherche individuelle */}
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Ajouter une personne</div>
                  <div style={{ position: 'relative', marginBottom: 4 }}>
                    <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input className="form-control" style={{ paddingLeft: 26, fontSize: '0.82rem' }}
                      placeholder="Rechercher un employé..."
                      value={formPSearch}
                      onChange={async e => {
                        const val = e.target.value
                        setFormPSearch(val)
                        if (val.length >= 2) {
                          try {
                            const r = await api.get(`/employees/autocomplete/employes?q=${encodeURIComponent(val)}&limit=6`)
                            const already = new Set(formParticipants.map(p => String(p.matricule)))
                            setFormPResults((r.data || []).filter(x => !already.has(String(x.matricule))))
                          } catch { setFormPResults([]) }
                        } else { setFormPResults([]) }
                      }}
                    />
                  </div>
                  {formPResults.length > 0 && (
                    <div style={{ border: '1px solid #d0dff0', borderRadius: '0 0 6px 6px', background: '#fff', maxHeight: 130, overflowY: 'auto', marginBottom: 8 }}>
                      {formPResults.map(e => (
                        <button key={e.matricule} type="button"
                          onClick={() => {
                            const already = new Set(formParticipants.map(p => String(p.matricule)))
                            if (!already.has(String(e.matricule))) {
                              setFormParticipants(p => [...p, { matricule: e.matricule, prenom: e.prenom || '', nom: e.nom || '' }])
                            }
                            setFormPSearch(''); setFormPResults([])
                          }}
                          style={{ width: '100%', padding: '6px 10px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#021630' }}>{e.prenom} {e.nom}</span>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>#{e.matricule}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Liste sélectionnée */}
                  {formParticipants.length > 0 && (
                    <div style={{ border: '1px solid #d0dff0', borderRadius: 6, background: '#fff', maxHeight: 170, overflowY: 'auto', marginTop: 6 }}>
                      <div style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>{formParticipants.length} participant(s)</span>
                        <button type="button" onClick={() => setFormParticipants([])}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: '#ce2b2b', fontWeight: 600 }}>
                          Tout effacer
                        </button>
                      </div>
                      {formParticipants.map(p => (
                        <div key={p.matricule} style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderBottom: '1px solid #f1f5f9', gap: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#021630', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: '#021630', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.prenom} {p.nom}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>#{p.matricule}</span>
                          <button type="button"
                            onClick={() => setFormParticipants(prev => prev.filter(x => x.matricule !== p.matricule))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, lineHeight: 1 }}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

                {/* Participants : toggle inline + bouton ajout */}
                {isEventManager && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => toggleInscriptions(ev.id)}
                        style={{
                          flex: 1, padding: '7px 12px', border: '1px solid #d0dff0',
                          borderRadius: 8, background: inscriptionsOpen[ev.id] ? '#eef4fb' : '#f8fafc',
                          cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#021630',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Users size={13} />
                        Participants
                        {inscriptionsData[ev.id]?.length > 0 && (
                          <span style={{ background: '#021630', color: '#fff', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px' }}>
                            {inscriptionsData[ev.id].length}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto' }}>
                          {inscriptionsOpen[ev.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                      </button>
                      <button
                        onClick={() => openParticipantsModal(ev)}
                        title="Ajouter des participants"
                        style={{ padding: '7px 10px', border: '1px solid #d0dff0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', color: '#021630', display: 'flex', alignItems: 'center' }}
                      >
                        <UserPlus size={13} />
                      </button>
                    </div>

                    {/* Panneau inline — liste + présence */}
                    {inscriptionsOpen[ev.id] && (
                      <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        {inscriptionsLoading[ev.id] ? (
                          <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Chargement...</div>
                        ) : !(inscriptionsData[ev.id] || []).length ? (
                          <div style={{ padding: '18px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                            Aucun participant — utilisez <UserPlus size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> pour en ajouter
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const list = inscriptionsData[ev.id] || []
                              const np = list.filter(i => i.statut === 'present').length
                              const na = list.filter(i => i.statut === 'absent').length
                              return (
                                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                  {[
                                    { label: 'Inscrits', val: list.length, color: '#4a5568' },
                                    { label: 'Présents', val: np, color: '#021630' },
                                    { label: 'Absents', val: na, color: '#ce2b2b' },
                                  ].map(s => (
                                    <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRight: '1px solid #e2e8f0' }}>
                                      <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
                                    </div>
                                  ))}
                                </div>
                              )
                            })()}
                            <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                              <button onClick={() => markAll(ev.id, 'present')}
                                style={{ flex: 1, padding: '4px 8px', border: '1px solid #d0dff0', borderRadius: 6, background: '#eef4fb', color: '#021630', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <UserCheck size={11} /> Tous présents
                              </button>
                              <button onClick={() => markAll(ev.id, 'absent')}
                                style={{ flex: 1, padding: '4px 8px', border: '1px solid #fecaca', borderRadius: 6, background: '#fef2f2', color: '#ce2b2b', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <UserX size={11} /> Tous absents
                              </button>
                            </div>
                            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                              {(inscriptionsData[ev.id] || []).map(participant => (
                                <div key={participant.matricule} style={{
                                  display: 'flex', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid #f1f5f9', gap: 8,
                                  background: participant.statut === 'present' ? '#f8fbff' : participant.statut === 'absent' ? '#fff8f8' : '#fff',
                                }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: participant.statut === 'present' ? '#021630' : participant.statut === 'absent' ? '#ce2b2b' : '#cbd5e1' }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, color: '#021630', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{participant.nom}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>#{participant.matricule}</div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
                                    color: participant.statut === 'present' ? '#021630' : participant.statut === 'absent' ? '#ce2b2b' : '#64748b',
                                    background: participant.statut === 'present' ? '#d0dff0' : participant.statut === 'absent' ? '#fde8e8' : '#f1f5f9',
                                  }}>
                                    {participant.statut === 'present' ? 'Présent' : participant.statut === 'absent' ? 'Absent' : 'Inscrit'}
                                  </span>
                                  <button onClick={() => markPresence(ev.id, participant.matricule, 'present')} title="Présent"
                                    style={{ border: 'none', borderRadius: 5, padding: '4px 5px', cursor: 'pointer', background: participant.statut === 'present' ? '#d0dff0' : '#f1f5f9', color: '#021630' }}>
                                    <UserCheck size={11} />
                                  </button>
                                  <button onClick={() => markPresence(ev.id, participant.matricule, 'absent')} title="Absent"
                                    style={{ border: 'none', borderRadius: 5, padding: '4px 5px', cursor: 'pointer', background: participant.statut === 'absent' ? '#fde8e8' : '#f1f5f9', color: '#ce2b2b' }}>
                                    <UserX size={11} />
                                  </button>
                                  <button onClick={() => removeParticipant(ev.id, participant.matricule)} title="Retirer"
                                    style={{ border: 'none', borderRadius: 5, padding: '4px 5px', cursor: 'pointer', background: '#f1f5f9', color: '#94a3b8' }}>
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL — Gestion des participants (événement existant)
      ═══════════════════════════════════════════════ */}
      {modalEvId && (() => {
      const evTitle = events.find(e => e.id === modalEvId)?.titre || ''
      const ins = inscriptionsData[modalEvId] || []
      return (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,22,48,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(2,22,48,0.3)' }}>

            {/* Header modal */}
            <div style={{ background: 'linear-gradient(90deg, #021630 0%, #112033 100%)', color: '#fff', padding: '14px 18px', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <UserPlus size={15} />
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Ajouter des participants</span>
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: 2 }}>{evTitle}</div>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', color: '#fff' }}><X size={15} /></button>
            </div>

            {/* Corps */}
            <div style={{ overflowY: 'auto' }}>

              {/* ── Audience drill-down ── */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  {modalAudSelDir ? `${modalAudSelEnt?.label} › ${modalAudSelDir.label}` : modalAudSelEnt ? modalAudSelEnt.label : 'Ajouter par audience'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {/* Niveau 1 — Entités */}
                  {!modalAudSelEnt && (
                    <>
                      <button type="button" onClick={() => addAudienceToEvent(modalEvId, () => true)}
                        style={{ padding: '5px 12px', borderRadius: 99, border: '1.5px solid #021630', background: '#021630', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        Tout
                      </button>
                      {audienceEntites.map(ent => (
                        <button key={ent.value} type="button" onClick={() => setModalAudSelEnt(ent)}
                          style={{ padding: '5px 12px', borderRadius: 99, border: '1.5px solid #d0dff0', background: '#f8fafc', color: '#021630', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                          {ent.label}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Niveau 2 — Directions + depts orphelins de l'entité */}
                  {modalAudSelEnt && !modalAudSelDir && (() => {
                    const dirs = audienceDirs.filter(d => d.id_entite === modalAudSelEnt.value)
                    const deptsOrphelins = audienceDepts.filter(d => d.id_entite === modalAudSelEnt.value && !d.id_direction)
                    return (
                      <>
                        <button type="button" onClick={() => setModalAudSelEnt(null)}
                          style={{ padding: '5px 10px', borderRadius: 99, border: '1.5px solid #e2e8f0', background: '#fff', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                          ← retour
                        </button>
                        <button type="button" onClick={() => addAudienceToEvent(modalEvId, emp => emp.id_entite === modalAudSelEnt.value)}
                          style={{ padding: '5px 12px', borderRadius: 99, border: '1.5px solid #021630', background: '#eef4fb', color: '#021630', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          Tout {modalAudSelEnt.label}
                        </button>
                        {dirs.map(dir => (
                          <button key={dir.value} type="button" onClick={() => setModalAudSelDir(dir)}
                            style={{ padding: '5px 12px', borderRadius: 99, border: '1.5px solid #d0dff0', background: '#f8fafc', color: '#021630', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                            {dir.label}
                          </button>
                        ))}
                        {deptsOrphelins.length > 0 && dirs.length > 0 && (
                          <span style={{ alignSelf: 'center', color: '#cbd5e1', fontSize: '0.7rem', margin: '0 2px' }}>|</span>
                        )}
                        {deptsOrphelins.map(dept => (
                          <button key={dept.value} type="button" onClick={() => addAudienceToEvent(modalEvId, emp => emp.dept_id === dept.value)}
                            style={{ padding: '5px 10px', borderRadius: 99, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            {dept.label}
                          </button>
                        ))}
                      </>
                    )
                  })()}

                  {/* Niveau 3 — Départements de la direction */}
                  {modalAudSelDir && (() => {
                    const depts = audienceDepts.filter(d => d.id_direction === modalAudSelDir.value)
                    return (
                      <>
                        <button type="button" onClick={() => setModalAudSelDir(null)}
                          style={{ padding: '5px 10px', borderRadius: 99, border: '1.5px solid #e2e8f0', background: '#fff', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                          ← retour
                        </button>
                        <button type="button" onClick={() => addAudienceToEvent(modalEvId, emp => emp.id_direction === modalAudSelDir.value)}
                          style={{ padding: '5px 12px', borderRadius: 99, border: '1.5px solid #021630', background: '#eef4fb', color: '#021630', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          Toute la direction
                        </button>
                        {depts.length === 0
                          ? <span style={{ fontSize: '0.72rem', color: '#94a3b8', alignSelf: 'center' }}>Aucun département</span>
                          : depts.map(dept => (
                            <button key={dept.value} type="button" onClick={() => addAudienceToEvent(modalEvId, emp => emp.dept_id === dept.value)}
                              style={{ padding: '5px 11px', borderRadius: 99, border: '1.5px solid #d0dff0', background: '#f8fafc', color: '#475569', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                              {dept.label}
                            </button>
                          ))
                        }
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* ── Recherche individuelle ── */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1px solid #d0dff0', borderRadius: 8, fontSize: '0.82rem', boxSizing: 'border-box' }}
                    placeholder="Ajouter une personne par nom ou matricule..."
                    value={modalSearch}
                    onChange={async e => {
                      const val = e.target.value
                      setModalSearch(val)
                      if (val.length >= 2) {
                        try {
                          const r = await api.get(`/employees/autocomplete/employes?q=${encodeURIComponent(val)}&limit=6`)
                          const already = new Set(ins.map(i => String(i.matricule)))
                          setModalSearchResults((r.data || []).filter(x => !already.has(String(x.matricule))))
                        } catch { setModalSearchResults([]) }
                      } else { setModalSearchResults([]) }
                    }}
                  />
                </div>
                {modalSearchResults.length > 0 && (
                  <div style={{ border: '1px solid #d0dff0', borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#fff', maxHeight: 130, overflowY: 'auto' }}>
                    {modalSearchResults.map(e => (
                      <button key={e.matricule} type="button"
                        onClick={async () => {
                          await addParticipant(modalEvId, e.matricule)
                          setModalSearch(''); setModalSearchResults([])
                        }}
                        style={{ width: '100%', padding: '7px 12px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#021630' }}>{e.prenom} {e.nom}</span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>#{e.matricule}</span>
                      </button>
                    ))}
                  </div>
                )}
                {modalSearch.length >= 2 && modalSearchResults.length === 0 && (
                  <div style={{ padding: '7px 12px', fontSize: '0.75rem', color: '#94a3b8', border: '1px solid #d0dff0', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>Aucun résultat</div>
                )}
              </div>

              {/* Confirmation après ajout */}
              {ins.length > 0 && (
                <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', color: '#021630', fontWeight: 700 }}>{ins.length} participant(s) inscrit(s)</span>
                  <button onClick={closeModal} style={{ marginLeft: 'auto', padding: '4px 12px', border: '1px solid #d0dff0', borderRadius: 6, background: '#eef4fb', color: '#021630', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
                </div>
              )}
            </div>

          </div>
        </div>
      )
    })()}
    </div>
  )
}
