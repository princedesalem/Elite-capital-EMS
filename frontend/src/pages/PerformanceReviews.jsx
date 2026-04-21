import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Star, Users, Plus, X, CheckCircle, Clock, BarChart2, Search, ChevronDown } from 'lucide-react'
import '../styles/Operations.css'
import { confirmDialog } from '../components/ui/bridge'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

const COMPETENCES = [
  'Résultats & Performance', 'Collaboration & Teamwork', 'Communication',
  'Leadership & Initiative', 'Innovation & Problem Solving', 'Adaptabilité',
  'Respect des délais', 'Attitude & Engagement',
]

function StarRating({ value, onChange, size = 20 }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={(hovered || value) >= i ? '#f59e0b' : 'none'}
          stroke={(hovered || value) >= i ? '#f59e0b' : '#cbd5e1'}
          style={{ cursor: onChange ? 'pointer' : 'default', transition: 'all 0.1s' }}
          onMouseEnter={() => onChange && setHovered(i)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={() => onChange && onChange(i)}
        />
      ))}
    </div>
  )
}

function ReviewCard({ review, employees, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const reviewer = employees.find(e => String(e.matricule) === String(review.reviewer_id))
  const reviewee = employees.find(e => String(e.matricule) === String(review.reviewee_id))
  const avgScore = review.scores.length > 0
    ? (review.scores.reduce((s, v) => s + v, 0) / review.scores.length).toFixed(1)
    : 0

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: DARK, fontSize: '0.9rem' }}>
            {reviewee ? `${reviewee.prenom} ${reviewee.nom}` : `#${review.reviewee_id}`}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
            {"Évalué par"} {reviewer ? `${reviewer.prenom} ${reviewer.nom}` : `#${review.reviewer_id}`} • {new Date(review.created_at).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: avgScore >= 4 ? '#16a34a' : avgScore >= 3 ? '#d97706' : ACCENT }}>{avgScore}</div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>/ 5.0</div>
        </div>
        <StarRating value={Math.round(avgScore)} size={14} />
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#64748b' }}>
          <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
        <button onClick={() => onDelete(review.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: ACCENT }}>
          <X size={14} />
        </button>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px' }}>
          {COMPETENCES.map((comp, i) => (
            <div key={comp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < COMPETENCES.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>{comp}</span>
              <StarRating value={review.scores[i] || 0} size={14} />
            </div>
          ))}
          {review.commentaire && (
            <div style={{ marginTop: 12, padding: '10px', background: 'var(--bg)', borderRadius: 7, fontSize: '0.82rem', color: '#475569', fontStyle: 'italic' }}>
              " {review.commentaire} "
            </div>
          )}
          {review.points_forts && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#021630' }}>{"Points forts"}:</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#334155' }}>{review.points_forts}</p>
            </div>
          )}
          {review.points_amelioration && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{"Axes d'amélioration"}:</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#334155' }}>{review.points_amelioration}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PerformanceReviews() {
  const { user } = useAuth()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(user?.role || '')
  const [employees, setEmployees] = useState([])
  const [reviews, setReviews] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filterReviewee, setFilterReviewee] = useState('tous')

  // Form state
  const [revieweeId, setRevieweeId] = useState('')
  const [scores, setScores] = useState(Array(COMPETENCES.length).fill(3))
  const [commentaire, setCommentaire] = useState('')
  const [pointsForts, setPointsForts] = useState('')
  const [pointsAmelioration, setPointsAmelioration] = useState('')

  useEffect(() => {
    api.get('/employees/').then(r => setEmployees(r.data || [])).catch(() => {})
    loadReviews()
  }, [])

  async function loadReviews() {
    const res = await api.get('/api/performance-reviews').catch(() => ({ data: [] }))
    setReviews(Array.isArray(res.data) ? res.data : [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!revieweeId) return
    const newReview = {
      reviewer_id: user?.matricule,
      reviewee_id: revieweeId,
      scores,
      commentaire,
      points_forts: pointsForts,
      points_amelioration: pointsAmelioration,
      created_at: new Date().toISOString(),
    }
    await api.post('/api/performance-reviews', newReview).catch(() => null)
    await loadReviews()
    setShowForm(false); setRevieweeId(''); setScores(Array(COMPETENCES.length).fill(3)); setCommentaire(''); setPointsForts(''); setPointsAmelioration('')
  }

  const deleteReview = async (id) => {
    const ok = await confirmDialog({ title: 'Supprimer l’évaluation', message: 'Êtes-vous sûr de vouloir supprimer cette évaluation ?', variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    await api.delete(`/api/performance-reviews/${id}`).catch(() => null)
    await loadReviews()
  }

  const visibleEmployees = employees.filter(e => String(e.matricule) !== String(user?.matricule))

  const filtered = reviews.filter(r => {
    if (!isAdmin && String(r.reviewer_id) !== String(user?.matricule) && String(r.reviewee_id) !== String(user?.matricule)) return false
    if (filterReviewee !== 'tous' && String(r.reviewee_id) !== filterReviewee) return false
    return true
  })

  const revieweeOptions = [...new Set(reviews.map(r => String(r.reviewee_id)))]
    .map(id => employees.find(e => String(e.matricule) === id))
    .filter(Boolean)

  const avgByCompetence = COMPETENCES.map((comp, i) => {
    const vals = filtered.map(r => r.scores[i]).filter(v => v > 0)
    return { comp, avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0 }
  })

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={22} /> {"Performances 360"}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>{"Suivi et évaluation des performances"}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> {"Nouvelle évaluation"}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: DARK, fontWeight: 700 }}>{"Évaluation 360°"}</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{"Employé évalué"} <span style={{ color: ACCENT }}>*</span></label>
              <select className="form-control" value={revieweeId} onChange={e => setRevieweeId(e.target.value)} required>
                <option value="">— Sélectionner un employé —</option>
                {visibleEmployees.map(e => <option key={e.matricule} value={e.matricule}>{e.prenom} {e.nom} ({e.matricule})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 700, color: DARK, fontSize: '0.88rem' }}>{"Scores de compétences"}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {COMPETENCES.map((comp, i) => (
                  <div key={comp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 7 }}>
                    <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{comp}</span>
                    <StarRating value={scores[i]} onChange={v => { const s = [...scores]; s[i] = v; setScores(s) }} size={20} />
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>{"Points forts"}</label>
              <textarea className="form-control" rows={2} value={pointsForts} onChange={e => setPointsForts(e.target.value)} placeholder="Ce que l'employé fait particulièrement bien..." />
            </div>
            <div className="form-group">
              <label>{"Axes d'amélioration"}</label>
              <textarea className="form-control" rows={2} value={pointsAmelioration} onChange={e => setPointsAmelioration(e.target.value)} placeholder="Ce qui peut être amélioré..." />
            </div>
            <div className="form-group">
              <label>Commentaire général</label>
              <textarea className="form-control" rows={2} value={commentaire} onChange={e => setCommentaire(e.target.value)} placeholder="Votre évaluation globale..." />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">Soumettre l'évaluation</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)} style={{ background: 'var(--bg)', color: '#475569' }}>{"Annuler"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Performance overview */}
      {filtered.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 14px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>Scores moyens par compétence</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {avgByCompetence.map(({ comp, avg }) => (
              <div key={comp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 7 }}>
                <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>{comp}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StarRating value={Math.round(avg)} size={12} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: avg >= 4 ? '#021630' : avg >= 3 ? '#475569' : ACCENT }}>{avg}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem', background: 'var(--card)' }} value={filterReviewee} onChange={e => setFilterReviewee(e.target.value)}>
          <option value="tous">Tous les employés</option>
          {revieweeOptions.map(e => <option key={e.matricule} value={e.matricule}>{e.prenom} {e.nom}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>{filtered.length} évaluation(s)</span>
      </div>

      {/* Reviews list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <Star size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0 }}>{"Aucune évaluation"}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <ReviewCard key={r.id} review={r} employees={employees} onDelete={deleteReview} />
          ))}
        </div>
      )}
    </div>
  )
}
