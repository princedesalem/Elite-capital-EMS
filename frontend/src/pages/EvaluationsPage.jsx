import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { BarChart2, XCircle, Loader, Calendar, ClipboardList } from 'lucide-react'

export default function EvaluationsPage() {
  const { user } = useAuth()
  const matricule = Number(user?.matricule || user?.sub || 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [evaluations, setEvaluations] = useState([])
  const [fichePoste, setFichePoste] = useState(null)
  const [activeEval, setActiveEval] = useState(null)
  const [evalTab, setEvalTab] = useState('recu')

  useEffect(() => {
    if (!matricule) return
    loadEvaluations()
  }, [matricule])

  async function loadEvaluations() {
    setLoading(true)
    setError('')
    try {
      const [evals, fiche] = await Promise.all([
        api.get(`/api/evaluations/mes-evaluations/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/evaluations/fiche-poste/${matricule}`).catch(() => ({ data: null }))
      ])
      setEvaluations(Array.isArray(evals.data) ? evals.data : [])
      setFichePoste(fiche.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '1000px', marginTop: '20px' }}>
      <div className="card">
        <h1 style={{display:'flex',alignItems:'center',gap:8}}><BarChart2 size={20}/> Mes Évaluations</h1>

        {/* Tabs */}
        {(() => {
          const recu = evaluations.filter(e => e.evaluation_hierarchique != null && e.evaluation_hierarchique !== '')
          const envoye = evaluations.filter(e => e.auto_evaluation != null && e.auto_evaluation !== '')
          const displayed = evalTab === 'recu' ? recu : envoye
          return (
            <>
              <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
                {[['recu', 'Reçu', recu.length], ['envoye', 'Envoyé', envoye.length]].map(([key, label, count]) => (
                  <button key={key} onClick={() => setEvalTab(key)} style={{
                    flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
                    background: 'transparent', fontWeight: evalTab === key ? 700 : 500,
                    fontSize: '0.9rem', borderBottom: evalTab === key ? '2px solid #ce2b2b' : '2px solid transparent',
                    marginBottom: -2, color: evalTab === key ? '#ce2b2b' : '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {label}
                    <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: '0.75rem',
                      background: evalTab === key ? '#ce2b2b' : '#e5e7eb',
                      color: evalTab === key ? '#fff' : '#374151' }}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {error && <div style={{ color: '#e74c3c', padding: '12px', background: '#fadbd8', borderRadius: '6px', marginBottom: '20px', display:'flex', alignItems:'center', gap:6 }}><XCircle size={14}/> {error}</div>}
              {loading && <p style={{display:'flex',alignItems:'center',gap:6}}><Loader size={14} style={{animation:'spin 1s linear infinite'}}/> Chargement des évaluations...</p>}

              {!loading && displayed.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                  <p>Aucune évaluation {evalTab === 'recu' ? 'reçue' : 'envoyée'} actuellement</p>
                </div>
              )}

              {!loading && displayed.length > 0 && (
                <div>
                  <h2>Mes Périodes d'Évaluation</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    {displayed.map((evaluation) => (
                <div
                    key={evaluation.id_evaluation}
                    className="card"
                    onClick={() => setActiveEval(activeEval === evaluation.id_evaluation ? null : evaluation.id_evaluation)}
                    style={{
                      cursor: 'pointer',
                      borderLeft: activeEval === evaluation.id_evaluation ? '4px solid #ce2b2b' : '4px solid #ecf0f1',
                      padding: '20px'
                    }}
                  >
                    <h3 style={{display:'flex',alignItems:'center',gap:6}}><Calendar size={14}/> Période {evaluation.id_periode}</h3>
                    <p><strong>Statut:</strong> {evaluation.statut || 'N/A'}</p>
                    <p><strong>Début:</strong> {evaluation.date_debut ? new Date(evaluation.date_debut).toLocaleDateString('fr-FR') : 'N/A'}</p>
                    <p><strong>Fin:</strong> {evaluation.date_fin ? new Date(evaluation.date_fin).toLocaleDateString('fr-FR') : 'N/A'}</p>

                    {activeEval === evaluation.id_evaluation && (
                      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ecf0f1' }}>
                        {evaluation.auto_evaluation && (
                          <>
                            <h4>Auto-Évaluation</h4>
                            <p>{evaluation.auto_evaluation}</p>
                          </>
                        )}
                        {evaluation.evaluation_hierarchique && (
                          <>
                            <h4>Évaluation Hiérarchique</h4>
                            <p>{evaluation.evaluation_hierarchique}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )})()}

        {fichePoste && (
          <div style={{ marginTop: '40px', padding: '20px', background: '#ecf0f1', borderRadius: '8px' }}>
            <h2 style={{display:'flex',alignItems:'center',gap:6}}><ClipboardList size={16}/> Fiche de Poste</h2>
            <div style={{ background: 'white', padding: '15px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.9em', overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
              <pre>{JSON.stringify(fichePoste, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
