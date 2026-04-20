import { useState, useEffect } from 'react'
import api from '../services/api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'

dayjs.extend(relativeTime)
dayjs.locale('fr')

export default function CommentairesMission({ idMission, matricule }) {
  const [commentaires, setCommentaires] = useState([])
  const [nouveauCommentaire, setNouveauCommentaire] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (idMission) {
      chargerCommentaires()
      // Rafraîchir les commentaires toutes les 30 secondes
      const interval = setInterval(chargerCommentaires, 30000)
      return () => clearInterval(interval)
    }
  }, [idMission])

  async function chargerCommentaires() {
    try {
      const res = await api.get(`/api/missions/commentaires/${idMission}`)
      setCommentaires(res.data)
      
      // Marquer comme lu
      for (const comm of res.data) {
        if (!comm.lu_par.includes(matricule)) {
          await api.post(`/api/missions/commentaires/${comm.id_commentaire}/marquer-lu`, null, {
            params: { matricule }
          })
        }
      }
    } catch (err) {
      console.error('Erreur chargement commentaires:', err)
    }
  }

  async function ajouterCommentaire(e) {
    e.preventDefault()
    if (!nouveauCommentaire.trim()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await api.post('/api/missions/commentaires/creer', {
        id_mission: idMission,
        matricule: matricule,
        commentaire: nouveauCommentaire
      })
      
      setSuccess('Commentaire ajouté ! Les validateurs seront notifiés.')
      setNouveauCommentaire('')
      await chargerCommentaires()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'ajout du commentaire')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#374151' }}>Commentaires de mission</h3>
      
      {/* Formulaire d'ajout */}
      <form onSubmit={ajouterCommentaire} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <textarea
            value={nouveauCommentaire}
            onChange={(e) => setNouveauCommentaire(e.target.value)}
            placeholder="Ajouter un commentaire visible par tous les validateurs..."
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              minHeight: '80px',
              resize: 'vertical'
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !nouveauCommentaire.trim()}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !nouveauCommentaire.trim() ? 0.5 : 1
            }}
          >
            {loading ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
        
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '6px', marginTop: '10px' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ background: '#d1fae5', color: '#059669', padding: '10px', borderRadius: '6px', marginTop: '10px' }}>
            {success}
          </div>
        )}
      </form>

      {/* Liste des commentaires */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {commentaires.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
            Aucun commentaire pour le moment
          </div>
        ) : (
          commentaires.map((comm) => (
            <div
              key={comm.id_commentaire}
              style={{
                background: 'var(--card)',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <strong style={{ color: '#1f2937' }}>{comm.auteur_nom}</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '8px' }}>
                    {comm.auteur_fonction}
                  </span>
                </div>
                <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                  {dayjs(comm.date_creation).fromNow()}
                </span>
              </div>
              
              <p style={{ margin: '8px 0 0 0', color: '#374151', whiteSpace: 'pre-wrap' }}>
                {comm.commentaire}
              </p>
              
              {comm.lu_par.length > 1 && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
                  Lu par {comm.lu_par.length} personne(s)
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
