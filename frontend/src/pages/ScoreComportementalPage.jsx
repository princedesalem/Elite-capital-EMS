import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { useToast } from '../components/ui/ToastProvider'
import AIInsightPanel from '../components/AIInsightPanel'
import { BarChart2, RefreshCw, Users, Clock, Calendar, Star, TrendingUp, Search, ChevronDown, ChevronUp, Award } from 'lucide-react'

const DARK = '#021630'
const ROLES_RH = ['RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA']

const DIMENSIONS = [
  {
    key: 'delai_validation',
    label: 'Délai de validation',
    icon: Clock,
    desc: '% de validations effectuées en moins de 3h',
    color: '#0284c7',
    bg: '#f0f9ff',
  },
  {
    key: 'participation_evenements',
    label: 'Participation événements',
    icon: Calendar,
    desc: '% de présence confirmée aux événements inscrits',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
  {
    key: 'engagement_app',
    label: 'Engagement application',
    icon: TrendingUp,
    desc: 'Fréquence d\'utilisation mensuelle (20 connexions = 100%)',
    color: '#7c3aed',
    bg: '#faf5ff',
  },
  {
    key: 'esprit_equipe',
    label: 'Esprit d\'équipe',
    icon: Star,
    desc: 'Moyenne des évaluations 360° reçues',
    color: '#d97706',
    bg: '#fffbeb',
  },
]

function scoreColor(v) {
  if (v >= 80) return '#16a34a'
  if (v >= 55) return '#d97706'
  return '#ce2b2b'
}

function scoreBg(v) {
  if (v >= 80) return '#f0fdf4'
  if (v >= 55) return '#fffbeb'
  return '#fef2f2'
}

function scoreLabel(v) {
  if (v >= 80) return 'Excellent'
  if (v >= 65) return 'Bien'
  if (v >= 50) return 'Moyen'
  return 'Insuffisant'
}

function GaugeBar({ value, color, bg }) {
  return (
    <div style={{ position: 'relative', height: 10, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${Math.min(value, 100)}%`,
        background: color,
        borderRadius: 99,
        transition: 'width 0.6s ease',
      }} />
    </div>
  )
}

function CircleScore({ value, size = 80 }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const progress = circ - (Math.min(value, 100) / 100) * circ
  const color = scoreColor(value)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontWeight: 800, fontSize: size * 0.22, color, lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: size * 0.14, color: '#94a3b8', fontWeight: 600 }}>/100</span>
      </div>
    </div>
  )
}

function DimensionCard({ dim, data, modeVue = 'mois' }) {
  const DimIcon = dim.icon
  const val = data?.valeur ?? 0
  const detail = data || {}

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: dim.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <DimIcon size={18} color={dim.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: DARK }}>{dim.label}</div>
          <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{dim.desc}</div>
        </div>
        <div style={{
          fontWeight: 800, fontSize: '1.1rem', color: scoreColor(val),
          background: scoreBg(val), borderRadius: 8, padding: '4px 10px',
          minWidth: 52, textAlign: 'center',
        }}>
          {val}
        </div>
      </div>

      <GaugeBar value={val} color={dim.color} />

      {/* Détail selon dimension */}
      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {dim.key === 'delai_validation' && (
          detail.total === 0
            ? <span style={{ color: '#94a3b8' }}>Aucune validation {modeVue === 'annee' ? 'cette année' : 'ce mois'}</span>
            : detail.total > 0 && <>
                <span style={{ background: '#eef4fb', color: '#021630', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  ✓ {detail.rapides ?? 0} rapide{(detail.rapides ?? 0) !== 1 ? 's' : ''}
                </span>
                <span style={{ background: (detail.total - (detail.rapides ?? 0)) > 0 ? '#fef2f2' : '#f1f5f9', color: (detail.total - (detail.rapides ?? 0)) > 0 ? '#ce2b2b' : '#64748b', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  ✗ {detail.total - (detail.rapides ?? 0)} hors délai
                </span>
                <span style={{ color: '#94a3b8' }}>sur {detail.total} total</span>
              </>
        )}
        {dim.key === 'participation_evenements' && (
          detail.total === 0
            ? <span style={{ color: '#94a3b8' }}>Aucune inscription {modeVue === 'annee' ? 'cette année' : 'ce mois'}</span>
            : detail.total > 0 && <>
                <span style={{ background: '#eef4fb', color: '#021630', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  ✓ {detail.presents ?? 0} présent{(detail.presents ?? 0) !== 1 ? 's' : ''}
                </span>
                <span style={{ background: (detail.absents ?? 0) > 0 ? '#fef2f2' : '#f1f5f9', color: (detail.absents ?? 0) > 0 ? '#ce2b2b' : '#64748b', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  ✗ {detail.absents ?? 0} absent{(detail.absents ?? 0) !== 1 ? 's' : ''}
                </span>
                <span style={{ color: '#94a3b8' }}>sur {detail.total} inscrit{detail.total !== 1 ? 's' : ''}</span>
              </>
        )}
        {dim.key === 'engagement_app' && detail.connexions !== undefined && (
          <><span>{detail.connexions} connexion(s) {modeVue === 'annee' ? 'cette année' : 'ce mois'}</span></>
        )}
        {dim.key === 'esprit_equipe' && detail.nb_evaluateurs !== undefined && (
          <><span>{detail.nb_evaluateurs} évaluateur(s) 360°</span></>
        )}
      </div>
    </div>
  )
}

function EmployeeScoreCard({ emp, score, onSelect, selected }) {
  const global = score?.score_global ?? null

  return (
    <div
      onClick={() => onSelect(emp)}
      style={{
        background: selected ? '#f0f9ff' : '#fff',
        border: selected ? '2px solid #0284c7' : '1px solid #e2e8f0',
        borderRadius: 10, padding: '12px 16px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: DARK, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.9rem',
      }}>
        {(emp.prenom?.[0] || '') + (emp.nom?.[0] || '')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: DARK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {emp.prenom} {emp.nom}
        </div>
        <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{emp.fonction || 'N/R'}</div>
      </div>
      {global !== null ? (
        <div style={{
          fontWeight: 800, fontSize: '1rem', color: scoreColor(global),
          background: scoreBg(global), borderRadius: 8,
          padding: '4px 10px', flexShrink: 0,
        }}>
          {global}
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</div>
      )}
    </div>
  )
}

export default function ScoreComportementalPage() {
  const { user } = useAuth()
  const toast = useToast()
  const role = String(user?.role || '').toUpperCase()
  const isRH = ROLES_RH.includes(role)

  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [scoreData, setScoreData] = useState(null)
  const [loadingScore, setLoadingScore] = useState(false)
  const [periode, setPeriode] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [modeVue, setModeVue] = useState('mois') // 'mois' | 'annee'
  const [annee, setAnnee] = useState(() => new Date().getFullYear())
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [batchResult, setBatchResult] = useState(null)

  useEffect(() => {
    if (isRH) {
      api.get('/employees/').then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.employees || [])
        setEmployees(list.filter(e => {
          const s = String(e.statut_employe || e.statut || '').toUpperCase()
          return s === 'ACTIF'
        }))
      }).catch(() => setEmployees([]))
    } else {
      // employé = seulement son propre score
      setSelected({ matricule: user?.matricule, prenom: user?.prenom, nom: user?.nom, fonction: user?.fonction })
    }
  }, [isRH])

  useEffect(() => {
    if (selected) loadScore(selected.matricule)
  }, [selected, periode, modeVue, annee])

  const loadScore = async (matricule) => {
    setLoadingScore(true)
    setScoreData(null)
    try {
      const url = modeVue === 'annee'
        ? `/api/scores/employe/${matricule}/annee/${annee}`
        : `/api/scores/employe/${matricule}?periode=${periode}`
      const r = await api.get(url)
      setScoreData(r.data)
    } catch (err) {
      toast.error('Impossible de charger le score.')
    } finally {
      setLoadingScore(false)
    }
  }

  const recalculerTous = async () => {
    setLoadingBatch(true)
    setBatchResult(null)
    try {
      const r = await api.post(`/api/scores/recalcul-tous?periode=${periode}`)
      setBatchResult(r.data)
      toast.success(`Recalcul effectué : ${r.data.recalcules} employé(s) mis à jour.`)
    } catch {
      toast.error('Erreur lors du recalcul batch.')
    } finally {
      setLoadingBatch(false)
    }
  }

  const filtered = employees.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (e.nom || '').toLowerCase().includes(q) ||
      (e.prenom || '').toLowerCase().includes(q) ||
      (e.fonction || '').toLowerCase().includes(q)
  })

  const dims = scoreData?.dimensions || {}

  // Options mois (12 mois de l'année sélectionnée) et années (5 dernières)
  const now = new Date()
  const moisOptions = []
  const lastMois = annee === now.getFullYear() ? now.getMonth() : 11 // jusqu'à décembre pour les années passées
  for (let m = lastMois; m >= 0; m--) {
    const d = new Date(annee, m, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    moisOptions.push({ val, label })
  }
  const anneeOptions = []
  for (let i = 0; i < 5; i++) anneeOptions.push(now.getFullYear() - i)

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Award size={22} /> Score Comportemental
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
              Notation automatique : délai validation · participation événements · engagement · esprit d'équipe
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Toggle mois / année */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 3 }}>
              {[{ key: 'mois', label: 'Par mois' }, { key: 'annee', label: 'Par année' }].map(opt => (
                <button key={opt.key} onClick={() => setModeVue(opt.key)}
                  style={{ padding: '5px 13px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    background: modeVue === opt.key ? '#fff' : 'transparent',
                    color: modeVue === opt.key ? DARK : 'rgba(255,255,255,0.75)',
                    transition: 'all 0.15s' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Sélecteur mois ou année */}
            {modeVue === 'mois' ? (
              <select value={periode} onChange={e => setPeriode(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 8, border: 'none', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer' }}>
                {moisOptions.map(m => <option key={m.val} value={m.val} style={{ background: DARK }}>{m.label}</option>)}
              </select>
            ) : (
              <select value={annee} onChange={e => {
                const y = Number(e.target.value)
                setAnnee(y)
                // Synchroniser la période au dernier mois disponible de cette année
                const maxMois = y === now.getFullYear() ? now.getMonth() : 11
                setPeriode(`${y}-${String(maxMois + 1).padStart(2, '0')}`)
              }}
                style={{ padding: '7px 12px', borderRadius: 8, border: 'none', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer' }}>
                {anneeOptions.map(y => <option key={y} value={y} style={{ background: DARK }}>{y}</option>)}
              </select>
            )}
            {isRH && (
              <button
                onClick={recalculerTous}
                disabled={loadingBatch}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1.5px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.12)',
                  color: '#fff', cursor: loadingBatch ? 'not-allowed' : 'pointer',
                  fontSize: '0.83rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  opacity: loadingBatch ? 0.7 : 1,
                }}
              >
                <RefreshCw size={14} className={loadingBatch ? 'spin' : ''} />
                Recalculer tous
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      <div style={{ marginBottom: 20 }}>
        <AIInsightPanel
          page="score_comportemental"
          filters={{
            annee: modeVue === 'annee' ? Number(annee) : Number(String(periode).slice(0, 4)),
            mois: modeVue === 'mois' ? Number(String(periode).slice(5, 7)) : undefined,
            mode_vue: modeVue,
          }}
          lang="fr"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isRH ? '280px 1fr' : '1fr', gap: 20 }}>
        {/* Colonne gauche — liste employés (RH seulement) */}
        {isRH && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un employé…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px 8px 32px',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  fontSize: '0.84rem', background: '#fff',
                }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 2 }}>
              {filtered.length} employé(s) actif(s)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {filtered.map(emp => (
                <EmployeeScoreCard
                  key={emp.matricule}
                  emp={emp}
                  score={selected?.matricule === emp.matricule ? scoreData : null}
                  onSelect={setSelected}
                  selected={selected?.matricule === emp.matricule}
                />
              ))}
              {filtered.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '0.84rem', textAlign: 'center', padding: '20px 0' }}>
                  Aucun résultat
                </div>
              )}
            </div>
          </div>
        )}

        {/* Colonne droite — détail score */}
        <div>
          {!selected && isRH && (
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: '48px 24px', textAlign: 'center', color: '#94a3b8',
            }}>
              <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Sélectionnez un employé pour afficher son score</p>
            </div>
          )}

          {selected && (
            <>
              {/* En-tête employé */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: DARK, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1.2rem',
                  }}>
                    {(selected.prenom?.[0] || '') + (selected.nom?.[0] || '')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: DARK }}>
                      {selected.prenom} {selected.nom}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{selected.fonction || 'N/R'} · Mat. {selected.matricule}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                      Période : {modeVue === 'annee' ? annee : new Date(periode + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  {scoreData && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <CircleScore value={scoreData.score_global} size={90} />
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700,
                        color: scoreColor(scoreData.score_global),
                        background: scoreBg(scoreData.score_global),
                        padding: '3px 10px', borderRadius: 99,
                      }}>
                        {scoreLabel(scoreData.score_global)}
                      </span>
                    </div>
                  )}
                  {loadingScore && (
                    <div style={{ width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      <RefreshCw size={22} className="spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* 4 dimensions */}
              {scoreData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {DIMENSIONS.map(dim => (
                    <DimensionCard key={dim.key} dim={dim} data={dims[dim.key]} modeVue={modeVue} />
                  ))}
                </div>
              )}

              {/* Explication des règles */}
              {scoreData && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: DARK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={15} /> Règles de notation
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                    {DIMENSIONS.map(dim => (
                      <div key={dim.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.78rem', color: '#475569' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dim.color, flexShrink: 0, marginTop: 4 }} />
                        <div><strong>{dim.label} :</strong> {dim.desc}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.78rem', color: '#ce2b2b' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ce2b2b', flexShrink: 0, marginTop: 4 }} />
                      <div><strong>Règle délai :</strong> Tout valideur doit valider en moins de 3h — au-delà, la note baisse automatiquement.</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
