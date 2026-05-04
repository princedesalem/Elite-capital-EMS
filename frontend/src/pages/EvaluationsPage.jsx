import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import {
  BarChart2, CheckCircle, Clock, Send, ChevronRight,
  User, AlertCircle, Loader, RefreshCw, Plus, FileText, Download,
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

// ---------------------------------------------------------------------------
// Grille fixe — 3 axes, 10 critères, total max 100 pts
// ---------------------------------------------------------------------------
const AXES = [
  {
    id: 'techniques',
    label: 'Compétences Techniques',
    poids: 40,
    criteres: [
      { id: 'outils',    label: 'Maîtrise des outils métier' },
      { id: 'qualite',   label: 'Qualité du travail' },
      { id: 'temps',     label: 'Gestion du temps et des priorités' },
      { id: 'autonomie', label: 'Autonomie et résolution de problèmes' },
    ],
  },
  {
    id: 'comportement',
    label: 'Comportement Professionnel',
    poids: 30,
    criteres: [
      { id: 'equipe',   label: "Esprit d'équipe et communication" },
      { id: 'regles',   label: 'Respect des règles et procédures' },
      { id: 'presence', label: 'Présence et ponctualité' },
    ],
  },
  {
    id: 'resultats',
    label: 'Résultats & Objectifs',
    poids: 30,
    criteres: [
      { id: 'objectifs',    label: 'Atteinte des objectifs fixés' },
      { id: 'initiative',   label: 'Initiative et amélioration continue' },
      { id: 'adaptabilite', label: 'Adaptabilité et gestion du changement' },
    ],
  },
]

function calcNote(axesData) {
  let total = 0
  for (const axe of AXES) {
    const ax = axesData[axe.id] || {}
    const nb = axe.criteres.length
    const sum = axe.criteres.reduce((s, c) => s + (parseFloat(ax[c.id] ?? 0) || 0), 0)
    total += (sum / (nb * 10)) * axe.poids
  }
  return Math.round(total * 100) / 100
}

function allFilled(axesData) {
  for (const axe of AXES) {
    const ax = axesData[axe.id] || {}
    for (const c of axe.criteres) {
      if (ax[c.id] === undefined || ax[c.id] === '') return false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// Barre de workflow
// ---------------------------------------------------------------------------
const STEPS = [
  { key: 'EN_ATTENTE_AUTO_EVAL', label: 'Auto-évaluation', Icon: User },
  { key: 'auto_done',            label: 'Soumise',          Icon: Send },
  { key: 'EN_COURS',             label: 'Évaluation N+1',   Icon: Clock },
  { key: 'TERMINE',              label: 'Terminée',          Icon: CheckCircle },
]

function stepIndex(statut) {
  if (statut === 'EN_ATTENTE_AUTO_EVAL') return 0
  if (statut === 'EN_COURS') return 2
  if (statut === 'TERMINE') return 3
  return 0
}

function WorkflowBar({ statut }) {
  const active = stepIndex(statut)
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {STEPS.map((s, i) => {
        const done = i < active || (statut === 'EN_COURS' && i === 1)
        const current = i === active && statut !== 'TERMINE'
        const { Icon } = s
        return (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done || statut === 'TERMINE' ? '#16a34a' : current ? '#021630' : '#e2e8f0',
                color: done || current || statut === 'TERMINE' ? '#fff' : '#94a3b8',
                transition: 'all 0.2s',
              }}>
                <Icon size={16} />
              </div>
              <div style={{
                marginTop: 6, fontSize: '0.72rem', fontWeight: current ? 700 : 500,
                color: current ? '#021630' : done || statut === 'TERMINE' ? '#16a34a' : '#94a3b8',
                textAlign: 'center',
              }}>
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 2, height: 2, marginBottom: 20,
                background: done || (statut === 'TERMINE') ? '#16a34a' : '#e2e8f0',
                transition: 'background 0.2s',
              }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulaire d'évaluation (auto-eval ou N+1)
// ---------------------------------------------------------------------------
function EvalForm({ onSubmit, submitting, reference = null, title = "Mon auto-évaluation" }) {
  const [axesData, setAxesData] = useState({})
  const [commentaire, setCommentaire] = useState('')

  const setNote = (axeId, critId, val) => {
    const v = Math.max(0, Math.min(10, parseFloat(val) || 0))
    setAxesData(prev => ({
      ...prev,
      [axeId]: { ...(prev[axeId] || {}), [critId]: v },
    }))
  }

  const note = calcNote(axesData)
  const filled = allFilled(axesData)
  const noteColor = note >= 70 ? '#16a34a' : note >= 50 ? '#d97706' : '#dc2626'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#021630', fontWeight: 800 }}>{title}</h3>
        <div style={{
          padding: '6px 18px', borderRadius: 999, fontWeight: 800, fontSize: '1.1rem',
          background: '#f8fafc', border: `2px solid ${noteColor}`, color: noteColor,
        }}>
          {note.toFixed(1)} / 100
        </div>
      </div>

      {AXES.map(axe => {
        const refAx = reference && reference.axes ? (reference.axes[axe.id] || {}) : {}
        const axScore = axe.criteres.reduce(
          (s, c) => s + (parseFloat((axesData[axe.id] || {})[c.id] ?? 0) || 0), 0
        )
        const axMax = axe.criteres.length * 10
        return (
          <div key={axe.id} style={{
            marginBottom: 18, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px', background: '#021630', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{axe.label}</span>
              <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                {axScore} / {axMax} pts → contribution max {axe.poids} pts
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Critère</th>
                  {reference && <th style={{ padding: '8px 10px', textAlign: 'center', width: 90, fontSize: '0.78rem', color: '#64748b' }}>Auto-éval</th>}
                  <th style={{ padding: '8px 10px', textAlign: 'center', width: 110, fontSize: '0.78rem', color: '#64748b' }}>Note / 10</th>
                </tr>
              </thead>
              <tbody>
                {axe.criteres.map((c, ci) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9', background: ci % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#334155' }}>{c.label}</td>
                    {reference && (
                      <td style={{ textAlign: 'center', padding: '10px', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                        {refAx[c.id] !== undefined ? `${refAx[c.id]}/10` : '—'}
                      </td>
                    )}
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0" max="10" step="0.5"
                        value={(axesData[axe.id] || {})[c.id] ?? ''}
                        onChange={e => setNote(axe.id, c.id, e.target.value)}
                        placeholder="0"
                        style={{
                          width: 70, padding: '5px 8px', borderRadius: 6, textAlign: 'center',
                          border: '1.5px solid #cbd5e1', fontWeight: 700, fontSize: '0.9rem',
                          outline: 'none',
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontWeight: 600, color: '#334155', fontSize: '0.85rem', marginBottom: 5 }}>
          Commentaire (optionnel)
        </label>
        <textarea
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          rows={3}
          placeholder="Remarques, contexte, éléments explicatifs…"
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '8px 12px',
            fontSize: '0.85rem', resize: 'vertical',
          }}
        />
      </div>

      <button
        onClick={() => onSubmit({ axes: axesData, commentaire })}
        disabled={submitting || !filled}
        style={{
          width: '100%', padding: '11px', borderRadius: 8,
          background: filled ? '#021630' : '#e2e8f0',
          color: filled ? '#fff' : '#94a3b8',
          border: 'none', cursor: filled && !submitting ? 'pointer' : 'default',
          fontWeight: 800, fontSize: '0.92rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
        }}
      >
        {submitting
          ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Envoi en cours…</>
          : !filled
            ? 'Remplissez tous les critères pour soumettre'
            : <><Send size={15} /> Soumettre l évaluation</>}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Affichage read-only d une évaluation (auto ou N+1)
// ---------------------------------------------------------------------------
function EvalReadOnly({ evalData, label }) {
  if (!evalData) return null
  const axes = evalData.axes || {}
  const note = evalData.note !== undefined ? evalData.note : calcNote(axes)
  const noteColor = note >= 70 ? '#16a34a' : note >= 50 ? '#d97706' : '#dc2626'

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 16px', background: '#f8fafc',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <span style={{ fontWeight: 700, color: '#021630', fontSize: '0.9rem' }}>{label}</span>
        <span style={{ fontWeight: 800, color: noteColor, fontSize: '1rem' }}>{parseFloat(note).toFixed(1)} / 100</span>
      </div>
      {AXES.map(axe => {
        const ax = axes[axe.id] || {}
        return (
          <div key={axe.id}>
            <div style={{ padding: '6px 14px', background: '#f1f5f9', fontSize: '0.78rem', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
              {axe.label}
            </div>
            {axe.criteres.map((c, ci) => (
              <div key={c.id} style={{
                display: 'flex', justifyContent: 'space-between', padding: '7px 16px',
                borderBottom: '1px solid #f1f5f9', background: ci % 2 === 0 ? '#fff' : '#fafafa',
                fontSize: '0.83rem',
              }}>
                <span style={{ color: '#334155' }}>{c.label}</span>
                <span style={{ fontWeight: 700, color: '#021630' }}>{ax[c.id] !== undefined ? `${ax[c.id]} / 10` : '—'}</span>
              </div>
            ))}
          </div>
        )
      })}
      {evalData.commentaire && (
        <div style={{ padding: '10px 16px', background: '#fffbeb', borderTop: '1px solid #fde68a', fontSize: '0.83rem', color: '#92400e' }}>
          <strong>Commentaire :</strong> {evalData.commentaire}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Carte d une évaluation (statut + contenu)
// ---------------------------------------------------------------------------
function EvalCard({ ev, onSoumettre, onEvaluer, isEvaluateur }) {
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const printRef = useRef()
  const statut = ev.statut

  const exportEvalPDF = async () => {
    const el = printRef.current
    if (!el) return
    setExporting(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const imgW = pageW - margin * 2
      const imgH = (canvas.height * imgW) / canvas.width
      let heightLeft = imgH
      let y = margin
      pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH)
      heightLeft -= (pageH - margin * 2)
      while (heightLeft > 0) {
        pdf.addPage()
        y = margin - (imgH - heightLeft)
        pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH)
        heightLeft -= (pageH - margin * 2)
      }
      const nom = (ev.employe_nom || ev.matricule_employe || 'evaluation').replace(/[^A-Za-z0-9_-]/g, '_')
      const annee = ev.annee || new Date().getFullYear()
      pdf.save(`evaluation_${nom}_${annee}.pdf`)
    } catch (e) {
      alert(e.message || "Erreur lors de l'export PDF")
    } finally {
      setExporting(false)
    }
  }

  const handleSoumettre = async (data) => {
    setSubmitting(true)
    try { await onSoumettre(ev.id_eval, data) } catch (e) { alert(e.response?.data?.detail || 'Erreur') }
    finally { setSubmitting(false) }
  }

  const handleEvaluer = async (data) => {
    setSubmitting(true)
    try { await onEvaluer(ev.id_eval, data) } catch (e) { alert(e.response?.data?.detail || 'Erreur') }
    finally { setSubmitting(false) }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 16 }}>
      <WorkflowBar statut={statut} />

      {statut === 'EN_ATTENTE_AUTO_EVAL' && !isEvaluateur && (
        <EvalForm onSubmit={handleSoumettre} submitting={submitting} title="Mon auto-évaluation" />
      )}

      {statut === 'EN_ATTENTE_AUTO_EVAL' && isEvaluateur && (
        <div style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
          <Clock size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>En attente de l auto-évaluation de l employé</p>
        </div>
      )}

      {statut === 'EN_COURS' && !isEvaluateur && (
        <div>
          <div style={{
            marginBottom: 20, padding: '12px 16px', background: '#eff6ff',
            border: '1px solid #bfdbfe', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', color: '#1e40af',
          }}>
            <Clock size={16} />
            En attente de l évaluation de{' '}
            <strong>{ev.evaluateur_nom || 'votre responsable'}</strong>
            {ev.evaluateur_role && <span style={{ opacity: 0.7 }}> ({ev.evaluateur_role})</span>}
          </div>
          <EvalReadOnly evalData={ev.auto_evaluation} label="Votre auto-évaluation" />
        </div>
      )}

      {statut === 'EN_COURS' && isEvaluateur && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <EvalReadOnly evalData={ev.auto_evaluation} label="Auto-évaluation de l employé" />
          </div>
          <EvalForm
            onSubmit={handleEvaluer}
            submitting={submitting}
            reference={ev.auto_evaluation}
            title="Évaluation hiérarchique (N+1)"
          />
        </div>
      )}

      {statut === 'TERMINE' && (
        <div>
          <div ref={printRef}>
            <div style={{
              marginBottom: 20, padding: '14px 18px', background: '#f0fdf4',
              border: '1px solid #86efac', borderRadius: 8, textAlign: 'center',
            }}>
              <CheckCircle size={22} style={{ color: '#16a34a', marginBottom: 6 }} />
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#15803d' }}>
                Note finale : {ev.note_finale !== null && ev.note_finale !== undefined ? parseFloat(ev.note_finale).toFixed(1) : '—'} / 100
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4d7c0f', marginTop: 4 }}>
                Auto-éval (30%) + Évaluation N+1 (70%)
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <EvalReadOnly evalData={ev.auto_evaluation} label="Auto-évaluation" />
              <EvalReadOnly evalData={ev.evaluation_n1} label={ev.evaluateur_nom ? `Évaluation N+1 — ${ev.evaluateur_nom}` : 'Évaluation N+1'} />
            </div>
          </div>
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button
              onClick={exportEvalPDF}
              disabled={exporting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 20px',
                background: exporting ? '#94a3b8' : '#1e40af', color: '#fff',
                border: 'none', borderRadius: 8, cursor: exporting ? 'not-allowed' : 'pointer',
                fontSize: '0.88rem', fontWeight: 600,
              }}
            >
              <Download size={15} />
              {exporting ? 'Export en cours…' : 'Exporter PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------
export default function EvaluationsPage() {
  const { user } = useAuth()
  const matricule = String(user?.matricule || user?.sub || '')
  const role = (user?.role || '').toUpperCase()
  const canInitiate = ['RH', 'ADMIN', 'DIRECTEUR', 'RESPONSABLE', 'DG'].includes(role)

  const [tab, setTab] = useState('mes')
  const [mesEvals, setMesEvals] = useState([])
  const [aEvaluer, setAEvaluer] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [initTarget, setInitTarget] = useState('')
  const [initiating, setInitiating] = useState(false)

  const headers = useCallback(() => {
    const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
    return { Authorization: `Bearer ${token}` }
  }, [])

  const load = useCallback(async () => {
    if (!matricule) return
    setLoading(true); setError('')
    try {
      const [r1, r2] = await Promise.all([
        axios.get(`${API}/api/evaluations/mes-evaluations-v2/${matricule}`, { headers: headers() }),
        axios.get(`${API}/api/evaluations/a-evaluer-v2/${matricule}`, { headers: headers() }),
      ])
      setMesEvals(Array.isArray(r1.data) ? r1.data : [])
      setAEvaluer(Array.isArray(r2.data) ? r2.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [matricule, headers])

  useEffect(() => { load() }, [load])

  const loadDetail = useCallback(async (id) => {
    const r = await axios.get(`${API}/api/evaluations/${id}/detail`, { headers: headers() })
    return r.data
  }, [headers])

  const [mesEvalsDetail, setMesEvalsDetail] = useState([])
  const [aEvaluerDetail, setAEvaluerDetail] = useState([])

  useEffect(() => {
    if (!mesEvals.length && !aEvaluer.length) {
      setMesEvalsDetail([])
      setAEvaluerDetail([])
      return
    }
    const fetchAll = async () => {
      const me = await Promise.all(mesEvals.map(e => loadDetail(e.id_eval).catch(() => e)))
      const ae = await Promise.all(aEvaluer.map(e => loadDetail(e.id_eval).catch(() => e)))
      setMesEvalsDetail(me)
      setAEvaluerDetail(ae)
    }
    fetchAll()
  }, [mesEvals, aEvaluer, loadDetail])

  const handleSoumettre = async (id, data) => {
    await axios.post(`${API}/api/evaluations/${id}/soumettre-auto`, data, { headers: headers() })
    await load()
  }

  const handleEvaluer = async (id, data) => {
    await axios.post(`${API}/api/evaluations/${id}/evaluer`, data, { headers: headers() })
    await load()
  }

  const handleInitier = async () => {
    const mat = initTarget.trim().toUpperCase()
    if (!mat) return
    setInitiating(true)
    try {
      await axios.post(`${API}/api/evaluations/initier`, { matricule: mat }, { headers: headers() })
      setInitTarget('')
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || "Erreur lors de l'initiation")
    } finally {
      setInitiating(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '28px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, color: '#021630', fontSize: '1.3rem', fontWeight: 800 }}>
          <BarChart2 size={22} /> Évaluations
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: '#64748b', fontSize: '0.82rem', textDecoration: 'none' }}>← Accueil</Link>
          <button
            onClick={load}
            title="Rafraîchir"
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#64748b' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {canInitiate && (
        <div style={{
          marginBottom: 22, padding: '14px 18px', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: 10,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <Plus size={15} style={{ color: '#475569', flexShrink: 0 }} />
          <span style={{ fontSize: '0.88rem', color: '#475569', flexShrink: 0 }}>Initier une évaluation :</span>
          <input
            value={initTarget}
            onChange={e => setInitTarget(e.target.value)}
            placeholder="Matricule de l'employé"
            style={{
              flex: 1, minWidth: 160, padding: '7px 10px', borderRadius: 7,
              border: '1.5px solid #cbd5e1', fontSize: '0.88rem',
            }}
          />
          <button
            onClick={handleInitier}
            disabled={initiating || !initTarget.trim()}
            style={{
              padding: '7px 16px', background: '#021630', color: '#fff',
              border: 'none', borderRadius: 7, cursor: initiating || !initTarget.trim() ? 'default' : 'pointer',
              fontWeight: 700, fontSize: '0.85rem',
              opacity: !initTarget.trim() ? 0.5 : 1,
            }}
          >
            {initiating ? 'Initiation…' : 'Initier'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 22 }}>
        {[
          ['mes', 'Mes évaluations', mesEvals.length],
          ['a-evaluer', 'À évaluer', aEvaluer.length],
        ].map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontWeight: tab === key ? 800 : 500, fontSize: '0.88rem',
              color: tab === key ? '#021630' : '#64748b',
              borderBottom: tab === key ? '2.5px solid #021630' : '2.5px solid transparent',
              marginBottom: -2, display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {label}
            {count > 0 && (
              <span style={{
                padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem',
                background: tab === key ? '#021630' : '#e2e8f0',
                color: tab === key ? '#fff' : '#475569',
              }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: '0.88rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <Loader size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <div>Chargement…</div>
        </div>
      )}

      {!loading && tab === 'mes' && (
        <>
          {mesEvalsDetail.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 12 }}>
              <FileText size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#334155' }}>Aucune évaluation</p>
              <p style={{ margin: 0, fontSize: '0.83rem' }}>Votre responsable peut initier une évaluation pour vous.</p>
            </div>
          ) : (
            mesEvalsDetail.map(ev => (
              <EvalCard
                key={ev.id_eval}
                ev={ev}
                onSoumettre={handleSoumettre}
                onEvaluer={handleEvaluer}
                isEvaluateur={false}
              />
            ))
          )}
        </>
      )}

      {!loading && tab === 'a-evaluer' && (
        <>
          {aEvaluerDetail.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 12 }}>
              <CheckCircle size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#334155' }}>Aucune évaluation en attente</p>
            </div>
          ) : (
            aEvaluerDetail.map(ev => (
              <div key={ev.id_eval} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <User size={14} style={{ color: '#475569' }} />
                  <span style={{ fontWeight: 700, color: '#021630', fontSize: '0.9rem' }}>
                    {ev.employe_nom}
                  </span>
                  {ev.employe_fonction && (
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>— {ev.employe_fonction}</span>
                  )}
                  {ev.note_auto !== null && ev.note_auto !== undefined && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#475569', background: '#e2e8f0', padding: '2px 8px', borderRadius: 999 }}>
                      Auto-éval : {parseFloat(ev.note_auto).toFixed(1)}/100
                    </span>
                  )}
                </div>
                <EvalCard
                  ev={ev}
                  onSoumettre={handleSoumettre}
                  onEvaluer={handleEvaluer}
                  isEvaluateur={true}
                />
              </div>
            ))
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
