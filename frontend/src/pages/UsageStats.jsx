import React, { useState, useEffect } from 'react'
import api from '../services/api'
import '../styles/UsageStats.css'
import { BarChart2, Calendar, TrendingUp, CalendarDays, RefreshCw, ChevronRight, Home } from 'lucide-react'
function HBar({ label, minutes, maxMinutes, highlight, onClick }) {
  const pct = minutes > 0 && maxMinutes > 0 ? Math.max(2, Math.round((minutes / maxMinutes) * 100)) : 0
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const timeLabel = minutes === 0 ? '0 min' : (h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`)
  return (
    <div className={`usage-hbar-row ${highlight ? 'highlight' : ''} ${onClick ? 'drillable' : ''}`}
         onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
         onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}>
      <div className="usage-hbar-label" title={label}>{label}</div>
      <div className="usage-hbar-track">
        {pct > 0 ? (
          <div className="usage-hbar-fill" style={{ width: `${pct}%`, background: highlight ? 'linear-gradient(90deg,#7c3aed,#a855f7)' : undefined }}>
            <span className="usage-hbar-val">{timeLabel}</span>
          </div>
        ) : (
          <span className="usage-hbar-zero">0 min</span>
        )}
      </div>
      {onClick && <ChevronRight size={14} className="usage-hbar-chevron" />}
    </div>
  )
}

const DIM_ORDER = ['entite', 'direction', 'dept', 'emp']
const DIM_LABELS = { entite: 'Entités', direction: 'Directions', dept: 'Départements', emp: 'Employés' }
const CHILD_DIM = { entite: 'direction', direction: 'dept', dept: 'emp', emp: null }

export default function UsageStats() {
  const DIM_LABELS = { entite: "Entités", direction: "Directions", dept: "Départements", emp: "Employés" }
  const [activePeriod, setActivePeriod] = useState('today')
  const [selectedUser, setSelectedUser] = useState('')
  const [usageData, setUsageData] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [error, setError] = useState('')
  // drillStack: [{dim, id, label}]  — represents path taken (entite clicked, then direction clicked…)
  const [drillStack, setDrillStack] = useState([])
  const [viewMode, setViewMode] = useState('employe')  // 'employe' | 'entite' | 'direction' | 'dept'
  const [orgVal, setOrgVal] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      if (userData.role && ['RH', 'DG', 'PCA', 'ADMIN', 'AG'].includes(userData.role)) {
        setSelectedUser(userData.matricule)
      }
    }
    loadEmployees()
    loadSummary()
  }, [])

  // Reset drill when period changes
  useEffect(() => { setDrillStack([]) }, [activePeriod])
  // Reset org value when mode changes
  useEffect(() => { setOrgVal('') }, [viewMode])

  useEffect(() => {
    if (viewMode === 'employe' && selectedUser) loadUsageData()
  }, [activePeriod, selectedUser])

  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees/')
      setEmployees(res.data || [])
    } catch { /* silencieux */ }
  }

  const loadSummary = async () => {
    setSummaryLoading(true)
    try {
      const res = await api.get('/employees/stats/usage/all/summary')
      setSummaryData(res.data)
    } catch { /* silencieux */ }
    finally { setSummaryLoading(false) }
  }

  const loadUsageData = async () => {
    if (!selectedUser) return
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/employees/stats/usage/${selectedUser}/${activePeriod}`)
      setUsageData(res.data)
    } catch (err) {
      setError('Erreur: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes) => {
    if (!minutes) return '0h 0min'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}min`
  }

  // Current dimension shown = child of last drilled item, or 'entite' at root
  const curDim = drillStack.length === 0 ? 'entite' : (CHILD_DIM[drillStack[drillStack.length - 1].dim] || 'emp')

  // Filter ranking by drill context
  const getFilteredRanking = () => {
    if (!summaryData) return []
    const ranking = (summaryData[activePeriod] || {}).ranking || {}
    const list = ranking[curDim] || []
    if (drillStack.length === 0) return list

    const last = drillStack[drillStack.length - 1]
    // Build set of valid child IDs from employees table
    let validIds = new Set()
    if (last.dim === 'entite') {
      employees.filter(e => String(e.id_entite) === last.id).forEach(e => { if (e.id_direction) validIds.add(String(e.id_direction)) })
    } else if (last.dim === 'direction') {
      employees.filter(e => String(e.id_direction) === last.id).forEach(e => { if (e.dept_id) validIds.add(String(e.dept_id)) })
    } else if (last.dim === 'dept') {
      employees.filter(e => String(e.dept_id) === last.id).forEach(e => { if (e.matricule) validIds.add(String(e.matricule)) })
    }
    return list.filter(r => validIds.has(r.id))
  }

  const drill = (row) => {
    if (!CHILD_DIM[curDim]) return // leaf node
    setDrillStack([...drillStack, { dim: curDim, id: row.id, label: row.label }])
  }

  const popTo = (idx) => setDrillStack(drillStack.slice(0, idx))

  const getRanking = getFilteredRanking()
  const maxMinutes = getRanking.length > 0 ? getRanking[0].minutes : 0

  // Highlight current user at employee level
  const isHighlighted = (row) => curDim === 'emp' && String(row.id) === String(selectedUser)

  // Org view: options and selected stats from summaryData.ranking
  const orgOptions = (() => {
    if (viewMode === 'employe' || !summaryData) return []
    const dim = viewMode === 'dept' ? 'dept' : viewMode
    return [...(summaryData[activePeriod]?.ranking?.[dim] || [])]
      .sort((a, b) => a.label.localeCompare(b.label))
  })()

  const orgStats = (() => {
    if (viewMode === 'employe' || !orgVal || !summaryData) return null
    const dim = viewMode === 'dept' ? 'dept' : viewMode
    return (summaryData[activePeriod]?.ranking?.[dim] || []).find(r => r.id === orgVal) || null
  })()

  const sortedEmployees = [...employees].sort((a, b) =>
    `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`)
  )

  return (
    <div className="usage-stats-container">
      <header className="usage-header">
        <h1 style={{display:'flex',alignItems:'center',gap:8}}><BarChart2 size={22}/> {"Statistiques d'usage"}</h1>
        <p>{"Statistiques d'utilisation de la plateforme"}</p>
      </header>

      <div className="usage-content">
        {/* Selector row */}
        <div className="user-selection">
          <select value={viewMode} onChange={e => setViewMode(e.target.value)}
            className="user-select" style={{width:'auto', minWidth:155}}>
            <option value="employe">{"Par employé"}</option>
            <option value="entite">{"Par entité"}</option>
            <option value="direction">{"Par direction"}</option>
            <option value="dept">{"Par département"}</option>
          </select>
          {viewMode === 'employe' ? (
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="user-select">
              <option value="">— Choisir un employé —</option>
              {sortedEmployees.map(emp => (
                <option key={emp.matricule} value={emp.matricule}>
                  {emp.prenom} {emp.nom} ({emp.matricule})
                </option>
              ))}
            </select>
          ) : (
            <select value={orgVal} onChange={e => setOrgVal(e.target.value)}
              className="user-select" style={{minWidth:165}}>
              <option value="">— Choisir —</option>
              {orgOptions.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          )}
          <button onClick={() => { if (viewMode === 'employe') loadUsageData(); loadSummary() }} className="period-btn"
            style={{marginLeft:'auto', borderColor:'#667eea', color:'#667eea'}} disabled={loading || summaryLoading}>
            <RefreshCw size={13} style={{marginRight:4,verticalAlign:'middle'}}/> {"Rafraîchir"}
          </button>
        </div>

        {/* Period Selection */}
        <div className="period-buttons">
          {[
            { key:'today', icon:<Calendar size={13}/>, label:"Aujourd'hui" },
            { key:'week',  icon:<CalendarDays size={13}/>, label:"Semaine" },
            { key:'month', icon:<BarChart2 size={13}/>, label:"Mois" },
            { key:'year',  icon:<TrendingUp size={13}/>, label:"Année" },
          ].map(({key, icon, label}) => (
            <button key={key} onClick={() => setActivePeriod(key)}
              className={`period-btn ${activePeriod === key ? 'active' : ''}`}>
              <span style={{marginRight:4,verticalAlign:'middle'}}>{icon}</span>{label}
            </button>
          ))}
        </div>

        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loading">{"Chargement..."}</div>}

        {/* Org aggregate stats */}
        {viewMode !== 'employe' && orgStats && (
          <div className="usage-cards">
            <div className="stat-card large">
              <div className="stat-label">{"Temps total"} — {orgStats.label}</div>
              <div className="stat-value">{Math.floor(orgStats.minutes / 60)} heures</div>
              <div className="stat-minutes">{orgStats.minutes} minutes</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{"Nombre de Sessions"}</div>
              <div className="stat-value">{orgStats.sessions}</div>
              <div className="stat-minutes">Connexions</div>
            </div>
          </div>
        )}

        {/* Individual employee stats */}
        {viewMode === 'employe' && usageData && !loading && (
          <div className="usage-cards">
            <div className="stat-card large">
              <div className="stat-label">{"Temps total"}</div>
              <div className="stat-value">{usageData.total_hours} heures</div>
              <div className="stat-minutes">{usageData.total_minutes} minutes</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{"Nombre de Sessions"}</div>
              <div className="stat-value">{usageData.sessions_count}</div>
              <div className="stat-minutes">Connexions</div>
            </div>

            {usageData.daily_breakdown && (
              <div className="stat-card full-width">
                <div className="stat-label">{"Répartition journalière"}</div>
                <div className="breakdown-content">
                  {Object.entries(usageData.daily_breakdown).map(([day, minutes]) => (
                    <div key={day} className="breakdown-item">
                      <span className="day-label">{day}</span>
                      <div className="usage-bar">
                        <div className="bar-fill" style={{ width: `${Math.min(100,(minutes / 480) * 100)}%` }}></div>
                      </div>
                      <span className="time-label">{formatTime(minutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {usageData.monthly_breakdown && (
              <div className="stat-card full-width">
                <div className="stat-label">{"Répartition mensuelle"}</div>
                <div className="breakdown-content">
                  {Object.entries(usageData.monthly_breakdown).map(([month, minutes]) => {
                    const names = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
                    return (
                      <div key={month} className="breakdown-item">
                        <span className="day-label">{names[parseInt(month)]}</span>
                        <div className="usage-bar">
                          <div className="bar-fill" style={{ width: `${Math.min(100,(minutes / 14400) * 100)}%` }}></div>
                        </div>
                        <span className="time-label">{formatTime(minutes)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Roll-up Histogram */}
        {summaryData && !summaryLoading && (
          <div className="comparison-card">
            {/* Breadcrumb */}
            <div className="rollup-breadcrumb">
              <button className="breadcrumb-item root" onClick={() => setDrillStack([])}>
                <Home size={12}/> {DIM_LABELS['entite']}
              </button>
              {drillStack.map((step, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight size={12} className="breadcrumb-sep"/>
                  <button className="breadcrumb-item" onClick={() => popTo(idx + 1)}>
                    {step.label}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Current level title */}
            <div className="comparison-title" style={{marginTop:10}}>
              Classement — {DIM_LABELS[curDim]}
              {CHILD_DIM[curDim] && (
                <span className="rollup-hint">Cliquez sur une ligne pour voir ses {DIM_LABELS[CHILD_DIM[curDim]]}</span>
              )}
            </div>

            <div className="comparison-body">
              {getRanking.length === 0 ? (
                <div style={{padding:'20px 0', textAlign:'center', color:'#aaa', fontSize:13}}>Aucune donnée</div>
              ) : (
                getRanking.map((row, i) => (
                  <HBar key={i}
                    label={row.label}
                    minutes={row.minutes}
                    maxMinutes={maxMinutes}
                    highlight={isHighlighted(row)}
                    onClick={CHILD_DIM[curDim] ? () => drill(row) : null}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {viewMode === 'employe' && !selectedUser && !loading && (
          <div className="no-data"><p>Sélectionnez un employé pour voir ses statistiques</p></div>
        )}
        {viewMode !== 'employe' && !orgVal && !summaryLoading && (
          <div className="no-data"><p>Sélectionnez une valeur pour voir les statistiques</p></div>
        )}
      </div>
    </div>
  )
}
