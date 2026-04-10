import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Users, Plus, X, TrendingUp, Briefcase, AlertCircle, ChevronDown } from 'lucide-react'
import '../styles/Operations.css'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

const QUARTERS = ['T1', 'T2', 'T3', 'T4']
const PRIORITIES = { haute: { label: 'Haute', color: ACCENT }, moyenne: { label: 'Moyenne', color: '#d97706' }, basse: { label: 'Basse', color: '#64748b' } }

function BarSimple({ value, max, color = ACCENT }) {
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.4s' }} />
    </div>
  )
}

export default function WorkforcePlanning() {
  const { user } = useAuth()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(user?.role || '')
  const [employees, setEmployees] = useState([])
  const [positions, setPositions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editPos, setEditPos] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Form fields
  const [formData, setFormData] = useState({ titre: '', direction: '', entite: '', trimestre: 'T1', annee: String(new Date().getFullYear()), budget: '', priorite: 'moyenne', statut: 'planifie', notes: '' })

  useEffect(() => {
    api.get('/employees/').then(r => setEmployees(r.data || [])).catch(() => {})
    loadPositions()
  }, [])

  async function loadPositions() {
    const res = await api.get('/api/workforce/positions').catch(() => ({ data: [] }))
    setPositions(Array.isArray(res.data) ? res.data : [])
  }

  const entites = useMemo(() => [...new Set(employees.map(e => e.entite?.nom || e.entite).filter(Boolean))], [employees])
  const directions = useMemo(() => [...new Set(employees.map(e => e.direction?.nom || e.direction).filter(Boolean))], [employees])

  // KPIs
  const headcountByEntite = useMemo(() => {
    const map = {}
    employees.forEach(e => {
      const key = e.entite?.nom || e.entite || 'Autre'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [employees])

  const openByPriority = useMemo(() => {
    const map = {}
    positions.filter(p => p.statut !== 'pourvu').forEach(p => {
      map[p.priorite] = (map[p.priorite] || 0) + 1
    })
    return map
  }, [positions])

  const openByQuarter = useMemo(() => {
    const map = { T1: 0, T2: 0, T3: 0, T4: 0 }
    positions.filter(p => p.statut !== 'pourvu').forEach(p => {
      if (map[p.trimestre] !== undefined) map[p.trimestre]++
    })
    return map
  }, [positions])

  const resetForm = () => {
    setFormData({ titre: '', direction: '', entite: '', trimestre: 'T1', annee: String(new Date().getFullYear()), budget: '', priorite: 'moyenne', statut: 'planifie', notes: '' })
    setEditPos(null); setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.titre.trim()) return
    if (editPos) {
      await api.put(`/api/workforce/positions/${editPos.id}`, { ...formData }).catch(() => null)
    } else {
      await api.post('/api/workforce/positions', {
        ...formData,
        created_by: Number(user?.matricule || user?.sub || 0) || null
      }).catch(() => null)
    }
    await loadPositions()
    resetForm()
  }

  const deletePosition = async (id) => {
    if (!window.confirm('Supprimer ce poste planifié ?')) return
    await api.delete(`/api/workforce/positions/${id}`).catch(() => null)
    await loadPositions()
  }

  const markFilled = async (id) => {
    const pos = positions.find((p) => p.id === id)
    if (!pos) return
    await api.put(`/api/workforce/positions/${id}`, { ...pos, statut: 'pourvu' }).catch(() => null)
    await loadPositions()
  }

  const startEdit = (pos) => {
    setFormData({ titre: pos.titre, direction: pos.direction, entite: pos.entite, trimestre: pos.trimestre, annee: pos.annee, budget: pos.budget, priorite: pos.priorite, statut: pos.statut, notes: pos.notes })
    setEditPos(pos); setShowForm(true)
  }

  const maxHeadcount = headcountByEntite.length ? headcountByEntite[0][1] : 1
  const maxQ = Math.max(...Object.values(openByQuarter), 1)

  const tabs = [{ id: 'overview', label: 'Vue d\'ensemble' }, { id: 'postes', label: 'Postes planifiés' }, { id: 'headcount', label: 'Effectifs actuels' }]

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={22} /> Workforce Planning
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Planification des effectifs, postes ouverts et objectifs RH</p>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(!showForm) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nouveau poste
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && isAdmin && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: DARK, fontWeight: 700 }}>{editPos ? 'Modifier le poste' : 'Nouveau poste planifié'}</h3>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Intitulé du poste <span style={{ color: ACCENT }}>*</span></label>
                <input className="form-control" value={formData.titre} onChange={e => setFormData({ ...formData, titre: e.target.value })} required placeholder="ex: Responsable Comptable" />
              </div>
              <div className="form-group">
                <label>Entité</label>
                <select className="form-control" value={formData.entite} onChange={e => setFormData({ ...formData, entite: e.target.value })}>
                  <option value="">— Toutes entités —</option>
                  {entites.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Direction</label>
                <select className="form-control" value={formData.direction} onChange={e => setFormData({ ...formData, direction: e.target.value })}>
                  <option value="">— Toutes directions —</option>
                  {directions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Trimestre cible</label>
                <select className="form-control" value={formData.trimestre} onChange={e => setFormData({ ...formData, trimestre: e.target.value })}>
                  {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Année</label>
                <input className="form-control" type="number" min={2020} max={2040} value={formData.annee} onChange={e => setFormData({ ...formData, annee: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priorité</label>
                <select className="form-control" value={formData.priorite} onChange={e => setFormData({ ...formData, priorite: e.target.value })}>
                  {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Statut</label>
                <select className="form-control" value={formData.statut} onChange={e => setFormData({ ...formData, statut: e.target.value })}>
                  <option value="planifie">Planifié</option>
                  <option value="en_recrutement">En recrutement</option>
                  <option value="pourvu">Pourvu</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>
              <div className="form-group">
                <label>Budget estimé (FCFA)</label>
                <input className="form-control" type="number" min={0} value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} placeholder="ex: 1500000" />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Contexte, prérequis, urgences..." />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">{editPos ? 'Mettre à jour' : 'Ajouter le poste'}</button>
              <button type="button" className="btn" onClick={resetForm} style={{ background: '#f1f5f9', color: '#475569' }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Effectif total', value: employees.length, color: DARK },
          { label: 'Postes planifiés', value: positions.length, color: DARK },
          { label: 'Postes ouverts', value: positions.filter(p => p.statut !== 'pourvu').length, color: '#94a3b8' },
          { label: 'Postes pourvus', value: positions.filter(p => p.statut === 'pourvu').length, color: DARK },
          { label: 'Haute priorité', value: openByPriority.haute || 0, color: ACCENT },
        ].map(k => (
          <div key={k.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s', background: activeTab === t.id ? 'white' : 'transparent', color: activeTab === t.id ? DARK : '#64748b', boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Postes par trimestre */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px' }}>
            <h3 style={{ margin: '0 0 14px', color: DARK, fontSize: '0.9rem', fontWeight: 700 }}>Postes ouverts par trimestre</h3>
            {QUARTERS.map(q => (
              <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 24, fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{q}</span>
                <BarSimple value={openByQuarter[q]} max={maxQ} color={ACCENT} />
                <span style={{ width: 20, fontSize: '0.8rem', fontWeight: 800, color: DARK, textAlign: 'right' }}>{openByQuarter[q]}</span>
              </div>
            ))}
          </div>
          {/* Par priorité */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px' }}>
            <h3 style={{ margin: '0 0 14px', color: DARK, fontSize: '0.9rem', fontWeight: 700 }}>Postes ouverts par priorité</h3>
            {Object.entries(PRIORITIES).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: v.color, width: 80 }}>{v.label}</span>
                <BarSimple value={openByPriority[k] || 0} max={Math.max(...Object.values(openByPriority), 1)} color={v.color} />
                <span style={{ width: 20, fontSize: '0.8rem', fontWeight: 800, color: DARK, textAlign: 'right' }}>{openByPriority[k] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Postes */}
      {activeTab === 'postes' && (
        <div>
          {positions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <Briefcase size={36} style={{ opacity: 0.3, marginBottom: 12 }} /><p style={{ margin: 0 }}>Aucun poste planifié</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {positions.map(pos => {
                const pConf = PRIORITIES[pos.priorite] || PRIORITIES.moyenne
                const statutColor = pos.statut === 'pourvu' ? '#021630' : pos.statut === 'en_recrutement' ? '#021630' : pos.statut === 'suspendu' ? '#94a3b8' : '#94a3b8'
                return (
                  <div key={pos.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${pConf.color}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: DARK, fontSize: '0.92rem' }}>{pos.titre}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 3 }}>
                          {[pos.entite, pos.direction].filter(Boolean).join(' › ')} • {pos.trimestre} {pos.annee}
                          {pos.budget ? ` • ${Number(pos.budget).toLocaleString('fr-FR')} FCFA` : ''}
                        </div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: `${pConf.color}20`, color: pConf.color }}>{pConf.label}</span>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: `${statutColor}15`, color: statutColor }}>
                        {{ planifie: 'Planifié', en_recrutement: 'En recrutement', pourvu: 'Pourvu', suspendu: 'Suspendu' }[pos.statut] || pos.statut}
                      </span>
                      {isAdmin && pos.statut !== 'pourvu' && (
                        <button onClick={() => markFilled(pos.id)} style={{ padding: '4px 8px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#021630', fontWeight: 700 }}>Marquer pourvu</button>
                      )}
                      {isAdmin && <button onClick={() => startEdit(pos)} style={{ padding: '4px 8px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }}>Modifier</button>}
                      {isAdmin && <button onClick={() => deletePosition(pos.id)} style={{ padding: '4px 8px', background: '#fef2f2', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: ACCENT }}>Supprimer</button>}
                    </div>
                    {pos.notes && <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>{pos.notes}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Headcount */}
      {activeTab === 'headcount' && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', color: DARK, fontSize: '0.9rem', fontWeight: 700 }}>Répartition des effectifs par entité</h3>
          {headcountByEntite.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>Aucune donnée</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {headcountByEntite.map(([entite, count]) => (
                <div key={entite} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 160, fontSize: '0.82rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entite}</span>
                  <BarSimple value={count} max={maxHeadcount} color={DARK} />
                  <span style={{ width: 30, fontSize: '0.82rem', fontWeight: 800, color: DARK, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
