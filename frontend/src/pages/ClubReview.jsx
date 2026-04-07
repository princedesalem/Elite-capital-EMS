import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import AvatarCircle from '../components/AvatarCircle'
import { Users, Plus, X, Star, Calendar, ChevronDown } from 'lucide-react'
import '../styles/Operations.css'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

const CLUB_TYPES = ['Sports', 'Culture & Arts', 'Tech & Innovation', 'Bien-être', 'Social', 'Professionnel', 'Autre']

function ClubCard({ club, members, activities, reviews, employees, onEdit, onDelete, onJoin, onLeave, userId, isAdmin }) {
  const [expanded, setExpanded] = useState(false)
  const isMember = (members[club.id] || []).includes(String(userId))
  const clubReviews = reviews.filter(r => r.club_id === club.id)
  const avgRating = clubReviews.length ? (clubReviews.reduce((s, r) => s + r.rating, 0) / clubReviews.length).toFixed(1) : null
  const memberList = (members[club.id] || []).map(id => employees.find(e => String(e.matricule) === id)).filter(Boolean)
  const clubActivities = (activities || []).filter(a => a.club_id === club.id).sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#475569', flexShrink: 0 }}>
            {(club.nom?.[0] || '').toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: DARK, fontSize: '0.95rem' }}>{club.nom}</span>
              <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 20, fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{club.type}</span>
              {avgRating && <span style={{ fontSize: '0.72rem', color: '#021630', fontWeight: 700 }}>{avgRating}/5</span>}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>{club.description}</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
              {memberList.length} membre(s) • {clubActivities.length} activité(s)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isMember
              ? <button onClick={() => onLeave(club.id)} style={{ padding: '5px 12px', background: '#fef2f2', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', color: ACCENT, fontWeight: 700 }}>Quitter</button>
              : <button onClick={() => onJoin(club.id)} style={{ padding: '5px 12px', background: '#f1f5f9', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', color: '#021630', fontWeight: 700 }}>Rejoindre</button>
            }
            {isAdmin && <button onClick={() => onEdit(club)} style={{ padding: '5px 8px', background: '#f1f5f9', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.7rem', color: '#475569' }}>Modifier</button>}
            {isAdmin && <button onClick={() => onDelete(club.id)} style={{ padding: '5px 8px', background: '#fef2f2', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.7rem', color: ACCENT }}>Suppr.</button>}
            <button onClick={() => setExpanded(!expanded)} style={{ padding: '5px 8px', background: '#f1f5f9', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.7rem', color: '#475569' }}>
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f8fafc', padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Members */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>MEMBRES ({memberList.length})</div>
              {memberList.length === 0 ? <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Aucun membre</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {memberList.slice(0, 6).map(emp => (
                    <div key={emp.matricule} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AvatarCircle
                        photoUrl={emp.photo_url}
                        letter={(emp.prenom?.[0] || '') + (emp.nom?.[0] || '?')}
                        size={24}
                        borderWidth={1}
                        borderColor='#cbd5e1'
                        fallbackBackground='#e2e8f0'
                      />
                      <span style={{ fontSize: '0.78rem', color: '#334155' }}>{emp.prenom} {emp.nom}</span>
                    </div>
                  ))}
                  {memberList.length > 6 && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>+{memberList.length - 6} autres</div>}
                </div>
              )}
            </div>
            {/* Last activities */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>DERNIÈRES ACTIVITÉS</div>
              {clubActivities.length === 0 ? <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Aucune activité</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {clubActivities.slice(0, 4).map(a => (
                    <div key={a.id} style={{ padding: '5px 8px', background: '#f8fafc', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: DARK }}>{a.titre}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{new Date(a.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Reviews */}
          {clubReviews.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>AVIS MEMBRES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {clubReviews.slice(0, 3).map(r => {
                  const reviewer = employees.find(e => String(e.matricule) === String(r.user_id))
                  return (
                    <div key={r.id} style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: DARK }}>{reviewer ? `${reviewer.prenom} ${reviewer.nom}` : 'Anonyme'}</span>
                        <span style={{ fontSize: '0.78rem', color: '#021630', fontWeight: 700 }}>{r.rating}/5</span>
                      </div>
                      {r.commentaire && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{r.commentaire}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClubReview() {
  const { user } = useAuth()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(user?.role || '')
  const [employees, setEmployees] = useState([])
  const [clubs, setClubs] = useState([])
  const [members, setMembers] = useState({})
  const [memberRows, setMemberRows] = useState([])
  const [activities, setActivities] = useState([])
  const [reviews, setReviews] = useState([])
  const [showClubForm, setShowClubForm] = useState(false)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [editClub, setEditClub] = useState(null)
  const [filterType, setFilterType] = useState('tous')

  const [clubForm, setClubForm] = useState({ nom: '', description: '', type: 'Sports', emoji: '' })
  const [actForm, setActForm] = useState({ club_id: '', titre: '', date: '', description: '' })
  const [reviewForm, setReviewForm] = useState({ club_id: '', rating: 5, commentaire: '' })

  useEffect(() => {
    api.get('/employees/').then(r => setEmployees(r.data || [])).catch(() => {})
    loadClubData()
  }, [])

  async function loadClubData() {
    const [clubsRes, membersRes, activitiesRes, reviewsRes] = await Promise.all([
      api.get('/api/module-store/club_review_clubs').catch(() => ({ data: [] })),
      api.get('/api/module-store/club_review_memberships').catch(() => ({ data: [] })),
      api.get('/api/module-store/club_review_activities').catch(() => ({ data: [] })),
      api.get('/api/module-store/club_review_reviews').catch(() => ({ data: [] })),
    ])

    const memberList = Array.isArray(membersRes.data) ? membersRes.data : []
    const membersMap = {}
    memberList.forEach((m) => {
      const clubId = Number(m.club_id)
      if (!membersMap[clubId]) membersMap[clubId] = []
      membersMap[clubId].push(String(m.user_id))
    })

    setClubs(Array.isArray(clubsRes.data) ? clubsRes.data : [])
    setMemberRows(memberList)
    setMembers(membersMap)
    setActivities(Array.isArray(activitiesRes.data) ? activitiesRes.data : [])
    setReviews(Array.isArray(reviewsRes.data) ? reviewsRes.data : [])
  }

  const filtered = useMemo(() => clubs.filter(c => filterType === 'tous' || c.type === filterType), [clubs, filterType])

  const submitClub = async (e) => {
    e.preventDefault()
    if (!clubForm.nom.trim()) return
    if (editClub) {
      await api.put(`/api/module-store/club_review_clubs/${editClub.id}`, { ...clubForm }).catch(() => null)
    } else {
      await api.post('/api/module-store/club_review_clubs', {
        ...clubForm,
        created_at: new Date().toISOString(),
        _actor_matricule: Number(user?.matricule || user?.sub || 0) || null
      }).catch(() => null)
    }
    await loadClubData()
    setClubForm({ nom: '', description: '', type: 'Sports', emoji: '' }); setEditClub(null); setShowClubForm(false)
  }

  const deleteClub = async (id) => {
    if (!window.confirm('Supprimer ce club ?')) return
    await api.delete(`/api/module-store/club_review_clubs/${id}`).catch(() => null)
    const relatedMemberships = memberRows.filter((m) => Number(m.club_id) === Number(id))
    const relatedActivities = activities.filter((a) => Number(a.club_id) === Number(id))
    const relatedReviews = reviews.filter((r) => Number(r.club_id) === Number(id))
    await Promise.all([
      ...relatedMemberships.map((m) => api.delete(`/api/module-store/club_review_memberships/${m.id}`).catch(() => null)),
      ...relatedActivities.map((a) => api.delete(`/api/module-store/club_review_activities/${a.id}`).catch(() => null)),
      ...relatedReviews.map((r) => api.delete(`/api/module-store/club_review_reviews/${r.id}`).catch(() => null)),
    ])
    await loadClubData()
  }

  const joinClub = async (clubId) => {
    const alreadyMember = memberRows.some((m) => Number(m.club_id) === Number(clubId) && String(m.user_id) === String(user?.matricule))
    if (alreadyMember) return
    await api.post('/api/module-store/club_review_memberships', {
      club_id: Number(clubId),
      user_id: String(user?.matricule),
      joined_at: new Date().toISOString(),
      _actor_matricule: Number(user?.matricule || user?.sub || 0) || null
    }).catch(() => null)
    await loadClubData()
  }

  const leaveClub = async (clubId) => {
    const row = memberRows.find((m) => Number(m.club_id) === Number(clubId) && String(m.user_id) === String(user?.matricule))
    if (!row) return
    await api.delete(`/api/module-store/club_review_memberships/${row.id}`).catch(() => null)
    await loadClubData()
  }

  const submitActivity = async (e) => {
    e.preventDefault()
    if (!actForm.titre.trim() || !actForm.club_id) return
    await api.post('/api/module-store/club_review_activities', {
      ...actForm,
      club_id: Number(actForm.club_id),
      created_by: user?.matricule,
      _actor_matricule: Number(user?.matricule || user?.sub || 0) || null
    }).catch(() => null)
    await loadClubData()
    setActForm({ club_id: '', titre: '', date: '', description: '' }); setShowActivityForm(false)
  }

  const submitReview = async (e) => {
    e.preventDefault()
    if (!reviewForm.club_id) return
    const exists = reviews.find(r => r.club_id === Number(reviewForm.club_id) && String(r.user_id) === String(user?.matricule))
    if (exists) { alert('Vous avez déjà évalué ce club.'); return }
    await api.post('/api/module-store/club_review_reviews', {
      ...reviewForm,
      club_id: Number(reviewForm.club_id),
      rating: Number(reviewForm.rating),
      user_id: user?.matricule,
      created_at: new Date().toISOString(),
      _actor_matricule: Number(user?.matricule || user?.sub || 0) || null
    }).catch(() => null)
    await loadClubData()
    setReviewForm({ club_id: '', rating: 5, commentaire: '' }); setShowReviewForm(false)
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              Club Review
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Clubs internes, activités et évaluations communautaires</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowReviewForm(!showReviewForm)} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
              <Star size={14} /> Évaluer un club
            </button>
            <button className="btn" onClick={() => setShowActivityForm(!showActivityForm)} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
              <Calendar size={14} /> Activité
            </button>
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => { setShowClubForm(!showClubForm); setEditClub(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={15} /> Nouveau club
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Forms */}
      {showClubForm && isAdmin && (
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: DARK, fontWeight: 700 }}>{editClub ? 'Modifier le club' : 'Nouveau club'}</h3>
            <button onClick={() => { setShowClubForm(false); setEditClub(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <form onSubmit={submitClub}>
            <div className="form-row">
              <div className="form-group" style={{ flex: '0 0 60px' }}>
                <label>Emoji</label>
                <input className="form-control" value={clubForm.emoji} onChange={e => setClubForm({ ...clubForm, emoji: e.target.value })} maxLength={2} style={{ textAlign: 'center', fontSize: '1.2rem' }} />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nom du club <span style={{ color: ACCENT }}>*</span></label>
                <input className="form-control" value={clubForm.nom} onChange={e => setClubForm({ ...clubForm, nom: e.target.value })} required placeholder="ex: Club Football Élite" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" value={clubForm.type} onChange={e => setClubForm({ ...clubForm, type: e.target.value })}>
                  {CLUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" rows={2} value={clubForm.description} onChange={e => setClubForm({ ...clubForm, description: e.target.value })} placeholder="Objectif et activités du club..." />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn btn-primary">{editClub ? 'Mettre à jour' : 'Créer le club'}</button>
              <button type="button" className="btn" onClick={() => { setShowClubForm(false); setEditClub(null) }} style={{ background: '#f1f5f9', color: '#475569' }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      {showActivityForm && (
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: DARK, fontWeight: 700 }}>Nouvelle activité</h3>
            <button onClick={() => setShowActivityForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <form onSubmit={submitActivity}>
            <div className="form-row">
              <div className="form-group">
                <label>Club <span style={{ color: ACCENT }}>*</span></label>
                <select className="form-control" value={actForm.club_id} onChange={e => setActForm({ ...actForm, club_id: e.target.value })} required>
                  <option value="">— Sélectionner —</option>
                  {clubs.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nom}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Titre <span style={{ color: ACCENT }}>*</span></label>
                <input className="form-control" value={actForm.titre} onChange={e => setActForm({ ...actForm, titre: e.target.value })} required placeholder="ex: Tournoi inter-direction" />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input className="form-control" type="date" value={actForm.date} onChange={e => setActForm({ ...actForm, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" rows={2} value={actForm.description} onChange={e => setActForm({ ...actForm, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn btn-primary">Ajouter l'activité</button>
              <button type="button" className="btn" onClick={() => setShowActivityForm(false)} style={{ background: '#f1f5f9', color: '#475569' }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      {showReviewForm && (
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: DARK, fontWeight: 700 }}>Évaluer un club</h3>
            <button onClick={() => setShowReviewForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <form onSubmit={submitReview}>
            <div className="form-row">
              <div className="form-group">
                <label>Club <span style={{ color: ACCENT }}>*</span></label>
                <select className="form-control" value={reviewForm.club_id} onChange={e => setReviewForm({ ...reviewForm, club_id: e.target.value })} required>
                  <option value="">— Sélectionner —</option>
                  {clubs.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nom}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Note (1-5)</label>
                <select className="form-control" value={reviewForm.rating} onChange={e => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'⭐'.repeat(n)} ({n}/5)</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Commentaire</label>
              <textarea className="form-control" rows={2} value={reviewForm.commentaire} onChange={e => setReviewForm({ ...reviewForm, commentaire: e.target.value })} placeholder="Votre avis sur ce club..." />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn btn-primary">Soumettre l'avis</button>
              <button type="button" className="btn" onClick={() => setShowReviewForm(false)} style={{ background: '#f1f5f9', color: '#475569' }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['tous', ...CLUB_TYPES].map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', borderColor: filterType === t ? ACCENT : '#e2e8f0', background: filterType === t ? ACCENT : 'white', color: filterType === t ? 'white' : '#64748b' }}>
            {t === 'tous' ? 'Tous' : t}
          </button>
        ))}
      </div>

      {/* Clubs */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ opacity: 0.3, marginBottom: 12 }}><div style={{ fontSize: '2.5rem', color: '#94a3b8' }}>C</div></div>
          <p style={{ margin: 0 }}>Aucun club créé pour l'instant</p>
          {isAdmin && <p style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>Créez un club pour commencer</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(club => (
            <ClubCard
              key={club.id}
              club={club}
              members={members}
              activities={activities}
              reviews={reviews}
              employees={employees}
              onEdit={(c) => { setClubForm({ nom: c.nom, description: c.description, type: c.type, emoji: c.emoji }); setEditClub(c); setShowClubForm(true) }}
              onDelete={deleteClub}
              onJoin={joinClub}
              onLeave={leaveClub}
              userId={user?.matricule}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
