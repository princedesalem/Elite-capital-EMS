import React, { useState, useEffect } from 'react'
import { BarChart2, Calendar, TrendingUp, CalendarDays, RefreshCw, Users, Building2, GitBranch, Layers } from 'lucide-react'
import api from '../services/api'
import '../styles/AdminUsageStats.css'
const DIM_LABELS_DEFAULT = {
  emp: { label: 'Employés', icon: null },
  dept: { label: 'Départements', icon: null },
  direction: { label: 'Directions', icon: null },
  entite: { label: 'Entités', icon: null },
}

function HorizontalBar({ label, minutes, sessions, maxMinutes }) {
  const pct = minutes > 0 && maxMinutes > 0 ? Math.max(2, Math.round((minutes / maxMinutes) * 100)) : 0
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const timeLabel = minutes === 0 ? '0 min' : (h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`)
  return (
    <div className="hbar-row">
      <div className="hbar-label" title={label}>{label}</div>
      <div className="hbar-track">
        {pct > 0 ? (
          <div className="hbar-fill" style={{ width: `${pct}%` }}>
            <span className="hbar-value-inside">{timeLabel}</span>
          </div>
        ) : (
          <span className="hbar-zero">0 min</span>
        )}
      </div>
      <div className="hbar-sessions">{sessions} sess.</div>
    </div>
  )
}

export default function AdminUsageStats() {
  const DIM_LABELS = {
    emp: { label: "Employés", icon: <Users size={14}/> },
    dept: { label: "Départements", icon: <Layers size={14}/> },
    direction: { label: "Directions", icon: <GitBranch size={14}/> },
    entite: { label: "Entités", icon: <Building2 size={14}/> },
  }
  const [activePeriod, setActivePeriod] = useState('today')
  const [activeDim, setActiveDim] = useState('emp')
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  // Detecte le fuseau du navigateur (ex: Africa/Douala) pour que le filtre
  // "Aujourd'hui" soit aligne avec le calendrier local de l'admin, pas UTC.
  const tz = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
  })()

  const loadSummaryData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/employees/stats/usage/all/summary', { params: tz ? { tz } : {} })
      setSummaryData(res.data)
      setLastUpdated(new Date())
    } catch (err) {
      setError('Erreur: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }, [tz])

  // Chargement initial + auto-refresh toutes les 30s pour refleter les
  // connexions recentes sans avoir a cliquer Rafraichir.
  useEffect(() => {
    loadSummaryData()
    const id = setInterval(loadSummaryData, 30000)
    return () => clearInterval(id)
  }, [loadSummaryData])

  const formatTime = (minutes) => {
    if (!minutes) return '0h 0min'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}min`
  }

  const getPeriodLabel = () => ({
    today: "Aujourd'hui", week: "Semaine", month: "Mois", year: "Année"
  })[activePeriod] || activePeriod

  const getStats = () => summaryData ? (summaryData[activePeriod] || {}) : {}

  const getRanking = () => {
    const stats = getStats()
    return (stats.ranking || {})[activeDim] || []
  }

  return (
    <div className="admin-usage-container">
      <header className="admin-header">
        <h1 style={{display:'flex',alignItems:'center',gap:8}}><BarChart2 size={22}/> {"Usage administration"}</h1>
        <p>{"Statistiques d'utilisation — vue administration"}</p>
      </header>

      <div className="admin-content">
        {/* Period + Refresh */}
        <div className="period-buttons">
          {[
            { key: 'today', icon: <Calendar size={13}/>, label: "Aujourd'hui" },
            { key: 'week',  icon: <CalendarDays size={13}/>, label: "Semaine" },
            { key: 'month', icon: <BarChart2 size={13}/>, label: "Mois" },
            { key: 'year',  icon: <TrendingUp size={13}/>, label: "Année" },
          ].map(({ key, icon, label }) => (
            <button key={key} onClick={() => setActivePeriod(key)}
              className={`period-btn ${activePeriod === key ? 'active' : ''}`}>
              <span style={{marginRight:4,verticalAlign:'middle'}}>{icon}</span>{label}
            </button>
          ))}
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:10}}>
            {lastUpdated && (
              <span style={{fontSize:12, color:'#64748b'}} title={lastUpdated.toLocaleString()}>
                {`Mis à jour à ${lastUpdated.toLocaleTimeString()}`}
              </span>
            )}
            <button onClick={loadSummaryData} className="period-btn"
              style={{borderColor:'#1e40af', color:'#1e40af'}} disabled={loading}>
              <RefreshCw size={13} style={{marginRight:4,verticalAlign:'middle'}}/> {"Rafraîchir"}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loading">{"Chargement..."}</div>}

        {summaryData && !loading && (() => {
          const stats = getStats()
          const ranking = getRanking()
          const maxMinutes = ranking.length > 0 ? ranking[0].minutes : 0

          return (
            <div className="summary-grid">
              {/* KPI banner */}
              <div className="summary-card large">
                <h2 style={{margin:'0 0 20px 0'}}>Vue d'ensemble — {getPeriodLabel()}</h2>
                <div className="stats-rows">
                  <div className="stat-row">
                    <div className="admin-usage-container stat-item">
                      <div className="admin-usage-container stat-label">{"Temps total"}</div>
                      <div className="admin-usage-container stat-value">{stats.hours || 0}h</div>
                      <div className="admin-usage-container stat-meta">{stats.minutes || 0} min</div>
                    </div>
                    <div className="admin-usage-container stat-item">
                      <div className="admin-usage-container stat-label">{"Nombre de Sessions"}</div>
                      <div className="admin-usage-container stat-value">{stats.sessions || 0}</div>
                      <div className="admin-usage-container stat-meta">connexions</div>
                    </div>
                    <div className="admin-usage-container stat-item">
                      <div className="admin-usage-container stat-label">{"Utilisateurs actifs"}</div>
                      <div className="admin-usage-container stat-value">{stats.users || 0}</div>
                      <div className="admin-usage-container stat-meta">personnes</div>
                    </div>
                    {stats.users > 0 && (
                      <div className="admin-usage-container stat-item">
                        <div className="admin-usage-container stat-label">{"Moy. par utilisateur"}</div>
                        <div className="admin-usage-container stat-value">{formatTime(Math.round((stats.minutes || 0) / stats.users))}</div>
                        <div className="admin-usage-container stat-meta">{Math.round((stats.sessions || 0) / stats.users)} sess. moy.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Histogram card */}
              <div className="summary-card full-width">
                <div className="histogram-header">
                  <h3 style={{margin:0}}>Classement par utilisation — {getPeriodLabel()}</h3>
                  <div className="dim-tabs">
                    {Object.entries(DIM_LABELS).map(([key, { label, icon }]) => (
                      <button key={key} onClick={() => setActiveDim(key)}
                        className={`dim-tab ${activeDim === key ? 'active' : ''}`}>
                        {icon}<span style={{marginLeft:5}}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {ranking.length === 0 ? (
                  <div style={{padding:'30px 0', textAlign:'center', color:'#aaa', fontSize:14}}>
                    {"Aucune donnée pour cette période"}
                  </div>
                ) : (
                  <div className="histogram-body">
                    {ranking.map((row, i) => (
                      <HorizontalBar key={i} label={row.label} minutes={row.minutes}
                        sessions={row.sessions} maxMinutes={maxMinutes} formatTime={formatTime} />
                    ))}
                  </div>
                )}
              </div>

              {/* Daily Breakdown */}
              {stats.daily_breakdown && (
                <div className="summary-card full-width">
                  <h3>{"Répartition journalière"}</h3>
                  <div className="breakdown-table">
                    <table>
                      <thead><tr><th>{"Date"}</th><th>{"Temps total"}</th><th>{"Sessions"}</th><th>{"Utilisateurs"}</th></tr></thead>
                      <tbody>
                        {Object.entries(stats.daily_breakdown).map(([date, data]) => (
                          <tr key={date}>
                            <td>{date}</td>
                            <td>{formatTime(data.total_minutes)}</td>
                            <td>{data.sessions_count}</td>
                            <td>{data.users_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Monthly Breakdown */}
              {stats.monthly_breakdown && (
                <div className="summary-card full-width">
                  <h3>{"Répartition mensuelle"}</h3>
                  <div className="breakdown-table">
                    <table>
                      <thead><tr><th>{"Mois"}</th><th>{"Temps total"}</th><th>{"Sessions"}</th><th>{"Utilisateurs"}</th></tr></thead>
                      <tbody>
                        {Object.entries(stats.monthly_breakdown).map(([month, data]) => {
                          const names = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
                          return (
                            <tr key={month}>
                              <td>{names[parseInt(month)]}</td>
                              <td>{formatTime(data.total_minutes)}</td>
                              <td>{data.sessions_count}</td>
                              <td>{data.users_count}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {!summaryData && !loading && (
          <div className="no-data"><p>{"Aucune donnée disponible"}</p></div>
        )}
      </div>
    </div>
  )
}
