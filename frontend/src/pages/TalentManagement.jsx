import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Users, Plus, X, Target, Calendar, CheckCircle, Clock } from 'lucide-react'
import '../styles/Operations.css'
import { confirmDialog } from '../components/ui/bridge'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

const GOAL_STATUTS = { a_faire: { label: 'À faire', color: '#64748b' }, en_cours: { label: 'En cours', color: '#021630' }, atteint: { label: 'Atteint', color: '#021630' }, abandonne: { label: 'Abandonné', color: '#94a3b8' } }
const GOAL_TYPES = ['Développement', 'Performance', 'Formation', 'Leadership', 'Technique', 'Personnel']

function MeetingCard({ meeting, employees, onDelete, onEdit, canEdit }) {
  const [expanded, setExpanded] = useState(false)
  const manager = employees.find(e => String(e.matricule) === String(meeting.manager_id))
  const employee = employees.find(e => String(e.matricule) === String(meeting.employee_id))
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={16} style={{ color: '#475569' }} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: DARK, fontSize: '0.88rem' }}>{meeting.titre}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
            {manager ? `${manager.prenom} ${manager.nom}` : '?'} → {employee ? `${employee.prenom} ${employee.nom}` : '?'} • {new Date(meeting.date).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg)', color: '#475569' }}>
          {meeting.statut === 'termine' ? "Terminé" : "Planifié"}
        </span>
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#64748b', fontSize: '0.7rem' }}>
          {expanded ? '▲' : '▼'}
        </button>
        {canEdit && <button onClick={() => onEdit(meeting)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#475569', fontSize: '0.7rem' }}>{"Modifier"}</button>}
        {canEdit && <button onClick={() => onDelete(meeting.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: ACCENT, fontSize: '0.7rem' }}>{"Supprimer"}</button>}
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {meeting.agenda && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>{"Ordre du jour"}</div>
              <div style={{ fontSize: '0.82rem', color: '#475569', whiteSpace: 'pre-line' }}>{meeting.agenda}</div>
            </div>
          )}
          {meeting.notes && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>{"Notes et décisions"}</div>
              <div style={{ fontSize: '0.82rem', color: '#475569', whiteSpace: 'pre-line', background: 'var(--bg)', padding: '8px 10px', borderRadius: 6 }}>{meeting.notes}</div>
            </div>
          )}
          {meeting.actions && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>{"Suivi"}</div>
              <div style={{ fontSize: '0.82rem', color: '#475569' }}>{meeting.actions}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, onDelete, onStatusChange, canEdit }) {
  const conf = GOAL_STATUTS[goal.statut] || GOAL_STATUTS.a_faire
  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${conf.color}30`, borderLeft: `4px solid ${conf.color}`, borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: DARK, fontSize: '0.88rem' }}>{goal.titre}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
            {goal.type} {goal.echeance ? `• Échéance: ${new Date(goal.echeance).toLocaleDateString('fr-FR')}` : ''}
          </div>
          {goal.description && <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>{goal.description}</div>}
        </div>
        {canEdit && (
          <select value={goal.statut} onChange={e => onStatusChange(goal.id, e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', background: 'var(--card)', color: conf.color, fontWeight: 700 }}>
            {Object.entries(GOAL_STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        {canEdit && <button onClick={() => onDelete(goal.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: ACCENT, fontSize: '0.7rem' }}>{"Supprimer"}</button>}
      </div>
    </div>
  )
}

export default function TalentManagement() {
  const { user } = useAuth()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(user?.role || '')
  const [employees, setEmployees] = useState([])
  const [meetings, setMeetings] = useState([])
  const [goals, setGoals] = useState([])
  const [activeTab, setActiveTab] = useState('meetings')
  const [showMeetForm, setShowMeetForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editMeeting, setEditMeeting] = useState(null)
  const [filterEmp, setFilterEmp] = useState('tous')

  const [meetForm, setMeetForm] = useState({ titre: '', manager_id: '', employee_id: '', date: '', agenda: '', notes: '', actions: '', statut: 'planifie' })
  const [goalForm, setGoalForm] = useState({ titre: '', description: '', type: 'Développement', echeance: '', statut: 'a_faire', employee_id: '' })

  useEffect(() => {
    api.get('/employees/').then(r => setEmployees(r.data || [])).catch(() => {})
    loadTalentData()
  }, [])

  async function loadTalentData() {
    const [meetingsRes, goalsRes] = await Promise.all([
      api.get('/api/talent/meetings').catch(() => ({ data: [] })),
      api.get('/api/talent/goals').catch(() => ({ data: [] })),
    ])
    setMeetings(Array.isArray(meetingsRes.data) ? meetingsRes.data : [])
    setGoals(Array.isArray(goalsRes.data) ? goalsRes.data : [])
  }

  const visibleEmployees = useMemo(() => {
    if (isAdmin) return employees
    return employees.filter(e => String(e.matricule) === String(user?.matricule))
  }, [employees, isAdmin, user])

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const isInvolved = String(m.manager_id) === String(user?.matricule) || String(m.employee_id) === String(user?.matricule)
      if (!isAdmin && !isInvolved) return false
      if (filterEmp !== 'tous' && String(m.employee_id) !== filterEmp && String(m.manager_id) !== filterEmp) return false
      return true
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [meetings, isAdmin, user, filterEmp])

  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      if (!isAdmin && String(g.employee_id) !== String(user?.matricule)) return false
      if (filterEmp !== 'tous' && String(g.employee_id) !== filterEmp) return false
      return true
    })
  }, [goals, isAdmin, user, filterEmp])

  const submitMeeting = async (e) => {
    e.preventDefault()
    if (!meetForm.titre.trim()) return
    if (editMeeting) {
      await api.put(`/api/talent/meetings/${editMeeting.id}`, { ...meetForm }).catch(() => null)
    } else {
      await api.post('/api/talent/meetings', { ...meetForm }).catch(() => null)
    }
    await loadTalentData()
    setMeetForm({ titre: '', manager_id: '', employee_id: '', date: '', agenda: '', notes: '', actions: '', statut: 'planifie' })
    setEditMeeting(null); setShowMeetForm(false)
  }

  const submitGoal = async (e) => {
    e.preventDefault()
    if (!goalForm.titre.trim()) return
    await api.post('/api/talent/goals', {
      ...goalForm,
      employee_id: goalForm.employee_id || String(user?.matricule),
    }).catch(() => null)
    await loadTalentData()
    setShowGoalForm(false)
    setGoalForm({ titre: '', description: '', type: 'Développement', echeance: '', statut: 'a_faire', employee_id: '' })
  }

  const deleteMeeting = async (id) => {
    const ok = await confirmDialog({ title: 'Supprimer la réunion', message: 'Êtes-vous sûr de vouloir supprimer cette réunion ?', variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    await api.delete(`/api/talent/meetings/${id}`).catch(() => null)
    await loadTalentData()
  }

  const deleteGoal = async (id) => {
    await api.delete(`/api/talent/goals/${id}`).catch(() => null)
    await loadTalentData()
  }

  const updateGoalStatus = async (id, statut) => {
    const goal = goals.find((g) => g.id === id)
    if (!goal) return
    await api.put(`/api/talent/goals/${id}`, { ...goal, statut }).catch(() => null)
    await loadTalentData()
  }

  const startEditMeeting = (m) => {
    setMeetForm({ titre: m.titre, manager_id: m.manager_id, employee_id: m.employee_id, date: m.date, agenda: m.agenda || '', notes: m.notes || '', actions: m.actions || '', statut: m.statut })
    setEditMeeting(m); setShowMeetForm(true)
  }

  const tabs = [{ id: 'meetings', label: "Réunions" }, { id: 'goals', label: "Objectifs de carrière" }]
  const goalsByStatus = Object.keys(GOAL_STATUTS).map(k => ({ key: k, ...GOAL_STATUTS[k], count: filteredGoals.filter(g => g.statut === k).length }))

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={22} /> {"Gestion des talents"}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>{"Réunions de suivi et objectifs de carrière"}</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowMeetForm(!showMeetForm); setShowGoalForm(false) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> {"Nouvelle réunion"}
          </button>
        </div>
      </div>

      {/* Goal stat chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {goalsByStatus.map(s => (
          <div key={s.key} style={{ padding: '6px 14px', borderRadius: 20, background: `${s.color}15`, color: s.color, fontSize: '0.78rem', fontWeight: 700, border: `1px solid ${s.color}30` }}>
          {s.label}: {s.count}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg)', padding: 4, borderRadius: 8 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s', background: activeTab === t.id ? 'white' : 'transparent', color: activeTab === t.id ? DARK : '#64748b', boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      {isAdmin && (
        <div style={{ marginBottom: 14 }}>
          <select style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem', background: 'var(--card)' }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
            <option value="tous">Tous les employés</option>
            {employees.map(e => <option key={e.matricule} value={e.matricule}>{e.prenom} {e.nom}</option>)}
          </select>
        </div>
      )}

      {/* === MEETINGS TAB === */}
      {activeTab === 'meetings' && (
        <>
          {showMeetForm && (
            <div className="form-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: DARK, fontWeight: 700 }}>{editMeeting ? "Modifier la réunion" : "Nouvelle réunion"}</h3>
                <button onClick={() => { setShowMeetForm(false); setEditMeeting(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
              </div>
              <form onSubmit={submitMeeting}>
                <div className="form-group">
                  <label>{"Titre"} <span style={{ color: ACCENT }}>*</span></label>
                  <input className="form-control" value={meetForm.titre} onChange={e => setMeetForm({ ...meetForm, titre: e.target.value })} required placeholder="ex: Bilan Q3 - Développement" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{"Manager"}</label>
                    <select className="form-control" value={meetForm.manager_id} onChange={e => setMeetForm({ ...meetForm, manager_id: e.target.value })}>
                      <option value="">— Sélectionner —</option>
                      {employees.map(e => <option key={e.matricule} value={e.matricule}>{e.prenom} {e.nom}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{"Employé"}</label>
                    <select className="form-control" value={meetForm.employee_id} onChange={e => setMeetForm({ ...meetForm, employee_id: e.target.value })}>
                      <option value="">— Sélectionner —</option>
                      {employees.map(e => <option key={e.matricule} value={e.matricule}>{e.prenom} {e.nom}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{"Date"} <span style={{ color: ACCENT }}>*</span></label>
                    <input className="form-control" type="datetime-local" value={meetForm.date} onChange={e => setMeetForm({ ...meetForm, date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{"Statut"}</label>
                    <select className="form-control" value={meetForm.statut} onChange={e => setMeetForm({ ...meetForm, statut: e.target.value })}>
                      <option value="planifie">{"Planifié"}</option>
                      <option value="termine">{"Terminé"}</option>
                      <option value="annule">Annulé</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{"Ordre du jour"}</label>
                  <textarea className="form-control" rows={2} value={meetForm.agenda} onChange={e => setMeetForm({ ...meetForm, agenda: e.target.value })} placeholder="Points à aborder..." />
                </div>
                <div className="form-group">
                  <label>{"Notes et décisions"}</label>
                  <textarea className="form-control" rows={3} value={meetForm.notes} onChange={e => setMeetForm({ ...meetForm, notes: e.target.value })} placeholder="Compte-rendu de la réunion..." />
                </div>
                <div className="form-group">
                  <label>{"Actions de suivi"}</label>
                  <textarea className="form-control" rows={2} value={meetForm.actions} onChange={e => setMeetForm({ ...meetForm, actions: e.target.value })} placeholder="Tâches et responsabilités..." />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button type="submit" className="btn btn-primary">{editMeeting ? "Mettre à jour" : "Créer la réunion"}</button>
                  <button type="button" className="btn" onClick={() => { setShowMeetForm(false); setEditMeeting(null) }} style={{ background: 'var(--bg)', color: '#475569' }}>{"Annuler"}</button>
                </div>
              </form>
            </div>
          )}
          {filteredMeetings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <Calendar size={36} style={{ opacity: 0.3, marginBottom: 12 }} /><p style={{ margin: 0 }}>{"Aucune réunion"}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredMeetings.map(m => (
                <MeetingCard key={m.id} meeting={m} employees={employees} onDelete={deleteMeeting} onEdit={startEditMeeting} canEdit={isAdmin || String(m.manager_id) === String(user?.matricule)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* === GOALS TAB === */}
      {activeTab === 'goals' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowGoalForm(!showGoalForm)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> {"Nouvel objectif"}
            </button>
          </div>
          {showGoalForm && (
            <div className="form-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: DARK, fontWeight: 700 }}>{"Nouvel objectif"}</h3>
                <button onClick={() => setShowGoalForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
              </div>
              <form onSubmit={submitGoal}>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>{"Titre de l'objectif"} <span style={{ color: ACCENT }}>*</span></label>
                    <input className="form-control" value={goalForm.titre} onChange={e => setGoalForm({ ...goalForm, titre: e.target.value })} required placeholder="ex: Obtenir certification PMP" />
                  </div>
                  <div className="form-group">
                    <label>{"Type"}</label>
                    <select className="form-control" value={goalForm.type} onChange={e => setGoalForm({ ...goalForm, type: e.target.value })}>
                      {GOAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                {isAdmin && (
                  <div className="form-group">
                    <label>{"Employé concerné"}</label>
                    <select className="form-control" value={goalForm.employee_id} onChange={e => setGoalForm({ ...goalForm, employee_id: e.target.value })}>
                      <option value="">— Moi-même —</option>
                      {employees.map(e => <option key={e.matricule} value={e.matricule}>{e.prenom} {e.nom}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>{"Statut"}</label>
                    <select className="form-control" value={goalForm.statut} onChange={e => setGoalForm({ ...goalForm, statut: e.target.value })}>
                      {Object.entries(GOAL_STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{"Échéance"}</label>
                    <input className="form-control" type="date" value={goalForm.echeance} onChange={e => setGoalForm({ ...goalForm, echeance: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{"Description"}</label>
                  <textarea className="form-control" rows={2} value={goalForm.description} onChange={e => setGoalForm({ ...goalForm, description: e.target.value })} placeholder="Détails, étapes, indicateurs de succès..." />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button type="submit" className="btn btn-primary">{"Créer l'objectif"}</button>
                  <button type="button" className="btn" onClick={() => setShowGoalForm(false)} style={{ background: 'var(--bg)', color: '#475569' }}>{"Annuler"}</button>
                </div>
              </form>
            </div>
          )}
          {filteredGoals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <Target size={36} style={{ opacity: 0.3, marginBottom: 12 }} /><p style={{ margin: 0 }}>{"Aucun objectif"}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredGoals.map(g => (
                <GoalCard key={g.id} goal={g} onDelete={deleteGoal} onStatusChange={updateGoalStatus} canEdit={isAdmin || String(g.employee_id) === String(user?.matricule)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
