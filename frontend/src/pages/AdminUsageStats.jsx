import React, { useState, useEffect } from 'react'
import { BarChart2, Calendar, TrendingUp, CalendarDays } from 'lucide-react'
import api from '../services/api'
import '../styles/AdminUsageStats.css'

export default function AdminUsageStats() {
  const [activePeriod, setActivePeriod] = useState('today') // today, week, month, year
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSummaryData()
  }, [activePeriod])

  const loadSummaryData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/employees/stats/usage/all/summary')
      setSummaryData(res.data)
    } catch (err) {
      setError('Erreur: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes) => {
    if (!minutes) return '0h 0min'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}min`
  }

  const getPeriodLabel = () => {
    const labels = {
      'today': 'Aujourd\'hui',
      'week': 'Cette semaine',
      'month': 'Ce mois',
      'year': 'Cette année'
    }
    return labels[activePeriod] || activePeriod
  }

  const getStats = () => {
    if (!summaryData) return null
    return summaryData[activePeriod] || {}
  }

  return (
    <div className="admin-usage-container">
      <header className="admin-header">
        <h1 style={{display:'flex',alignItems:'center',gap:8}}><BarChart2 size={22}/> Statistiques Globales d'Utilisation</h1>
        <p>Vue d'administration - Tous les utilisateurs</p>
      </header>

      <div className="admin-content">
        {/* Period Selection */}
        <div className="period-buttons">
          <button 
            onClick={() => setActivePeriod('today')}
            className={`period-btn ${activePeriod === 'today' ? 'active' : ''}`}
          >
            <Calendar size={13} style={{marginRight:4,verticalAlign:'middle'}}/> Aujourd'hui
          </button>
          <button 
            onClick={() => setActivePeriod('week')}
            className={`period-btn ${activePeriod === 'week' ? 'active' : ''}`}
          >
            <CalendarDays size={13} style={{marginRight:4,verticalAlign:'middle'}}/> Semaine
          </button>
          <button 
            onClick={() => setActivePeriod('month')}
            className={`period-btn ${activePeriod === 'month' ? 'active' : ''}`}
          >
            <BarChart2 size={13} style={{marginRight:4,verticalAlign:'middle'}}/> Mois
          </button>
          <button 
            onClick={() => setActivePeriod('year')}
            className={`period-btn ${activePeriod === 'year' ? 'active' : ''}`}
          >
            <TrendingUp size={13} style={{marginRight:4,verticalAlign:'middle'}}/> Année
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loading">Chargement...</div>}

        {summaryData && !loading && (() => {
          const stats = getStats()
          return (
            <div className="summary-grid">
              {/* Overview Card */}
              <div className="summary-card large">
                <h2 style={{ margin: '0 0 20px 0' }}>Vue d'ensemble - {getPeriodLabel()}</h2>
                <div className="stats-rows">
                  <div className="stat-row">
                    <div className="stat-item">
                      <div className="stat-label">Temps Total</div>
                      <div className="stat-value">{stats.total_hours || 0} heures</div>
                      <div className="stat-meta">{stats.total_minutes || 0} minutes</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Nombre de Sessions</div>
                      <div className="stat-value">{stats.sessions_count || 0}</div>
                      <div className="stat-meta">Connexions</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Utilisateurs Actifs</div>
                      <div className="stat-value">{stats.users_count || 0}</div>
                      <div className="stat-meta">Personnes</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Average Stats Card */}
              {stats.users_count > 0 && (
                <div className="summary-card">
                  <h3 style={{ margin: '0 0 15px 0' }}>Moyennes par Utilisateur</h3>
                  <div className="average-stats">
                    <div className="avg-stat">
                      <div className="avg-label">Temps moyen</div>
                      <div className="avg-value">
                        {formatTime(Math.round((stats.total_minutes || 0) / stats.users_count))}
                      </div>
                    </div>
                    <div className="avg-stat">
                      <div className="avg-label">Sessions moyennes</div>
                      <div className="avg-value">
                        {Math.round((stats.sessions_count || 0) / stats.users_count)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Breakdown (if available) */}
              {stats.daily_breakdown && (
                <div className="summary-card full-width">
                  <h3>Répartition Journalière</h3>
                  <div className="breakdown-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Temps Total</th>
                          <th>Sessions</th>
                          <th>Utilisateurs</th>
                        </tr>
                      </thead>
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

              {/* Monthly Breakdown (if available) */}
              {stats.monthly_breakdown && (
                <div className="summary-card full-width">
                  <h3>Répartition Mensuelle</h3>
                  <div className="breakdown-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Mois</th>
                          <th>Temps Total</th>
                          <th>Sessions</th>
                          <th>Utilisateurs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.monthly_breakdown).map(([month, data]) => {
                          const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                                             'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
                          return (
                            <tr key={month}>
                              <td>{monthNames[parseInt(month)]}</td>
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
          <div className="no-data">
            <p>Aucune donnée disponible</p>
          </div>
        )}
      </div>
    </div>
  )
}
