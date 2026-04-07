import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { CheckSquare, Plus, Clock, AlertCircle, CheckCircle, User, Calendar, Trash2, Edit3, X, Flag } from 'lucide-react'
import '../styles/Operations.css'

const PRIORITIES = [
  { value: 'haute', label: 'Haute', color: '#ce2b2b', bg: '#fef2f2' },
  { value: 'moyenne', label: 'Moyenne', color: '#475569', bg: '#f8fafc' },
  { value: 'basse', label: 'Basse', color: '#021630', bg: '#f8fafc' },
]

const STATUTS = [
  { value: 'a_faire', label: 'À faire', color: '#64748b' },
  { value: 'en_cours', label: 'En cours', color: '#021630' },
  { value: 'termine', label: 'Terminé', color: '#021630' },
  { value: 'annule', label: 'Annulé', color: '#ce2b2b' },
]

const emptyForm = {
  titre: '',
  description: '',
  priorite: 'moyenne',
  statut: 'a_faire',
  date_echeance: '',
  assigne_a: '',
}

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterPrio, setFilterPrio] = useState('tous')
  const [searchQ, setSearchQ] = useState('')
  const [error, setError] = useState('')

  const roleValue = String(user?.role || '').toUpperCase()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(roleValue)

  async function loadTasks() {
    if (!user?.matricule) return
    try {
      const response = await api.get(`/api/tasks/${user.matricule}`, { params: { role: roleValue } })
      setTasks(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger les tâches')
    }
  }

  useEffect(() => {
    loadTasks()
  }, [user?.matricule, roleValue])

  useEffect(() => {
    if (isAdmin) {
      api.get('/employees/').then(r => setEmployees(r.data || [])).catch(() => {})
    }
  }, [isAdmin])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      ...form,
      matricule_actor: user?.matricule,
      role_actor: roleValue,
    }
    try {
      if (editingId) {
        await api.put(`/api/tasks/${editingId}`, payload)
      } else {
        await api.post('/api/tasks/', payload)
      }
      await loadTasks()
      resetForm()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors de l’enregistrement de la tâche')
    }
  }

  const deleteTask = async (id) => {
    if (!window.confirm('Supprimer cette tâche ?')) return
    setError('')
    try {
      await api.delete(`/api/tasks/${id}`, { params: { matricule_actor: user?.matricule, role_actor: roleValue } })
      await loadTasks()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors de la suppression de la tâche')
    }
  }

  const changeStatut = async (id, statut) => {
    setError('')
    try {
      await api.patch(`/api/tasks/${id}/statut`, { statut, matricule_actor: user?.matricule, role_actor: roleValue })
      await loadTasks()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors du changement de statut')
    }
  }

  const editTask = (task) => {
    setForm({
      titre: task.titre,
      description: task.description || '',
      priorite: task.priorite,
      statut: task.statut,
      date_echeance: task.date_echeance || '',
      assigne_a: task.assigne_a || '',
    })
    setEditingId(task.id)
    setShowForm(true)
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const filteredTasks = tasks.filter(t => {
    if (filterStatut !== 'tous' && t.statut !== filterStatut) return false
    if (filterPrio !== 'tous' && t.priorite !== filterPrio) return false
    if (searchQ && !t.titre.toLowerCase().includes(searchQ.toLowerCase())) return false
    if (!isAdmin && t.created_by !== user?.matricule && t.assigne_a !== String(user?.matricule)) return false
    return true
  })

  const counts = {
    a_faire: tasks.filter(t => t.statut === 'a_faire').length,
    en_cours: tasks.filter(t => t.statut === 'en_cours').length,
    termine: tasks.filter(t => t.statut === 'termine').length,
  }

  const getPrio = (v) => PRIORITIES.find(p => p.value === v) || PRIORITIES[1]
  const getStatut = (v) => STATUTS.find(s => s.value === v) || STATUTS[0]

  const isOverdue = (task) => {
    if (!task.date_echeance || task.statut === 'termine' || task.statut === 'annule') return false
    return new Date(task.date_echeance) < new Date()
  }

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #021630 0%, #112033 100%)', color: 'white', padding: '20px 24px', borderRadius: '10px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={22} /> Gestion des Tâches
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Gérez et suivez vos tâches et celles de votre équipe</p>
          </div>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Nouvelle Tâche
          </button>
        </div>
      </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{error}</div>}

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'À faire', count: counts.a_faire, color: '#64748b', bg: '#f8fafc' },
          { label: 'En cours', count: counts.en_cours, color: '#021630', bg: '#f8fafc' },
          { label: 'Terminées', count: counts.termine, color: '#021630', bg: '#f8fafc' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#021630', fontSize: '1rem', fontWeight: 700 }}>
              {editingId ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </h3>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Titre <span style={{ color: '#ce2b2b' }}>*</span></label>
              <input className="form-control" value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Titre de la tâche" required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détails optionnels..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priorité</label>
                <select className="form-control" value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Statut</label>
                <select className="form-control" value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}>
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date d'échéance</label>
                <input className="form-control" type="date" value={form.date_echeance} onChange={e => setForm({ ...form, date_echeance: e.target.value })} />
              </div>
            </div>
            {isAdmin && (
              <div className="form-group">
                <label>Assigner à</label>
                <select className="form-control" value={form.assigne_a} onChange={e => setForm({ ...form, assigne_a: e.target.value })}>
                  <option value="">— Moi-même —</option>
                  {employees.map(emp => (
                    <option key={emp.matricule} value={emp.matricule}>{emp.prenom} {emp.nom} ({emp.matricule})</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">{editingId ? 'Enregistrer' : 'Créer la tâche'}</button>
              <button type="button" className="btn" onClick={resetForm} style={{ background: '#f1f5f9', color: '#475569' }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.85rem', minWidth: 200 }}
          placeholder="Rechercher une tâche..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <select style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.82rem', background: 'white' }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
          <option value="tous">Tous les statuts</option>
          {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.82rem', background: 'white' }} value={filterPrio} onChange={e => setFilterPrio(e.target.value)}>
          <option value="tous">Toutes priorités</option>
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>{filteredTasks.length} tâche(s)</span>
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
          <CheckSquare size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>Aucune tâche trouvée</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTasks.map(task => {
            const prio = getPrio(task.priorite)
            const statut = getStatut(task.statut)
            const overdue = isOverdue(task)
            return (
              <div key={task.id} style={{
                background: 'white',
                border: `1px solid ${overdue ? '#fecaca' : '#e2e8f0'}`,
                borderLeft: `4px solid ${overdue ? '#ce2b2b' : prio.color}`,
                borderRadius: 10,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                {/* Statut quick-change */}
                <div style={{ paddingTop: 2 }}>
                  <select
                    value={task.statut}
                    onChange={e => changeStatut(task.id, e.target.value)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}
                    title="Changer le statut"
                  >
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.icon}</option>)}
                  </select>
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', textDecoration: task.statut === 'termine' ? 'line-through' : 'none', opacity: task.statut === 'termine' ? 0.6 : 1 }}>{task.titre}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: prio.color, background: prio.bg, padding: '2px 8px', borderRadius: 20 }}>{prio.label}</span>
                    {overdue && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ce2b2b', background: '#fef2f2', padding: '2px 8px', borderRadius: 20 }}>En retard</span>}
                  </div>
                  {task.description && <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>{task.description}</p>}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.76rem', color: '#94a3b8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> {task.date_echeance || 'Aucune échéance'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={11} /> {task.assigne_a || task.created_by || '—'}</span>
                    <span style={{ color: statut.color, fontWeight: 600 }}>{statut.icon} {statut.label}</span>
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => editTask(task)} title="Modifier" style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#475569' }}>
                    <Edit3 size={13} />
                  </button>
                  <button onClick={() => deleteTask(task.id)} title="Supprimer" style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#ce2b2b' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
