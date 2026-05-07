import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import AvatarCircle from '../components/AvatarCircle'
import { Clock, User, Calendar, Briefcase, Award, ArrowRight, Search, TrendingUp, FileText, MapPin, BarChart2 } from 'lucide-react'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

// Palette dans la charte : navy (#021630) pour la carrière, gris pour congé, rouge pour disciplinaire
const EVENT_TYPES = {
  embauche:       { label: 'Embauche',             color: '#021630', bg: '#c8d4e5' }, // navy brand — le plus foncé
  promotion:      { label: 'Promotion',             color: '#063e7a', bg: '#d0dff0' }, // navy sombre
  mutation:       { label: 'Mutation / Transfert',  color: '#1e6aaf', bg: '#daeaf8' }, // navy médium
  conge:          { label: 'Congé',                 color: '#4a5568', bg: '#edf2f7' }, // gris neutre — clairement différent
  mission:        { label: 'Mission',               color: '#02244d', bg: '#d4e0f0' }, // navy profond
  evaluation:     { label: 'Évaluation',            color: '#0d5faa', bg: '#d8e8f8' }, // bleu
  formation:      { label: 'Formation',             color: '#2880c8', bg: '#dff0fc' }, // bleu clair
  avertissement:  { label: 'Avertissement',         color: '#ce2b2b', bg: '#fde8e8' }, // accent brand
  disciplinaire:  { label: 'Mesure disciplinaire',  color: '#9b1c1c', bg: '#fbd5d5' }, // accent foncé
  autre:          { label: 'Autre',                 color: '#4a5568', bg: '#edf2f7' },
}

// Statuts considérés comme "validés" pour les opérations
const STATUTS_VALIDES = ['approuve', 'approuvé', 'approuvée', 'valide', 'validé', 'validée', 'accordé', 'accepté', 'terminé', 'termine', 'effectue', 'effectué']
export function isStatutValide(statut) {
  return STATUTS_VALIDES.includes(String(statut || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    || STATUTS_VALIDES.includes(String(statut || '').toLowerCase())
}

export function buildTimeline(employee, conges, missionsMisso, parcours, mesures, evaluations, formations) {
  const events = []

  // --- Embauche (toujours en premier) ---
  if (employee?.date_embauche) {
    events.push({
      date: employee.date_embauche,
      type: 'embauche',
      title: 'Entrée dans l\'entreprise',
      detail: `Poste: ${employee.fonction || 'Non renseigné'} — Entité: ${employee.nom_entite || employee.entite || 'N/A'}`,
    })
  }

  // --- Parcours (promotions / mutations) ---
  parcours?.forEach(p => {
    const t = String(p.type_action || '').toUpperCase()
    const mapped = t === 'PROMOTION' ? 'promotion'
      : t === 'MUTATION' || t === 'TRANSFERT' ? 'mutation'
      : t === 'EMBAUCHE' ? 'embauche'
      : 'autre'
    const label = t === 'PROMOTION' ? 'Promotion'
      : t === 'MUTATION' ? 'Mutation'
      : t === 'TRANSFERT' ? 'Transfert'
      : t === 'EMBAUCHE' ? 'Embauche'
      : (p.champ_modifie || 'Changement')
    const detail = p.libelle
      || [p.ancienne_valeur, p.nouvelle_valeur].filter(Boolean).join(' → ')
      || (p.champ_modifie ? `Champ modifié: ${p.champ_modifie}` : 'Changement enregistré')
    events.push({ date: p.date_action || p.created_at, type: mapped, title: label, detail })
  })

  // --- Congés validés uniquement ---
  conges?.filter(c => isStatutValide(c.statut)).forEach(c => {
    events.push({
      date: c.date_debut || c.date_demande,
      type: 'conge',
      title: 'Congé approuvé',
      detail: [
        c.date_debut ? `Du ${new Date(c.date_debut).toLocaleDateString('fr-FR')}` : null,
        c.date_fin ? `au ${new Date(c.date_fin).toLocaleDateString('fr-FR')}` : null,
        c.duree_jours ? `(${c.duree_jours}j)` : null,
      ].filter(Boolean).join(' '),
    })
  })

  // --- Missions validées où la personne est MISSIONNAIRE ---
  missionsMisso?.filter(m => isStatutValide(m.statut)).forEach(m => {
    const lieu = [m.ville, m.pays].filter(Boolean).join(', ') || 'N/A'
    events.push({
      date: m.date_debut,
      type: 'mission',
      title: `Mission — ${lieu}`,
      detail: `Initiateur : ${m.initiateur_nom || '—'} · Statut : ${m.statut || '—'}`,
    })
  })

  // --- Évaluations validées ---
  evaluations?.filter(e => isStatutValide(e.statut) || e.note_finale != null).forEach(e => {
    events.push({
      date: e.date_creation,
      type: 'evaluation',
      title: 'Évaluation de performance',
      detail: [
        e.note_finale != null ? `Note : ${e.note_finale}/100` : null,
        `Statut : ${e.statut || '—'}`,
      ].filter(Boolean).join(' · '),
    })
  })

  // --- Formations (participation confirmée) ---
  formations?.forEach(f => {
    events.push({
      date: f.date,
      type: 'formation',
      title: f.titre || 'Formation',
      detail: [
        f.lieu ? `Lieu : ${f.lieu}` : null,
        `Statut : ${f.statut || '—'}`,
        f.source === 'tache' ? '(Tâche)' : f.source === 'evenement' ? '(Événement)' : '(Mission)',
      ].filter(Boolean).join(' · '),
    })
  })

  // --- Mesures disciplinaires ---
  mesures?.forEach(m => {
    const labels = { blame: 'Blâme', avertissement: 'Avertissement', sanction: 'Sanction', conseil_discipline: 'Conseil de discipline' }
    events.push({
      date: m.date_mesure || m.created_at,
      type: 'disciplinaire',
      title: labels[m.type_mesure] || m.type_mesure,
      detail: m.motif,
    })
  })

  // Tri chronologique ascendant (le plus ancien en tête)
  return events.sort((a, b) => new Date(a.date) - new Date(b.date))
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
  const [missionsMisso, setMissionsMisso] = useState([])
  const [parcours, setParcours] = useState([])
  const [mesures, setMesures] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [formations, setFormations] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('tous')
  const [scoreData, setScoreData] = useState(null)

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
      api.get(`/api/conges/historique/${selectedMatricule}`).catch(() => ({ data: [] })),
      api.get(`/api/missions/en-tant-que-missionnaire/${selectedMatricule}`).catch(() => ({ data: [] })),
      api.get(`/employees/${selectedMatricule}/parcours`).catch(() => ({ data: [] })),
      api.get(`/api/disciplinaire/employe/${selectedMatricule}`).catch(() => ({ data: [] })),
      api.get(`/api/evaluations/mes-evaluations/${selectedMatricule}`).catch(() => ({ data: [] })),
      api.get(`/employees/${selectedMatricule}/formations`).catch(() => ({ data: [] })),
      api.get(`/api/scores/employe/${selectedMatricule}`).catch(() => ({ data: null })),
    ]).then(([empRes, congesRes, missoRes, parcoursRes, mesuresRes, evalsRes, formRes, scoreRes]) => {
      setEmployee(empRes?.data || null)
      const toArr = (d) => Array.isArray(d) ? d : (d?.items || d?.conges || d?.missions || d?.evaluations || [])
      setConges(toArr(congesRes?.data))
      setMissionsMisso(toArr(missoRes?.data))
      setParcours(toArr(parcoursRes?.data))
      setMesures(toArr(mesuresRes?.data))
      setEvaluations(toArr(evalsRes?.data))
      setFormations(toArr(formRes?.data))
      setScoreData(scoreRes?.data?.score_global !== undefined ? scoreRes.data : null)
    }).finally(() => setLoading(false))
  }, [selectedMatricule])

  const filteredEmployees = employees.filter(e => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (e.prenom + ' ' + e.nom).toLowerCase().includes(q) || String(e.matricule).includes(q)
  })

  const timeline = buildTimeline(employee, conges, missionsMisso, parcours, mesures, evaluations, formations)
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
      <div style={{ background: 'linear-gradient(90deg, #02162e 0%, #02162e 50%, #0a2e57 72%, #274a73 100%)', color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
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
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', height: 'fit-content' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem', boxSizing: 'border-box' }}
                  placeholder="Rechercher un employé..."
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {filteredEmployees.map(e => (
                <button key={e.matricule} onClick={() => setSelectedMatricule(e.matricule)} style={{
                  width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid #f1f5f9',
                  background: String(selectedMatricule) === String(e.matricule) ? '#fef2f2' : 'white', cursor: 'pointer', textAlign: 'left',
                  borderLeft: String(selectedMatricule) === String(e.matricule) ? `3px solid ${ACCENT}` : '3px solid transparent',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.85rem' }}>{e.prenom} {e.nom}</div>
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
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
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

              {/* Score Comportemental */}
              {scoreData && (() => {
                const dims = scoreData.dimensions || {}
                const dimList = [
                  { key: 'delai_validation',        label: 'Délai validation', color: '#021630' },
                  { key: 'participation_evenements', label: 'Participation',     color: '#063e7a' },
                  { key: 'engagement_app',           label: 'Engagement',        color: '#0d5faa' },
                  { key: 'esprit_equipe',            label: 'Esprit équipe',     color: '#2880c8' },
                ]
                const g = scoreData.score_global
                const gColor = g >= 80 ? '#021630' : g >= 50 ? '#4a5568' : '#ce2b2b'
                return (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.88rem', color: DARK }}>
                        <BarChart2 size={16} color={ACCENT} /> Score Comportemental
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                          {scoreData.periode}
                        </span>
                      </div>
                      <div style={{
                        fontWeight: 800, fontSize: '1.05rem', color: gColor,
                        background: g >= 80 ? '#d0dff0' : g >= 50 ? '#edf2f7' : '#fde8e8',
                        padding: '4px 12px', borderRadius: 8,
                      }}>
                        {g} / 100
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      {dimList.map(d => {
                        const v = dims[d.key]?.valeur ?? 0
                        const vColor = v < 50 ? '#ce2b2b' : d.color
                        return (
                          <div key={d.key}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: '#475569', marginBottom: 3 }}>
                              <span style={{ fontWeight: 600 }}>{d.label}</span>
                              <span style={{ fontWeight: 700, color: vColor }}>{v}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(v, 100)}%`, background: vColor, borderRadius: 99, transition: 'width 0.5s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

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
                <div style={{ textAlign: 'center', padding: '40px 24px', color: '#94a3b8', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
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
                        <div style={{ background: 'var(--card)', border: `1px solid ${type.color}33`, borderLeft: `3px solid ${type.color}`, borderRadius: 8, padding: '10px 14px' }}>
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
