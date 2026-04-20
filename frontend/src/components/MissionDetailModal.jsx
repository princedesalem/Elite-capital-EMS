import React, { useState, useEffect } from 'react'
import api from '../services/api'

export default function MissionDetailModal({ isOpen, missionId, onClose }) {
  const [mission, setMission] = useState(null)
  const [segments, setSegments] = useState([])
  const [missionnaires, setMissionnaires] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen || !missionId) {
      setMission(null)
      setSegments([])
      setMissionnaires([])
      return
    }

    const loadMissionDetails = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get(`/api/missions/${missionId}`)
        if (res.data) {
          setMission(res.data)
          // Load segments if they exist
          if (res.data.segments && Array.isArray(res.data.segments)) {
            setSegments(res.data.segments)
          }
          // Load missionnaires if they exist
          if (res.data.missionnaires && Array.isArray(res.data.missionnaires)) {
            setMissionnaires(res.data.missionnaires)
          }
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Erreur lors du chargement des détails de la mission')
        console.error('Mission details fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMissionDetails()
  }, [isOpen, missionId])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: '#e5e7eb',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#4b5563'
          }}
        >
          ✕
        </button>

        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: '#021630' }}>
          Détails de la Mission #{missionId}
        </h2>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '12px'
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Chargement...
          </div>
        )}

        {mission && !loading && (
          <>
            {/* Basic Info */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ borderBottom: '2px solid #ce2b2b', marginBottom: '8px', paddingBottom: '4px' }}>
                Informations générales
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.85rem' }}>Motif</label>
                  <div style={{ padding: '6px', background: '#f5f5f5', borderRadius: '4px' }}>
                    {mission.motif || 'Non renseigné'}
                  </div>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.85rem' }}>Email contact</label>
                  <div style={{ padding: '6px', background: '#f5f5f5', borderRadius: '4px' }}>
                    {mission.email_mission || 'Non renseigné'}
                  </div>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.85rem' }}>Statut</label>
                  <div style={{ padding: '6px', background: '#f5f5f5', borderRadius: '4px' }}>
                    {mission.statut || 'Non renseigné'}
                  </div>
                </div>
                {mission.rapport_televerse !== undefined && (
                  <div>
                    <label style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.85rem' }}>Rapport téléversé</label>
                    <div style={{ padding: '6px', background: '#f5f5f5', borderRadius: '4px' }}>
                      {mission.rapport_televerse ? '✓ Oui' : '✗ Non'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Segments */}
            {segments.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ borderBottom: '2px solid #ce2b2b', marginBottom: '8px', paddingBottom: '4px' }}>
                  Destinations ({segments.length})
                </h3>
                {segments.map((seg, idx) => (
                  <div key={idx} style={{
                    background: '#f9f9f9',
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    border: '1px solid #ddd'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                      {seg.ordre}. {seg.pays} - {seg.ville}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ fontWeight: '600' }}>Départ:</span> {seg.date_debut ? new Date(seg.date_debut).toLocaleDateString('fr-FR') : '-'}
                      </div>
                      <div>
                        <span style={{ fontWeight: '600' }}>Retour:</span> {seg.date_fin ? new Date(seg.date_fin).toLocaleDateString('fr-FR') : '-'}
                      </div>
                      {seg.heure_depart && (
                        <div>
                          <span style={{ fontWeight: '600' }}>Heure départ:</span> {seg.heure_depart}
                        </div>
                      )}
                      {seg.heure_retour && (
                        <div>
                          <span style={{ fontWeight: '600' }}>Heure retour:</span> {seg.heure_retour}
                        </div>
                      )}
                      {seg.moyen_transport && (
                        <div>
                          <span style={{ fontWeight: '600' }}>Transport:</span> {seg.moyen_transport}
                        </div>
                      )}
                      {seg.nombre_nuits && (
                        <div>
                          <span style={{ fontWeight: '600' }}>Nuits:</span> {seg.nombre_nuits}
                        </div>
                      )}
                      {seg.frais_hotel_unitaire && (
                        <div>
                          <span style={{ fontWeight: '600' }}>Frais hôtel/nuit:</span> {Number(seg.frais_hotel_unitaire).toFixed(2)} FCFA
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Missionnaires */}
            {missionnaires.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ borderBottom: '2px solid #ce2b2b', marginBottom: '8px', paddingBottom: '4px' }}>
                  Missionnaires ({missionnaires.length})
                </h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {missionnaires.map((miss, idx) => (
                    <div key={idx} style={{
                      background: '#f9f9f9',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '0.9rem'
                    }}>
                      <span style={{ fontWeight: '600' }}>{miss.nom_complet || miss.matricule}</span>
                      {miss.role_mission && (
                        <span style={{ marginLeft: '12px', color: '#666' }}>Rôle: {miss.role_mission}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Frais Info */}
            {(mission.frais_valides_missionnaire !== undefined || mission.frais_valides_rh !== undefined || mission.frais_payes !== undefined) && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ borderBottom: '2px solid #ce2b2b', marginBottom: '8px', paddingBottom: '4px' }}>
                  Validation Frais
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.85rem' }}>Missionnaire</label>
                    <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                      {mission.frais_valides_missionnaire ? '✓ Validé' : '✗ En attente'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.85rem' }}>RH</label>
                    <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                      {mission.frais_valides_rh ? '✓ Validé' : '✗ En attente'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.85rem' }}>Payé</label>
                    <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                      {mission.frais_payes ? '✓ Payé' : '✗ Non payé'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rapport */}
            {mission.rapport && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ borderBottom: '2px solid #ce2b2b', marginBottom: '8px', paddingBottom: '4px' }}>
                  Rapport
                </h3>
                <div style={{
                  background: '#f9f9f9',
                  padding: '12px',
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '0.9rem',
                  lineHeight: '1.5'
                }}>
                  {mission.rapport}
                </div>
              </div>
            )}

            {/* Close Button Bottom */}
            <div style={{ marginTop: '20px',textAlign: 'right' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}
              >
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
