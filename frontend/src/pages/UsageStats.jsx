import React, { useState, useEffect } from 'react'
import api from '../services/api'
import '../styles/UsageStats.css'
import { BarChart2, Calendar, TrendingUp, CalendarDays } from 'lucide-react'

export default function UsageStats() {
  const [activePeriod, setActivePeriod] = useState('today') // today, week, month, year
  const [selectedUser, setSelectedUser] = useState('')
  const [usageData, setUsageData] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fromLocalStorage, setFromLocalStorage] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      setFromLocalStorage(userData.matricule)
      // Si c'est un admin, charger l'utilisateur courant par défaut
      if (userData.role && ['RH', 'DG', 'PCA', 'ADMIN'].includes(userData.role)) {
        setSelectedUser(userData.matricule)
      }
    }
    
    // Charger la liste des employés pour admin
    loadEmployees()
  }, [])

  useEffect(() => {
    if (selectedUser) {
      loadUsageData()
    }
  }, [activePeriod, selectedUser])

  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees')
      setEmployees(res.data || [])
    } catch (err) {
      console.error('Erreur chargement employés:', err)
    }
  }

  const loadUsageData = async () => {
    setLoading(true)
    setError('')
    try {
      let endpoint = `/employees/stats/usage/${selectedUser}/${activePeriod}`
      const res = await api.get(endpoint)
      setUsageData(res.data)
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

  return (
    <div className="usage-stats-container">
      <header className="usage-header">
        <h1 style={{display:'flex',alignItems:'center',gap:8}}><BarChart2 size={22}/> Statistiques d'Utilisation</h1>
        <p>Suivi du temps d'utilisation de l'application</p>
      </header>

      <div className="usage-content">
        {/* User Selection */}
        <div className="user-selection">
          <label>Sélectionner un utilisateur:</label>
          <select 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
            className="user-select"
          >
            <option value="">-- Choisir un utilisateur --</option>
            {employees.map(emp => (
              <option key={emp.matricule} value={emp.matricule}>
                {emp.prenom} {emp.nom} ({emp.matricule})
              </option>
            ))}
          </select>
        </div>

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

        {usageData && !loading && (
          <div className="usage-cards">
            {/* Total Time Card */}
            <div className="stat-card large">
              <div className="stat-label">Temps Total</div>
              <div className="stat-value">{usageData.total_hours} heures</div>
              <div className="stat-minutes">{usageData.total_minutes} minutes</div>
            </div>

            {/* Sessions Card */}
            <div className="stat-card">
              <div className="stat-label">Nombre de Sessions</div>
              <div className="stat-value">{usageData.sessions_count}</div>
              <div className="stat-minutes">Connexions</div>
            </div>

            {/* Daily Breakdown */}
            {usageData.daily_breakdown && (
              <div className="stat-card full-width">
                <div className="stat-label">Répartition Journalière</div>
                <div className="breakdown-content">
                  {Object.entries(usageData.daily_breakdown).map(([day, minutes]) => (
                    <div key={day} className="breakdown-item">
                      <span className="day-label">{day}</span>
                      <div className="usage-bar">
                        <div 
                          className="bar-fill" 
                          style={{ width: `${(minutes / 480) * 100}%` }}
                        ></div>
                      </div>
                      <span className="time-label">{formatTime(minutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly Breakdown */}
            {usageData.monthly_breakdown && (
              <div className="stat-card full-width">
                <div className="stat-label">Répartition Mensuelle</div>
                <div className="breakdown-content">
                  {Object.entries(usageData.monthly_breakdown).map(([month, minutes]) => {
                    const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
                    return (
                      <div key={month} className="breakdown-item">
                        <span className="day-label">{monthNames[parseInt(month)]}</span>
                        <div className="usage-bar">
                          <div 
                            className="bar-fill" 
                            style={{ width: `${(minutes / 14400) * 100}%` }}
                          ></div>
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

        {!selectedUser && !loading && (
          <div className="no-data">
            <p>Sélectionnez un utilisateur pour voir ses statistiques</p>
          </div>
        )}
      </div>
    </div>
  )
}
