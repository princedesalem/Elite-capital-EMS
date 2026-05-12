import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { toast } from './ui/bridge'
import SignatureCanvas from './SignatureCanvas'

const BADGE_COLORS = {
  J2: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', label: '⚠ URGENT — J-2' },
  J7: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', label: '⏰ Alerte — J-7' },
}

const TYPE_LABELS = {
  CDI: 'CDI — Contrat à durée indéterminée',
  CDD: 'CDD — Contrat à durée déterminée',
  Stagiaire: 'Stage',
}

/**
 * AlerteContrat — Affiche les alertes actives de fin de contrat.
 * À inclure dans le dashboard RH ou la page administration.
 *
 * Props :
 *   userMatricule — matricule de l'utilisateur connecté (pour fait_par)
 */
export default function AlerteContrat({ userMatricule }) {
  const [alertes, setAlertes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAlerte, setActiveAlerte] = useState(null)
  const [action, setAction] = useState('')
  const [newDate, setNewDate] = useState('')
  const [signature, setSignature] = useState(null)
  const [showSig, setShowSig] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dismissed, setDismissed] = useState(new Set())

  const fetchAlertes = useCallback(async () => {
    try {
      const res = await api.get('/api/contrats/alertes')
      setAlertes(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAlertes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlertes() }, [fetchAlertes])

  const visible = alertes.filter(a => !dismissed.has(a.id))

  if (loading || visible.length === 0) return null

  const openModal = (alerte) => {
    setActiveAlerte(alerte)
    setAction('')
    setNewDate('')
    setSignature(null)
    setShowSig(false)
  }

  const closeModal = () => setActiveAlerte(null)

  const handleSubmit = async () => {
    if (!action) return
    if (action === 'renouvellement' && !newDate) {
      toast.warning('Veuillez saisir la nouvelle date de fin de contrat')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/api/contrats/action/${activeAlerte.employe_id}`, {
        action,
        date_fin_nouvelle: newDate || null,
        signature_data: signature || null,
        fait_par: String(userMatricule || ''),
      })

      // Si l'utilisateur veut une lettre, la générer + télécharger
      if (signature) {
        try {
          const res = await api.post(
            `/api/contrats/lettre/${activeAlerte.employe_id}`,
            {
              type_lettre: action,
              date_fin_nouvelle: newDate || null,
              signature_data: signature,
              fait_par: String(userMatricule || ''),
            },
            { responseType: 'blob' }
          )
          const url = URL.createObjectURL(res.data)
          const a = document.createElement('a')
          a.href = url
          a.download = `lettre_${action}_${activeAlerte.employe_id}.pdf`
          a.click()
          URL.revokeObjectURL(url)
        } catch {
          toast.warning('Action enregistrée, mais la génération de la lettre a échoué.')
        }
      }

      toast.success('Action enregistrée avec succès')
      setDismissed(prev => new Set([...prev, activeAlerte.id]))
      closeModal()
      fetchAlertes()
    } catch {
      toast.error("Erreur lors de l'enregistrement de l'action")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Bannière d'alertes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {visible.map(alerte => {
          const col = BADGE_COLORS[alerte.type_alerte] || BADGE_COLORS.J7
          return (
            <div
              key={alerte.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                background: col.bg,
                border: `1.5px solid ${col.border}`,
                borderRadius: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: col.text, flexShrink: 0 }}>
                {col.label}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{alerte.nom}</span>
                <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#64748b' }}>
                  {alerte.fonction || ''}
                </span>
                <span style={{ marginLeft: 8, fontSize: '0.78rem', color: col.text, fontWeight: 600 }}>
                  — Fin : {alerte.date_fin_contrat || '—'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => openModal(alerte)}
                style={{
                  padding: '5px 14px',
                  background: '#021630',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Traiter
              </button>
              <button
                type="button"
                onClick={() => setDismissed(prev => new Set([...prev, alerte.id]))}
                style={{
                  padding: '5px 10px',
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Modal d'action */}
      {activeAlerte && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28,
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#021630' }}>
              Traitement du contrat
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              {activeAlerte.nom} · {activeAlerte.type_contrat} · Fin : {activeAlerte.date_fin_contrat}
            </p>

            {/* Choix de l'action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {[
                { val: 'renouvellement', label: '🔁 Renouveler le contrat', desc: 'Prolonger le CDD ou stage pour une nouvelle période' },
                { val: 'arret', label: '⛔ Mettre fin au contrat', desc: 'Le contrat prend fin à la date prévue, sans renouvellement' },
                { val: 'confirmation_cdi', label: '✅ Confirmer en CDI', desc: "Transformer le contrat en CDI définitif dès aujourd'hui" },
              ].map(opt => (
                <label
                  key={opt.val}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                    padding: '10px 14px',
                    background: action === opt.val ? '#e0e7ff' : '#f8fafc',
                    border: `1.5px solid ${action === opt.val ? '#6366f1' : '#e2e8f0'}`,
                    borderRadius: 8,
                  }}
                >
                  <input
                    type="radio"
                    name="action_contrat"
                    value={opt.val}
                    checked={action === opt.val}
                    onChange={() => setAction(opt.val)}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#021630' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Nouvelle date si renouvellement */}
            {action === 'renouvellement' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Nouvelle date de fin de contrat *
                </label>
                <input
                  className="input"
                  type="date"
                  value={newDate}
                  min={activeAlerte.date_fin_contrat || undefined}
                  onChange={e => setNewDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {/* Signature */}
            {action && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Signature (optionnelle — pour générer la lettre)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSig(s => !s)}
                    style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showSig ? 'Masquer' : 'Ajouter une signature'}
                  </button>
                </div>
                {showSig && (
                  <SignatureCanvas
                    width={400}
                    height={120}
                    onSave={data => setSignature(data)}
                    onClear={() => setSignature(null)}
                  />
                )}
                {signature && (
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 4 }}>
                    ✓ Signature capturée — la lettre sera générée et téléchargée automatiquement
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
              <button
                type="button"
                onClick={closeModal}
                style={{ padding: '7px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!action || submitting}
                style={{
                  padding: '7px 18px',
                  background: action ? '#021630' : '#94a3b8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  fontSize: '0.85rem',
                  cursor: action ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
