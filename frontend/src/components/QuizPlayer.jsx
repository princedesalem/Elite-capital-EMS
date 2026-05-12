import React, { useState } from 'react'
import api from '../services/api'
import { toast } from './ui/bridge'

/* =============================================================================
   QuizPlayer — Lecteur de quiz CLAIR. Une question par page, validation
   immediate avec explication, score final + badge si >= 80%.

   Props :
     questions     : [{id, question, options[], bonne_reponse, explication}]
                     (les options peuvent etre melangees par le backend)
     inscriptionId : number
     leconId       : number
     onComplete    : (score:number) => void
============================================================================= */

const C = {
  navy: '#021630',
  accent: '#ce2b2b',
  green: '#15803d',
  greenBg: '#dcfce7',
  red: '#b91c1c',
  redBg: '#fee2e2',
  amber: '#b45309',
  amberBg: '#fef3c7',
  ink: '#0f172a',
  inkSoft: '#475569',
  line: '#e2e8f0',
  soft: '#f1f5f9',
  white: '#ffffff',
}

const Icon = {
  check: (p={}) => (
    <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  x: (p={}) => (
    <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  info: (p={}) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  ),
  trophy: (p={}) => (
    <svg viewBox="0 0 24 24" width={p.s||40} height={p.s||40} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  ),
}

export default function QuizPlayer({ questions = [], inscriptionId, leconId, onComplete }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!questions.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.inkSoft, fontStyle: 'italic' }}>
        Aucune question disponible pour ce quiz pour le moment.
      </div>
    )
  }

  if (result) return <QuizResults result={result} onClose={() => onComplete?.(result.score)} />

  const q = questions[current]
  const isLast = current === questions.length - 1
  const pct = Math.round(((current) / questions.length) * 100)

  const submit = async (allAnswers) => {
    setSubmitting(true)
    try {
      const res = await api.post('/api/academy/quiz/submit', {
        inscription_id: inscriptionId,
        lecon_id: leconId,
        reponses_detaillees: allAnswers,
      })
      setResult(res.data)
    } catch {
      toast.error('Erreur lors de la soumission du quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    const ans = {
      question_id: q.id,
      option_text: (q.options || [])[selected],
    }
    const next = [...answers, ans]
    setAnswers(next)
    if (isLast) {
      submit(next)
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
      setConfirmed(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Progress */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '.78rem', color: C.inkSoft, fontWeight: 600 }}>
            Question {current + 1} sur {questions.length}
          </span>
          <span style={{ fontSize: '.78rem', color: C.inkSoft }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: C.soft, borderRadius: 99 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: C.navy, borderRadius: 99, transition: 'width .3s' }} />
        </div>
      </div>

      {/* Question card */}
      <div style={{
        background: C.white, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: 28, boxShadow: '0 2px 8px rgba(2,22,48,0.05)',
      }}>
        <div style={{ fontSize: '1.08rem', fontWeight: 600, color: C.ink, marginBottom: 22, lineHeight: 1.5 }}>
          {q.question}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(q.options || []).map((opt, idx) => {
            const isCorrect = confirmed && idx === q.bonne_reponse
            const isWrong = confirmed && idx === selected && idx !== q.bonne_reponse
            const isSelected = selected === idx
            let bg = C.white, border = C.line, color = C.ink
            if (isSelected && !confirmed) { bg = '#eff6ff'; border = C.navy; color = C.navy }
            if (isCorrect)  { bg = C.greenBg; border = C.green; color = C.green }
            if (isWrong)    { bg = C.redBg; border = C.red; color = C.red }
            return (
              <button
                key={idx}
                onClick={() => !confirmed && setSelected(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
                  background: bg, border: `1.5px solid ${border}`, borderRadius: 10,
                  cursor: confirmed ? 'default' : 'pointer', textAlign: 'left', color,
                  fontSize: '.95rem', fontWeight: 500, fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
              >
                <span style={{
                  width: 30, height: 30, borderRadius: '50%',
                  border: `1.5px solid ${border}`, background: C.white,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.82rem', fontWeight: 700, color, flexShrink: 0,
                }}>
                  {isCorrect ? <Icon.check /> : isWrong ? <Icon.x /> : String.fromCharCode(65 + idx)}
                </span>
                <span style={{ flex: 1 }}>{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Explication */}
        {confirmed && q.explication && (
          <div style={{
            marginTop: 18, padding: '12px 16px',
            background: '#eff6ff', border: `1px solid #bfdbfe`,
            borderRadius: 10, display: 'flex', gap: 10,
            fontSize: '.86rem', color: C.navy, lineHeight: 1.5,
          }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><Icon.info /></span>
            <span>{q.explication}</span>
          </div>
        )}
      </div>

      {/* Boutons action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 22 }}>
        {!confirmed ? (
          <button
            onClick={() => setConfirmed(true)}
            disabled={selected === null}
            style={{
              padding: '11px 26px',
              background: selected !== null ? C.navy : C.soft,
              color: selected !== null ? '#fff' : C.inkSoft,
              border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '.92rem',
              cursor: selected !== null ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >Valider ma réponse</button>
        ) : (
          <button
            onClick={handleNext}
            disabled={submitting}
            style={{
              padding: '11px 26px', background: C.accent, color: '#fff',
              border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '.92rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{submitting ? 'Envoi…' : (isLast ? 'Voir mon score' : 'Question suivante')}</button>
        )}
      </div>
    </div>
  )
}

/* ── Ecran de résultats ─────────────────────────────────────────────────── */
function QuizResults({ result, onClose }) {
  const { score, correct, total, details, badge } = result
  const passed = score >= 80
  const palette = passed
    ? { bg: C.greenBg, color: C.green, label: 'Félicitations !' }
    : { bg: C.amberBg, color: C.amber, label: 'Continuez vos efforts' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Score header */}
      <div style={{
        padding: 32, background: palette.bg, borderRadius: 14,
        textAlign: 'center', marginBottom: 24,
      }}>
        <div style={{ color: palette.color, marginBottom: 10, display: 'inline-flex' }}>
          <Icon.trophy s={56} />
        </div>
        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: palette.color, lineHeight: 1 }}>
          {score}%
        </div>
        <div style={{ marginTop: 10, fontSize: '1.1rem', color: palette.color, fontWeight: 700 }}>
          {palette.label}
        </div>
        <div style={{ marginTop: 6, color: C.inkSoft, fontSize: '.9rem' }}>
          {correct} bonne{correct > 1 ? 's' : ''} réponse{correct > 1 ? 's' : ''} sur {total}
        </div>
        {badge && (
          <div style={{
            marginTop: 16, display: 'inline-block',
            padding: '6px 16px', borderRadius: 99, background: '#fff',
            color: C.amber, fontWeight: 700, fontSize: '.84rem',
            border: `1px solid ${C.amber}`,
          }}>Badge "Quiz réussi" obtenu</div>
        )}
      </div>

      {/* Detail */}
      <div style={{
        background: C.white, border: `1px solid ${C.line}`, borderRadius: 12,
        padding: 22, marginBottom: 22,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: C.navy }}>Détail des questions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(details || []).map((d, i) => (
            <div key={i} style={{
              padding: '12px 14px', borderRadius: 9,
              background: d.correct ? C.greenBg : C.redBg,
              borderLeft: `4px solid ${d.correct ? C.green : C.red}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: d.correct ? C.green : C.red, flexShrink: 0, marginTop: 2 }}>
                  {d.correct ? <Icon.check /> : <Icon.x />}
                </span>
                <div style={{ flex: 1, fontSize: '.88rem', color: C.ink }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.question}</div>
                  {!d.correct && d.bonne_reponse && (
                    <div style={{ fontSize: '.82rem', color: C.inkSoft }}>
                      Bonne réponse : <strong>{d.bonne_reponse}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '12px 26px', background: C.navy, color: '#fff',
            border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '.92rem',
          }}
        >Continuer</button>
      </div>
    </div>
  )
}
