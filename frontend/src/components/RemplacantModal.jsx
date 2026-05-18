import React, { useState, useEffect } from 'react'
import { X, Users2, CheckCircle, Send, RefreshCw } from 'lucide-react'
import api from '../services/api'

const ADMIN_ROLES = ['RH', 'DG', 'PCA', 'ADMIN', 'AG', 'DIRECTEUR']

/**
 * Petit éditeur de commentaire pour une proposition de remplaçant.
 * Persiste via PATCH au blur, avec feedback "Enregistré" temporaire.
 */
function CommentaireRemplacant({ initial, onSave }) {
  const [value, setValue] = useState(initial || '')
  const [saved, setSaved] = useState(false)
  const [savingError, setSavingError] = useState('')
  const handleBlur = async () => {
    if ((value || '') === (initial || '')) return
    try {
      await onSave(value || '')
      setSavingError('')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSavingError('Erreur enregistrement')
    }
  }
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
        Commentaire
      </label>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Note interne pour ce remplaçant (facultatif)"
        rows={2}
        aria-label="Commentaire du remplaçant"
        style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'inherit', resize: 'vertical' }}
      />
      {saved && <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 600 }}>Enregistré</span>}
      {savingError && <span style={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 600 }}>{savingError}</span>}
    </div>
  )
}

export default function RemplacantModal({ operationId, userRole, userMatricule, onClose }) {
  const [propositions, setPropositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = ADMIN_ROLES.includes(String(userRole || '').toUpperCase())

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const res = await api.get(`/api/remplacants/propositions/${operationId}`)
      setPropositions(res.data || [])
    } catch {
      setError('Erreur lors du chargement des propositions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [operationId])

  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      await api.post(`/api/remplacants/generer/${operationId}`)
      await load(true)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  const demander = async (matricule) => {
    setError('')
    try {
      await api.post(`/api/remplacants/${operationId}/demander/${matricule}`)
      await load(true)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur lors de l\'envoi de la demande')
    }
  }

  const accepter = async (matricule) => {
    setError('')
    try {
      await api.post(`/api/remplacants/${operationId}/accepter/${matricule}`)
      await load(true)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur lors de l\'acceptation')
    }
  }

  const saveCommentaire = async (idProposition, commentaire) => {
    setError('')
    try {
      await api.patch(`/api/remplacants/propositions/${idProposition}/commentaire`, { commentaire })
    } catch (e) {
      setError(e?.response?.data?.detail || "Erreur lors de l'enregistrement du commentaire")
    }
  }

  const accepted = propositions.filter(p => p.est_accepte)
  const pending = propositions.filter(p => !p.est_accepte)
  const myPendingReq = pending.filter(p => p.matricule === userMatricule && p.demande_envoyee)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', borderRadius: 14, width: '90%', maxWidth: 520, padding: 24, boxShadow: '0 12px 40px rgba(0,0,0,0.2)', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#021630', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users2 size={18} /> Remplaçant(s) — Opération #{operationId}
          {refreshing && (
            <RefreshCw size={13} style={{ marginLeft: 'auto', color: '#94a3b8', animation: 'spin 1s linear infinite' }} />
          )}
        </h2>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: '0.82rem' }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>Chargement...</div>
        ) : (
          <>
            {/* Accepted replacements (visible to everyone) */}
            {accepted.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Remplaçant(s) accepté(s)
                </div>
                {accepted.map(p => (
                  <div key={p.matricule} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 6 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 600, color: '#021630' }}>{p.nom_complet}</span>
                      {p.fonction && <span style={{ color: '#64748b', marginLeft: 8, fontSize: '0.78rem' }}>{p.fonction}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Non-admin: show "Accepter" for own pending requests */}
            {!isAdmin && myPendingReq.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d97706', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Demande de remplacement
                </div>
                {myPendingReq.map(p => (
                  <div key={p.matricule} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, fontSize: '0.82rem', color: '#021630' }}>
                      Vous êtes sollicité(e) comme remplaçant pour cette opération
                    </div>
                    <button
                      onClick={() => accepter(p.matricule)}
                      style={{ padding: '6px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Accepter
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Admin view: manage all propositions */}
            {isAdmin && (
              <>
                {pending.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#021630', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Propositions
                    </div>
                    {pending.map(p => (
                      <div key={p.matricule} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, fontSize: '0.82rem' }}>
                            <span style={{ fontWeight: 600, color: '#021630' }}>{p.nom_complet}</span>
                            {p.fonction && <span style={{ color: '#64748b', marginLeft: 8, fontSize: '0.78rem' }}>{p.fonction}</span>}
                            {p.demande_envoyee && (
                              <span style={{ display: 'block', marginTop: 2, fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>
                                Demande envoyée — en attente de réponse
                              </span>
                            )}
                          </div>
                          {!p.demande_envoyee && (
                            <button
                              onClick={() => demander(p.matricule)}
                              style={{ padding: '6px 14px', background: '#021630', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                            >
                              <Send size={11} /> Demander
                            </button>
                          )}
                        </div>
                        <CommentaireRemplacant
                          key={`c-${p.id_remplacant_propose}`}
                          initial={p.commentaire || ''}
                          onSave={(val) => saveCommentaire(p.id_remplacant_propose, val)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {propositions.length === 0 && !generating && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '16px 0', fontSize: '0.85rem' }}>
                    Aucune proposition générée
                  </div>
                )}

                <button
                  onClick={generate}
                  disabled={generating}
                  style={{ width: '100%', padding: '10px', background: '#021630', color: 'white', border: 'none', borderRadius: 8, cursor: generating ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 700, opacity: generating ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}
                >
                  <RefreshCw size={14} style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }} />
                  {generating ? 'Génération en cours...' : 'Générer des propositions automatiques'}
                </button>
              </>
            )}

            {/* No pending requests for non-admin */}
            {!isAdmin && myPendingReq.length === 0 && accepted.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: '0.85rem' }}>
                Aucun remplaçant pour cette opération
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
