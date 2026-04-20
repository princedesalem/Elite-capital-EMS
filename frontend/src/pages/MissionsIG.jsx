import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import dayjs from 'dayjs'
import { Search, AlertTriangle, CheckCircle, Lock } from 'lucide-react'
import MissionDetailModal from '../components/MissionDetailModal'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
export default function MissionsIG() {
  const { user } = useAuth()
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtre, setFiltre] = useState('tous') // 'tous', 'en_cours', 'terminees', 'sans_rapport'
  const [recherche, setRecherche] = useState('')
  const [selectedMissionId, setSelectedMissionId] = useState(null)
  const [userFonction, setUserFonction] = useState(null)
  const [fonctionLoading, setFonctionLoading] = useState(true)

  useEffect(() => {
    const matricule = user?.matricule || user?.sub
    if (!matricule) { setFonctionLoading(false); return }
    api.get(`/employees/${matricule}`)
      .then(r => setUserFonction(r.data?.fonction || ''))
      .catch(() => setUserFonction(''))
      .finally(() => setFonctionLoading(false))
  }, [user])

  useEffect(() => {
    if (!fonctionLoading && isIG()) chargerMissions()
    else if (!fonctionLoading) setLoading(false)
  }, [fonctionLoading])

  // Actualisation automatique toutes les 30 secondes (seulement pour les IG)
  useAutoRefresh(useCallback(() => { if (isIG()) chargerMissions() }, [userFonction]))

  const isIG = () => String(userFonction || '').toLowerCase().includes('inspecteur')

  async function chargerMissions() {
    setLoading(true)
    try {
      const res = await api.get('/api/missions/toutes-missions-ig')
      setMissions((res.data.missions || []).filter(m => m.statut === 'valid\u00e9'))
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement des missions')
    } finally {
      setLoading(false)
    }
  }

  const missionsFiltrees = missions.filter(mission => {
    // Filtre par statut
    const today = dayjs()
    const dateFin = dayjs(mission.date_fin)
    
    if (filtre === 'en_cours' && dateFin.isBefore(today)) return false
    if (filtre === 'terminees' && dateFin.isAfter(today)) return false
    if (filtre === 'sans_rapport' && (mission.rapport_televerse || dateFin.isAfter(today))) return false
    
    // Filtre par recherche
    if (recherche) {
      const rech = recherche.toLowerCase()
      return (
        mission.ville?.toLowerCase().includes(rech) ||
        mission.pays?.toLowerCase().includes(rech) ||
        mission.nom_employe?.toLowerCase().includes(rech) ||
        String(mission.id_mission).includes(rech)
      )
    }
    
    return true
  })

  if (fonctionLoading || loading) return <div style={{ padding: '20px' }}>{"Chargement..."}</div>

  if (!isIG()) return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <Lock size={40} color="#dc2626" />
      <h2 style={{ margin: 0, color: '#dc2626' }}>{"Accès non autorisé"}</h2>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{"Réservé à l'Inspection Générale"}</p>
    </div>
  )

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', display:'flex', alignItems:'center', gap:8 }}><Search size={18}/> {"Missions IG"}</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          {"Suivi des missions de l'Inspection Générale"}
        </p>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Filtres */}
      <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Filtre:</label>
            <select
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            >
              <option value="tous">Toutes les missions</option>
              <option value="en_cours">Missions en cours</option>
              <option value="terminees">Missions terminées</option>
              <option value="sans_rapport">Sans rapport soumis</option>
            </select>
          </div>
          
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Recherche:</label>
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Ville, pays, employé, ID mission..."
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                borderRadius: '6px', 
                border: '1px solid #d1d5db' 
              }}
            />
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={chargerMissions}
              style={{
                padding: '8px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {"Rafraîchir"}
            </button>
          </div>
        </div>
        
        <div style={{ marginTop: '15px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {missionsFiltrees.length} mission(s) trouvée(s)
        </div>
      </div>

      {/* Table des missions */}
      <div style={{ background: 'var(--card)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Employé(s)</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Destination</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{"Dates"}</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{"Statut"}</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{"Rapport"}</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{"Paiement des frais"}</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{"Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {missionsFiltrees.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                  {"Aucune mission"}
                </td>
              </tr>
            ) : (
              missionsFiltrees.map((mission) => {
                const today = dayjs()
                const dateFin = dayjs(mission.date_fin)
                const enCours = dateFin.isAfter(today)
                const joursSansRapport = dateFin.isBefore(today) && !mission.rapport_televerse
                  ? today.diff(dateFin, 'day')
                  : 0
                
                return (
                  <tr key={mission.id_mission} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <strong>#{mission.id_mission}</strong>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {mission.nom_employe}
                      {mission.nb_missionnaires > 1 && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          +{mission.nb_missionnaires - 1} autre(s)
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div>{mission.ville}, {mission.pays}</div>
                      {mission.nb_segments > 1 && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {mission.nb_segments} destinations
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        {dayjs(mission.date_debut).format('DD/MM/YYYY')}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        → {dayjs(mission.date_fin).format('DD/MM/YYYY')}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {enCours ? (
                        <span style={{ 
                          background: '#dbeafe', 
                          color: '#1e40af', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.85rem' 
                        }}>
                          {"En cours"}
                        </span>
                      ) : (
                        <span style={{ 
                          background: '#f3f4f6', 
                          color: '#374151', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.85rem' 
                        }}>
                          {"Terminé"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {mission.rapport_televerse ? (
                        <span style={{ color: '#059669', fontSize: '0.9rem' }}>
                          {"Soumis"}
                        </span>
                      ) : joursSansRapport > 0 ? (
                        <span style={{ color: '#dc2626', fontSize: '0.9rem', display:'inline-flex', alignItems:'center', gap:4 }}>
                          <AlertTriangle size={13}/> {joursSansRapport}j de retard
                        </span>
                      ) : enCours ? (
                        <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                          {"En Attente"}
                        </span>
                      ) : (
                        <span style={{ color: '#d97706', fontSize: '0.9rem' }}>
                          {"Non soumis"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {mission.frais_payes ? (
                        <span style={{ 
                          background: '#d1fae5', 
                          color: '#065f46', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.85rem' 
                        }}>
                          {"Payé"}
                        </span>
                      ) : mission.frais_valides_rh ? (
                        <span style={{ 
                          background: '#dbeafe', 
                          color: '#1e40af', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.85rem' 
                        }}>
                          {"En attente confirmation RH"}
                        </span>
                      ) : mission.frais_valides_missionnaire ? (
                        <span style={{ 
                          background: '#fef3c7', 
                          color: '#92400e', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.85rem' 
                        }}>
                          {"En attente RH"}
                        </span>
                      ) : (
                        <span style={{ 
                          background: '#fee2e2', 
                          color: '#991b1b', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.85rem' 
                        }}>
                          {"Non validé"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => setSelectedMissionId(mission.id_mission)}
                        style={{
                          color: '#3b82f6',
                          background: 'none',
                          border: 'none',
                          textDecoration: 'none',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          padding: 0,
                          fontFamily: 'inherit'
                        }}
                      >
                        {"Voir les détails"}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mission Detail Modal */}
      <MissionDetailModal
        isOpen={!!selectedMissionId}
        missionId={selectedMissionId}
        onClose={() => setSelectedMissionId(null)}
      />
    </div>
  )
}
