import React, { useEffect, useState, useCallback, useRef } from 'react'
import api from '../services/api'
import { toast } from './ui/bridge'
import SignatureCanvas from './SignatureCanvas'

const TYPE_LABELS = {
  CDI: 'CDI',
  CDD: 'CDD',
  Stagiaire: 'Stage',
}

const ALERT_CSS = `
@keyframes ac-pulse-j2 {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.35); }
  50%       { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
}
@keyframes ac-pulse-j7 {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.25); }
  50%       { box-shadow: 0 0 0 6px rgba(217,119,6,0); }
}
@keyframes ac-icon-shake {
  0%,100% { transform: rotate(0deg); }
  15%     { transform: rotate(-16deg); }
  30%     { transform: rotate(14deg); }
  45%     { transform: rotate(-10deg); }
  60%     { transform: rotate(8deg); }
  75%     { transform: rotate(-4deg); }
}
.ac-j2    { animation: ac-pulse-j2 1.6s ease-in-out infinite; }
.ac-j7    { animation: ac-pulse-j7 3s ease-in-out infinite; }
.ac-shake { animation: ac-icon-shake 2.4s ease-in-out infinite; }
`

function injectAlertStyles() {
  if (document.getElementById('__ac_styles')) return
  const el = document.createElement('style')
  el.id = '__ac_styles'
  el.textContent = ALERT_CSS
  document.head.appendChild(el)
}

/* ── Inline SVG icons ─────────────────────────────────────────────────── */
function IconAlert({ size = 24, color = '#dc2626' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function IconClock({ size = 22, color = '#d97706' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function IconRefresh({ size = 17, color = '#3b4fd8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  )
}

function IconBan({ size = 17, color = '#dc2626' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  )
}

function IconShieldCheck({ size = 17, color = '#16a34a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}

function IconChevron({ down = true, size = 16, color = '#475569' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {down
        ? <polyline points="6 9 12 15 18 9"/>
        : <polyline points="6 15 12 9 18 15"/>
      }
    </svg>
  )
}

/* ── Constantes ──────────────────────────────────────────────────────── */
const REMINDER_MS = 15 * 60 * 1000

const ACTIONS = [
  { val: 'renouvellement',   label: 'Renouveler le contrat',  desc: 'Prolonger le CDD ou stage pour une nouvelle période',          Icon: IconRefresh,    iconColor: '#3b4fd8' },
  { val: 'arret',            label: 'Mettre fin au contrat',  desc: 'Le contrat prend fin à la date prévue, sans renouvellement',   Icon: IconBan,        iconColor: '#dc2626' },
  { val: 'confirmation_cdi', label: 'Confirmer en CDI',       desc: "Transformer le contrat en CDI définitif dès aujourd'hui",       Icon: IconShieldCheck, iconColor: '#16a34a' },
]

/**
 * AlerteContrat — Bannières persistantes de fin de contrat.
 * Reste affichée jusqu'au traitement effectif — aucune fermeture sans action.
 * Props : userMatricule (pour fait_par)
 */
export default function AlerteContrat({ userMatricule }) {
  const [alertes, setAlertes]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState(false)
  const [activeAlerte, setActive]   = useState(null)
  const [action, setAction]         = useState('')
  const [newDate, setNewDate]       = useState('')
  const [signature, setSignature]   = useState(null)
  const [showSig, setShowSig]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [profileSig, setProfileSig] = useState(null)   // base64 de la signature du profil

  const reminderRef = useRef(null)
  const alertesRef  = useRef([])

  /* ── styles ── */
  useEffect(() => { injectAlertStyles() }, [])

  /* ── signature du profil ── */
  useEffect(() => {
    if (!userMatricule) return
    api.get(`/employees/${userMatricule}`)
      .then(res => {
        const sigUrl = res.data?.signature_url
        if (!sigUrl) return
        return api.get(sigUrl, { responseType: 'arraybuffer' })
          .then(imgRes => {
            const bytes = new Uint8Array(imgRes.data)
            let bin = ''
            bytes.forEach(b => { bin += String.fromCharCode(b) })
            setProfileSig(`data:image/png;base64,${window.btoa(bin)}`)
          })
      })
      .catch(() => {})
  }, [userMatricule])

  /* ── fetch ── */
  const fetchAlertes = useCallback(async () => {
    try {
      const res = await api.get('/api/contrats/alertes')
      const list = Array.isArray(res.data) ? res.data : []
      setAlertes(list)
      alertesRef.current = list
    } catch {
      setAlertes([])
      alertesRef.current = []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlertes() }, [fetchAlertes])

  /* ── rappel 15 min ── */
  useEffect(() => {
    if (reminderRef.current) clearInterval(reminderRef.current)
    reminderRef.current = setInterval(() => {
      const pending = alertesRef.current
      if (pending.length === 0) return
      const j2 = pending.filter(a => a.type_alerte === 'J2')
      const j7 = pending.filter(a => a.type_alerte === 'J7')
      if (j2.length > 0) {
        toast.warning(
          `URGENT — ${j2.length} contrat${j2.length > 1 ? 's' : ''} expire${j2.length > 1 ? 'nt' : ''} dans 2 jours et n'${j2.length > 1 ? 'ont' : 'a'} pas encore été traité${j2.length > 1 ? 's' : ''}.`
        )
      }
      if (j7.length > 0) {
        toast.warning(`Rappel — ${j7.length} alerte${j7.length > 1 ? 's' : ''} J-7 en attente de traitement.`)
      }
    }, REMINDER_MS)
    return () => clearInterval(reminderRef.current)
  }, [])  // eslint-disable-line

  /* ── guard ── */
  if (loading || alertes.length === 0) return null

  /* ── handlers ── */
  const openModal = (alerte) => {
    setActive(alerte)
    setAction('')
    setNewDate('')
    setSignature(profileSig || null)   // pré-remplir avec la signature du profil
    setShowSig(false)
  }

  const closeModal = () => setActive(null)

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
        signature_data:    signature || null,
        fait_par:          String(userMatricule || ''),
      })

      if (signature) {
        try {
          const res = await api.post(
            `/api/contrats/lettre/${activeAlerte.employe_id}`,
            { type_lettre: action, date_fin_nouvelle: newDate || null, signature_data: signature, fait_par: String(userMatricule || '') },
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
      await fetchAlertes()
      setActive(null)
    } catch {
      toast.error("Erreur lors de l'enregistrement de l'action")
    } finally {
      setSubmitting(false)
    }
  }

  /* ── render ── */
  return (
    <>
{/* ─── Bannières ─── */}
      <div
        role="region"
        aria-label="Alertes de fin de contrat"
        style={{ marginBottom: 20 }}
      >
        {(() => {
          const j2count = alertes.filter(a => a.type_alerte === 'J2').length
          const hasUrgent = j2count > 0
          const total = alertes.length

          /* ── En-tête résumé (toujours visible) ── */
          const summary = (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className={hasUrgent ? 'ac-j2' : 'ac-j7'}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px', cursor: 'pointer', textAlign: 'left',
                background:   hasUrgent ? '#fff5f5' : '#fffbeb',
                border:       `1.5px solid ${hasUrgent ? '#fca5a5' : '#fcd34d'}`,
                borderLeft:   `5px solid ${hasUrgent ? '#dc2626' : '#d97706'}`,
                borderRadius: expanded ? '0 10px 0 0' : '0 10px 10px 0',
              }}
            >
              <div className={hasUrgent ? 'ac-shake' : ''} style={{ flexShrink: 0 }}>
                {hasUrgent
                  ? <IconAlert size={24} color="#dc2626" />
                  : <IconClock size={22} color="#d97706" />
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                  {total === 1
                    ? `1 fin de contrat imminente`
                    : `${total} fins de contrat imminentes`
                  }
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 1 }}>
                  {j2count > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      {j2count} urgente{j2count > 1 ? 's' : ''} (J – 2)
                    </span>
                  )}
                  {j2count > 0 && alertes.length - j2count > 0 && ' · '}
                  {alertes.length - j2count > 0 && (
                    <span style={{ color: '#b45309' }}>
                      {alertes.length - j2count} en attente (J – 7)
                    </span>
                  )}
                  {' — Cliquez pour '}{expanded ? 'réduire' : 'voir le détail'}
                </div>
              </div>
              <div style={{ flexShrink: 0, opacity: 0.6 }}>
                <IconChevron down={!expanded} size={18} color={hasUrgent ? '#dc2626' : '#d97706'} />
              </div>
            </button>
          )

          /* ── Liste déroulante ── */
          const list = expanded && (
            <div style={{
              border: `1px solid ${hasUrgent ? '#fca5a5' : '#fcd34d'}`,
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              overflow: 'hidden',
            }}>
              {alertes.map((alerte, idx) => {
                const isJ2 = alerte.type_alerte === 'J2'
                return (
                  <div
                    key={alerte.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '11px 18px', flexWrap: 'wrap',
                      background: isJ2 ? '#fff8f8' : '#fffdf0',
                      borderTop: idx > 0 ? `1px solid ${isJ2 ? '#fee2e2' : '#fef9c3'}` : 'none',
                    }}
                  >
                    <div className={isJ2 ? 'ac-shake' : ''} style={{ flexShrink: 0 }}>
                      {isJ2
                        ? <IconAlert size={20} color="#dc2626" />
                        : <IconClock size={18} color="#d97706" />
                      }
                    </div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, flexShrink: 0,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: isJ2 ? '#991b1b' : '#92400e',
                      background: isJ2 ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)',
                      padding: '2px 7px', borderRadius: 4,
                    }}>
                      {isJ2 ? 'J – 2' : 'J – 7'}
                    </span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.87rem', color: '#0f172a' }}>{alerte.nom}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 1 }}>
                        {alerte.fonction || ''}
                        {alerte.type_contrat ? ` · ${TYPE_LABELS[alerte.type_contrat] || alerte.type_contrat}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8', textTransform: 'uppercase' }}>Fin</div>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: isJ2 ? '#dc2626' : '#b45309' }}>
                        {alerte.date_fin_contrat || '—'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openModal(alerte)}
                      style={{
                        padding: '6px 16px', flexShrink: 0,
                        background: isJ2 ? '#dc2626' : '#021630', color: '#fff',
                        border: 'none', borderRadius: 6,
                        fontSize: '0.80rem', fontWeight: 700, cursor: 'pointer',
                        boxShadow: isJ2 ? '0 2px 6px rgba(220,38,38,0.25)' : 'none',
                      }}
                    >Traiter</button>
                  </div>
                )
              })}
            </div>
          )

          return <>{summary}{list}</>
        })()}
      </div>

      {/* ─── Modal d'action ─── */}
      {activeAlerte && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ac-modal-titre"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(2,22,48,0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1200, padding: 16,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: '28px 32px',
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          }}>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
              <div style={{
                flexShrink: 0, width: 42, height: 42, borderRadius: 10,
                background: activeAlerte.type_alerte === 'J2' ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${activeAlerte.type_alerte === 'J2' ? '#fca5a5' : '#fcd34d'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeAlerte.type_alerte === 'J2'
                  ? <IconAlert size={22} color="#dc2626" />
                  : <IconClock size={20} color="#d97706" />
                }
              </div>
              <div>
                <h3 id="ac-modal-titre" style={{ margin: '0 0 5px', fontSize: '1.05rem', fontWeight: 700, color: '#021630' }}>
                  Traitement du contrat
                </h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748b', lineHeight: 1.5 }}>
                  <strong style={{ color: '#0f172a' }}>{activeAlerte.nom}</strong>
                  {activeAlerte.type_contrat && (
                    <> &middot; {TYPE_LABELS[activeAlerte.type_contrat] || activeAlerte.type_contrat}</>
                  )}
                  {activeAlerte.date_fin_contrat && (
                    <> &middot; <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      {activeAlerte.date_fin_contrat}
                    </span></>
                  )}
                </p>
              </div>
            </div>

            {/* Séparateur */}
            <div style={{ borderTop: '1px solid #f1f5f9', marginBottom: 18 }} />
            <p style={{ margin: '0 0 10px', fontSize: '0.77rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Choisir une action
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {ACTIONS.map(opt => {
                const selected = action === opt.val
                return (
                  <label
                    key={opt.val}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      cursor: 'pointer', padding: '11px 14px', borderRadius: 9,
                      background: selected ? '#f0f4ff' : '#f8fafc',
                      border: `1.5px solid ${selected ? '#3b4fd8' : '#e2e8f0'}`,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="action_contrat"
                      value={opt.val}
                      checked={selected}
                      onChange={() => setAction(opt.val)}
                      style={{ marginTop: 4, accentColor: '#3b4fd8' }}
                    />
                    <div style={{
                      flexShrink: 0, width: 34, height: 34, borderRadius: 8,
                      background: selected ? 'rgba(59,79,216,0.10)' : '#fff',
                      border: `1px solid ${selected ? 'rgba(59,79,216,0.20)' : '#e2e8f0'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <opt.Icon size={17} color={opt.iconColor} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Nouvelle date */}
            {action === 'renouvellement' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Nouvelle date de fin de contrat <span style={{ color: '#dc2626' }}>*</span>
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
              <div style={{ marginBottom: 20, padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Signature</span>
                  <button
                    type="button"
                    onClick={() => setShowSig(s => !s)}
                    style={{ fontSize: '0.74rem', color: '#3b4fd8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {showSig ? 'Masquer' : signature ? 'Redessiner' : 'Dessiner manuellement'}
                  </button>
                </div>

                {/* Aperçu signature pré-chargée */}
                {signature && !showSig && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.70rem', color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>
                      {profileSig && signature === profileSig
                        ? 'Signature du profil chargée automatiquement'
                        : 'Signature personnalisée'
                      }
                    </div>
                    <div style={{
                      height: 70, border: '1px solid #d1fae5', borderRadius: 6,
                      background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      <img src={signature} alt="Aperçu signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>
                )}

                {/* Pas de signature de profil et pas dessinée */}
                {!signature && !showSig && (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Aucune signature de profil — cliquez sur "Dessiner manuellement" ou
                    {' '}<a href="/rh/profile" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#3b4fd8', textDecoration: 'underline' }}>ajoutez-en une à votre profil</a>.
                  </div>
                )}

                {showSig && (
                  <div style={{ marginTop: 8 }}>
                    <SignatureCanvas
                      width={400}
                      height={120}
                      onSave={data => { setSignature(data); setShowSig(false) }}
                      onClear={() => setSignature(profileSig || null)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
              <button
                type="button"
                onClick={closeModal}
                style={{ padding: '7px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.85rem', cursor: 'pointer', color: '#475569' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!action || submitting}
                style={{
                  padding: '7px 22px',
                  background: action && !submitting ? '#021630' : '#94a3b8',
                  color: '#fff', border: 'none', borderRadius: 7,
                  fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em',
                  cursor: action && !submitting ? 'pointer' : 'not-allowed',
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
