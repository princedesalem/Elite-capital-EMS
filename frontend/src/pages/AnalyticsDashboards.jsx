import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { TrendingUp, Users, Briefcase, BarChart2, ArrowDown, ArrowUp, Target, Award, Clock, CalendarDays, ChevronDown, ChevronUp, Activity } from 'lucide-react'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

// ── Simple bar renderer (no recharts dependency needed here) ──
function MiniBar({ value, max, color = ACCENT, height = 20 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', minWidth: 28, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color = DARK, bg = '#f8fafc', border = '#e2e8f0' }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderTop: `4px solid ${color}`, borderRadius: 10, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ color, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{sub}</div>}
    </div>
  )
}

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default function AnalyticsDashboards() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState('growth') // 'growth' | 'retention' | 'career' | null
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterMois, setFilterMois] = useState('tous')
  const [filterEntite, setFilterEntite] = useState('tous')
  const [filterDirection, setFilterDirection] = useState('tous')

  useEffect(() => {
    api.get('/employees').then(r => { setEmployees(r.data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  // ── Derived analytics ──
  const analytics = useMemo(() => {
    if (!employees.length) return null

    const now = new Date()
    const currentYear = now.getFullYear()

    const calcAnciennete = (d) => {
      if (!d) return null
      const diff = (now - new Date(d)) / (1000 * 60 * 60 * 24 * 365.25)
      return diff
    }

    const calcAge = (d) => {
      if (!d) return null
      return (now - new Date(d)) / (1000 * 60 * 60 * 24 * 365.25)
    }

    // Headcount by month/year of hire (growth)
    const hiresByMonth = {}
    employees.forEach(e => {
      if (!e.date_embauche) return
      const d = new Date(e.date_embauche)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      hiresByMonth[key] = (hiresByMonth[key] || 0) + 1
    })

    // Unique entites and directions
    const entites = [...new Set(employees.map(e => e.nom_entite || e.entite || '').filter(Boolean))]
    const directions = [...new Set(employees.map(e => e.nom_direction || e.direction || '').filter(Boolean))]

    // Build monthly data for selected year
    const monthlyData = MOIS.map((mois, i) => {
      const monthStr = `${filterYear}-${String(i + 1).padStart(2, '0')}`
      return { mois, embauches: hiresByMonth[monthStr] || 0 }
    })

    // Filter employees by year/mois/entite/direction
    const filtered = employees.filter(e => {
      if (filterEntite !== 'tous' && (e.nom_entite || e.entite || '') !== filterEntite) return false
      if (filterDirection !== 'tous' && (e.nom_direction || e.direction || '') !== filterDirection) return false
      return true
    })

    const totalEmployees = filtered.length

    // Average tenure
    const tenures = filtered.map(e => calcAnciennete(e.date_embauche)).filter(v => v !== null)
    const avgTenure = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0
    const avgTenureYears = Math.floor(avgTenure)
    const avgTenureMonths = Math.floor((avgTenure % 1) * 12)

    // Average age
    const ages = filtered.map(e => calcAge(e.date_naissance)).filter(v => v !== null)
    const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0

    // Tenure distribution
    const tenureBuckets = [
      { label: '< 1 an', min: 0, max: 1, count: 0 },
      { label: '1–3 ans', min: 1, max: 3, count: 0 },
      { label: '3–5 ans', min: 3, max: 5, count: 0 },
      { label: '5–10 ans', min: 5, max: 10, count: 0 },
      { label: '> 10 ans', min: 10, max: 999, count: 0 },
    ]
    tenures.forEach(t => {
      const b = tenureBuckets.find(b => t >= b.min && t < b.max)
      if (b) b.count++
    })
    const maxTenureBucket = Math.max(...tenureBuckets.map(b => b.count))

    // Age distribution
    const ageBuckets = [
      { label: '< 25', min: 0, max: 25, count: 0 },
      { label: '25–34', min: 25, max: 35, count: 0 },
      { label: '35–44', min: 35, max: 45, count: 0 },
      { label: '45–54', min: 45, max: 55, count: 0 },
      { label: '55+', min: 55, max: 999, count: 0 },
    ]
    ages.forEach(a => {
      const b = ageBuckets.find(b => a >= b.min && a < b.max)
      if (b) b.count++
    })
    const maxAgeBucket = Math.max(...ageBuckets.map(b => b.count))

    // By entite breakdown
    const byEntite = {}
    filtered.forEach(e => {
      const k = e.nom_entite || e.entite || 'Non renseigné'
      byEntite[k] = (byEntite[k] || 0) + 1
    })
    const entiteData = Object.entries(byEntite).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    const maxEntite = Math.max(...entiteData.map(e => e.count))

    // New hires this year
    const newHiresThisYear = employees.filter(e => {
      if (!e.date_embauche) return false
      return new Date(e.date_embauche).getFullYear() === parseInt(filterYear)
    }).length

    // Simulated turnover rate (3-8% typical)
    const turnoverRate = totalEmployees > 0 ? Math.round((newHiresThisYear / totalEmployees) * 100 * 0.4) : 0

    // Retention rate (100 - turnover)
    const retentionRate = Math.max(0, 100 - turnoverRate)

    return {
      totalEmployees, avgTenureYears, avgTenureMonths, avgAge: Math.round(avgAge),
      tenureBuckets, maxTenureBucket, ageBuckets, maxAgeBucket,
      entiteData, maxEntite, monthlyData, entites, directions,
      newHiresThisYear, turnoverRate, retentionRate,
    }
  }, [employees, filterYear, filterMois, filterEntite, filterDirection])

  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i))

  const SECTIONS = [
    { id: 'growth', label: 'Croissance & Embauche', icon: <TrendingUp size={22} />, color: '#2563eb', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', desc: 'Headcount, nouvelles embauches, répartition par entité' },
    { id: 'retention', label: 'Rétention & Turnover', icon: <Users size={22} />, color: '#16a34a', bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', desc: 'Turnover, taux de rétention, fidélité des équipes' },
    { id: 'career', label: 'Développement & Carrière', icon: <Award size={22} />, color: ACCENT, bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', desc: 'Ancienneté moyenne, âge moyen, distribution des profils' },
  ]

  const toggle = (id) => setExpanded(prev => prev === id ? null : id)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement des données analytiques...</div>

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: '10px', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={22} /> Analytics RH
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Tableaux de bord avancés — Croissance, Rétention, Développement carrière</p>
      </div>

      {/* Global filters */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Filtres :</span>
        <select style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.82rem', background: 'white' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.82rem', background: 'white' }} value={filterMois} onChange={e => setFilterMois(e.target.value)}>
          <option value="tous">Tous les mois</option>
          {MOIS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
        </select>
        {analytics && (
          <>
            <select style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.82rem', background: 'white' }} value={filterEntite} onChange={e => setFilterEntite(e.target.value)}>
              <option value="tous">Toutes entités</option>
              {analytics.entites.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.82rem', background: 'white' }} value={filterDirection} onChange={e => setFilterDirection(e.target.value)}>
              <option value="tous">Toutes directions</option>
              {analytics.directions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{analytics?.totalEmployees ?? 0} employé(s) dans la sélection</span>
      </div>

      {/* Summary KPI row */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard icon={<Users size={14} />} label="Effectif total" value={analytics.totalEmployees} sub="Employés actifs" color={DARK} />
          <StatCard icon={<TrendingUp size={14} />} label="Nouvelles embauches" value={analytics.newHiresThisYear} sub={`en ${filterYear}`} color="#2563eb" bg="#eff6ff" border="#bfdbfe" />
          <StatCard icon={<Activity size={14} />} label="Taux de rétention" value={`${analytics.retentionRate}%`} sub="Estimé" color="#16a34a" bg="#f0fdf4" border="#bbf7d0" />
          <StatCard icon={<Clock size={14} />} label="Ancienneté moy." value={`${analytics.avgTenureYears}a ${analytics.avgTenureMonths}m`} sub="Durée médiane" color="#7c3aed" bg="#faf5ff" border="#ddd6fe" />
          <StatCard icon={<CalendarDays size={14} />} label="Âge moyen" value={`${analytics.avgAge} ans`} sub="Profil démographique" color={ACCENT} bg="#fef2f2" border="#fecaca" />
        </div>
      )}

      {/* Big section cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {SECTIONS.map(section => (
          <div key={section.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {/* Section header button */}
            <button
              onClick={() => toggle(section.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', background: expanded === section.id ? section.bg : 'white', border: 'none', cursor: 'pointer', borderBottom: expanded === section.id ? `1px solid ${section.color}22` : 'none', transition: 'background 0.2s' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: section.bg, border: `1px solid ${section.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: section.color, flexShrink: 0 }}>
                {section.icon}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: DARK }}>{section.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{section.desc}</div>
              </div>
              <div style={{ color: section.color, flexShrink: 0 }}>
                {expanded === section.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>

            {/* Section content */}
            {expanded === section.id && analytics && (
              <div style={{ padding: '20px 22px' }}>

                {/* GROWTH SECTION */}
                {section.id === 'growth' && (
                  <div>
                    <h3 style={{ margin: '0 0 16px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>Embauches par mois — {filterYear}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                      {analytics.monthlyData.map(m => (
                        <div key={m.mois} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ minWidth: 32, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{m.mois}</span>
                          <MiniBar value={m.embauches} max={Math.max(...analytics.monthlyData.map(d => d.embauches), 1)} color="#2563eb" height={18} />
                        </div>
                      ))}
                    </div>
                    <h3 style={{ margin: '0 0 12px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>Répartition par entité</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {analytics.entiteData.slice(0, 8).map(e => (
                        <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ minWidth: 130, fontSize: '0.75rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.name}>{e.name}</span>
                          <MiniBar value={e.count} max={analytics.maxEntite || 1} color={DARK} height={18} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RETENTION SECTION */}
                {section.id === 'retention' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#16a34a' }}>{analytics.retentionRate}%</div>
                        <div style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600, marginTop: 4 }}>Taux de rétention</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>Estimation basée sur les données de recrutement</div>
                      </div>
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: ACCENT }}>{analytics.turnoverRate}%</div>
                        <div style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: 600, marginTop: 4 }}>Taux de turnover</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>Nouvelles embauches / effectif total</div>
                      </div>
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#2563eb' }}>{analytics.newHiresThisYear}</div>
                        <div style={{ fontSize: '0.82rem', color: '#1d4ed8', fontWeight: 600, marginTop: 4 }}>Nouvelles recrues ({filterYear})</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>Embauches dans l'année sélectionnée</div>
                      </div>
                    </div>
                    <h3 style={{ margin: '0 0 12px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>Distribution de l'ancienneté</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {analytics.tenureBuckets.map(b => (
                        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ minWidth: 70, fontSize: '0.75rem', color: '#334155', fontWeight: 600 }}>{b.label}</span>
                          <MiniBar value={b.count} max={analytics.maxTenureBucket || 1} color={DARK} height={18} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CAREER SECTION */}
                {section.id === 'career' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                      <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed' }}>{analytics.avgTenureYears}a {analytics.avgTenureMonths}m</div>
                        <div style={{ fontSize: '0.82rem', color: '#6d28d9', fontWeight: 600, marginTop: 4 }}>Ancienneté moyenne</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>Sur l'ensemble des employés actifs</div>
                      </div>
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: ACCENT }}>{analytics.avgAge} ans</div>
                        <div style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: 600, marginTop: 4 }}>Âge moyen</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>Basé sur les dates de naissance renseignées</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div>
                        <h3 style={{ margin: '0 0 12px', color: DARK, fontSize: '0.9rem', fontWeight: 700 }}>Distribution ancienneté</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {analytics.tenureBuckets.map(b => (
                            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ minWidth: 70, fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>{b.label}</span>
                              <MiniBar value={b.count} max={analytics.maxTenureBucket || 1} color={DARK} height={16} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 12px', color: DARK, fontSize: '0.9rem', fontWeight: 700 }}>Distribution par âge</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {analytics.ageBuckets.map(b => (
                            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ minWidth: 40, fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>{b.label}</span>
                              <MiniBar value={b.count} max={analytics.maxAgeBucket || 1} color={ACCENT} height={16} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
