import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import AvatarCircle from '../components/AvatarCircle'
import { Clock, User, Calendar, Briefcase, Award, ArrowRight, Search, TrendingUp, FileText, MapPin } from 'lucide-react'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

const EVENT_TYPES = {
  embauche:       { label: 'Embauche',            color: DARK, bg: '#f8fafc' },
  promotion:      { label: 'Promotion',            color: DARK, bg: '#f8fafc' },
  mutation:       { label: 'Mutation / Transfert', color: DARK, bg: '#f8fafc' },
  conge:          { label: 'Congé',                color: DARK, bg: '#f8fafc' },
  mission:        { label: 'Mission',              color: DARK, bg: '#f8fafc' },
  evaluation:     { label: 'Évaluation',           color: DARK, bg: '#f8fafc' },
  formation:      { label: 'Formation',            color: DARK, bg: '#f8fafc' },
  avertissement:  { label: 'Avertissement',        color: ACCENT, bg: '#fef2f2' },
  autre:          { label: 'Autre',                color: '#475569', bg: '#f8fafc' },
}

function buildTimeline(employee, conges, missions) {
  const events = []

  if (employee?.date_embauche) {
    events.push({
      date: employee.date_embauche,
      type: 'embauche',
      title: 'Entrée dans l\'entreprise',
      detail: `Poste: ${employee.fonction || 'Non renseigné'} — Entité: ${employee.nom_entite || employee.entite || 'N/A'}`,
    })
  }

  conges?.forEach(c => {
    if (c.statut === 'APPROUVE' || c.statut === 'approuve') {
      events.push({
        date: c.date_debut || c.created_at,
        type: 'conge',
        title: `Congé — ${c.type_conge || c.type || 'Annuel'}`,
        detail: `Du ${c.date_debut || '?'} au ${c.date_fin || '?'}`,
      })
    }
  })

  missions?.forEach(m => {
    if (m.statut !== 'REFUSE') {
      events.push({
        date: m.date_depart || m.created_at,
        type: 'mission',
        title: `Mission — ${m.destination || 'Destination N/A'}`,
        detail: `Statut: ${m.statut || 'En cours'}`,
      })
    }
  })

  return events.sort((a, b) => new Date(b.date) - new Date(a.date))
}

export default function EmployeeTimeline() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(user?.role || '')
  const [employees, setEmployees] = useState([])
  const [selectedMatricule, setSelectedMatricule] = useState(searchParams.get('emp') || user?.matricule || '')
  const [searchQ, setSearchQ] = useState('')
  const [employee, setEmployee] = useState(null)
  const [conges, setConges] = useState([])
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('tous')

  useEffect(() => {
    if (isAdmin) {
      api.get('/employees/').then(r => setEmployees(r.data || [])).catch(() => {})
    }
  }, [isAdmin])

  useEffect(() => {
    if (!selectedMatricule) return
    setLoading(true)
    Promise.all([
      api.get(`/employees/${selectedMatricule}`).catch(() => null),
      api.get('/conges').catch(() => ({ data: [] })),
      api.get('/missions/list').catch(() => ({ data: [] })),
    ]).then(([empRes, congesRes, missionsRes]) => {
      setEmployee(empRes?.data || null)
      const allConges = congesRes?.data || []
      const allMissions = missionsRes?.data || []
      setConges(allConges.filter(c => String(c.matricule) === String(selectedMatricule)))
      setMissions(allMissions.filter(m => Array.isArray(m.missionnaires) 
        ? m.missionnaires.some(mn => String(mn.matricule) === String(selectedMatricule))
        : String(m.matricule) === String(selectedMatricule)
      ))
    }).finally(() => setLoading(false))
  }, [selectedMatricule])

  const filteredEmployees = employees.filter(e => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (e.prenom + ' ' + e.nom).toLowerCase().includes(q) || String(e.matricule).includes(q)
  })

  const timeline = buildTimeline(employee, conges, missions)
  const filtered = filterType === 'tous' ? timeline : timeline.filter(e => e.type === filterType)

  const calcAge = (d) => {
    if (!d) return null
    const diff = new Date() - new Date(d)
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  }

  const calcAnciennete = (d) => {
    if (!d) return 'N/A'
    const diff = new Date() - new Date(d)
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    if (years === 0) return `${months} mois`
    return `${years} an${years > 1 ? 's' : ''} ${months}m`
  }

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={22} /> Parcours Employé
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Visualisez le parcours et l'historique complet d'un employé</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate('/rh/employees')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: 'rgba(255,255,255,0.15)',
                color: 'white', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
              }}
            >
              ← Retour aux Employés
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '280px 1fr' : '1fr', gap: 18 }}>
        {/* Sidebar — employee selector (admin only) */}
        {isAdmin && (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', height: 'fit-content' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.82rem', boxSizing: 'border-box' }}
                  placeholder="Rechercher un employé..."
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {filteredEmployees.map(e => (
                <button key={e.matricule} onClick={() => setSelectedMatricule(e.matricule)} style={{
                  width: '100%', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', border: 'none', borderBottom: '1px solid #f1f5f9',
                  background: String(selectedMatricule) === String(e.matricule) ? '#fef2f2' : 'white', cursor: 'pointer', textAlign: 'left',
                  borderLeft: String(selectedMatricule) === String(e.matricule) ? `3px solid ${ACCENT}` : '3px solid transparent',
                }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{e.prenom} {e.nom}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>#{e.matricule} • {e.fonction || 'N/A'}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Timeline content */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Chargement...</div>
          ) : !employee ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <User size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>Sélectionnez ou chargez un employé</p>
            </div>
          ) : (
            <>
              {/* Employee card */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px', marginBottom: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
                <AvatarCircle
                  photoUrl={employee.photo_url}
                  letter={`${employee.prenom?.[0] || ''}${employee.nom?.[0] || '?'}`}
                  size={56}
                  borderWidth={1.5}
                  borderColor='#fecaca'
                  fallbackBackground={`${ACCENT}22`}
                />
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 4px', color: DARK, fontSize: '1.15rem', fontWeight: 800 }}>{employee.prenom} {employee.nom}</h2>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                    <span>#{employee.matricule}</span>
                    <span>• {employee.fonction || 'Poste N/A'}</span>
                    <span>• {employee.nom_entite || employee.entite || 'Entité N/A'}</span>
                    {employee.date_embauche && <span>• Ancienneté: <strong>{calcAnciennete(employee.date_embauche)}</strong></span>}
                    {employee.date_naissance && <span>• Âge: <strong>{calcAge(employee.date_naissance)} ans</strong></span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{timeline.length} événement(s)</div>
                </div>
              </div>

              {/* Filter */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterType('tous')} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', borderColor: filterType === 'tous' ? ACCENT : '#e2e8f0', background: filterType === 'tous' ? ACCENT : 'white', color: filterType === 'tous' ? 'white' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Tous</button>
                {Object.entries(EVENT_TYPES).map(([k, v]) => (
                  <button key={k} onClick={() => setFilterType(k)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', borderColor: filterType === k ? ACCENT : '#e2e8f0', background: filterType === k ? ACCENT : 'white', color: filterType === k ? 'white' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                    {v.label}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: '#94a3b8', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <Clock size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>Aucun événement pour ce filtre</p>
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 32 }}>
                  {/* Vertical line */}
                  <div style={{ position: 'absolute', left: 11, top: 8, bottom: 8, width: 2, background: '#e2e8f0' }} />
                  {filtered.map((ev, idx) => {
                    const type = EVENT_TYPES[ev.type] || EVENT_TYPES.autre
                    return (
                      <div key={idx} style={{ position: 'relative', marginBottom: 16 }}>
                        {/* Dot */}
                        <div style={{ position: 'absolute', left: -32, top: 10, width: 22, height: 22, borderRadius: '50%', background: type.bg, border: `2px solid ${type.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                        />
                        {/* Card */}
                        <div style={{ background: 'white', border: `1px solid ${type.color}33`, borderLeft: `3px solid ${type.color}`, borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: DARK, fontSize: '0.88rem' }}>{ev.title}</span>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0, marginLeft: 10 }}>{ev.date ? new Date(ev.date).toLocaleDateString('fr-FR') : 'Date N/A'}</span>
                          </div>
                          {ev.detail && <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>{ev.detail}</p>}
                          <span style={{ display: 'inline-block', marginTop: 6, fontSize: '0.68rem', fontWeight: 700, color: type.color, background: type.bg, padding: '2px 8px', borderRadius: 20 }}>{type.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
