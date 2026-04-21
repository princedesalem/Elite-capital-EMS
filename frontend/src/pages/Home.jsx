import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import AvatarCircle from '../components/AvatarCircle'
import { BarChart2, LogOut, Star, MessageSquare, ThumbsUp, BarChart, Send, Plus, X, ChevronDown, Search, Gift, Users, Briefcase, Clock, MoreVertical, Pencil, Trash2, CheckCircle } from 'lucide-react'
import { toast, confirmDialog } from '../components/ui/bridge'

// -- Team Engagement (backend persisted) --
const WISHES_KEY = 'ems_wishes_v1'
const loadLS = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
const saveLS = (key, data) => localStorage.setItem(key, JSON.stringify(data))

function Icon({ name, size = 20, stroke = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const icons = {
    user: (<><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></>),
    badge: (<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8" /><path d="M8 13h5" /></>),
    role: (<><path d="M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7l-8-4Z" /><path d="m9.5 12 1.5 1.5 3.5-3.5" /></>),
    email: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>),
    calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>),
    org: (<><path d="M12 4v5" /><path d="M6 14h12" /><rect x="3" y="14" width="6" height="6" rx="1" /><rect x="15" y="14" width="6" height="6" rx="1" /><rect x="9" y="8" width="6" height="4" rx="1" /></>),
    fonction: (<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M12 12v3" /><path d="M10.5 13.5h3" /></>),
  }

  return <svg {...common}>{icons[name]}</svg>
}

export default function Home() {
    // Heart animation and like logic
    const [likeHearts, setLikeHearts] = useState({});
    const [likes, setLikes] = useState({});

    function handleDoubleClick(postId) {
      setLikeHearts(prev => ({ ...prev, [postId]: true }));
      setLikes(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
      // Also increment the main React count
      const post = filteredFeed.find(f => f.id === postId);
      if (post) likePost(post._type, postId);
      setTimeout(() => setLikeHearts(prev => ({ ...prev, [postId]: false })), 900);
    }
  const { user, logout } = useAuth()
  const [employe, setEmploye] = useState(null)
  const [stats, setStats] = useState({ employees: 0, leaves: 0, pending: 0 })
  const [createModal, setCreateModal] = useState(null)
  const [createForm, setCreateForm] = useState({ nom: '', id_entite: '', id_direction: '' })

  // Team Engagement state
  const [shoutouts, setShoutouts] = useState([])
  const [kudos, setKudos] = useState([])
  const [polls, setPolls] = useState([])
  const [showShoutoutForm, setShowShoutoutForm] = useState(false)
  const [showKudosForm, setShowKudosForm] = useState(false)
  const [showPollForm, setShowPollForm] = useState(false)
  const [shoutoutForm, setShoutoutForm] = useState({ destinataire: '', message: '' })
  const [kudosForm, setKudosForm] = useState({ destinataire: '', raison: '', valeur: 'Excellence' })
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] })

  const [allEmployees, setAllEmployees] = useState([])
  const [operations, setOperations] = useState([])
  const [sorties, setSorties] = useState([])
  const [wishes, setWishes] = useState(() => loadLS(WISHES_KEY))
  const [audienceType, setAudienceType] = useState('all')
  const [audienceSelected, setAudienceSelected] = useState([])
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [dbEntites, setDbEntites] = useState([])
  const [dbDirections, setDbDirections] = useState([])
  const [dbDepartements, setDbDepartements] = useState([])
  const [filterType, setFilterType] = useState('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [postMenuOpen, setPostMenuOpen] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const [editPostForm, setEditPostForm] = useState({})
  const postMenuRef = useRef(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveSuccess, setLeaveSuccess] = useState('')
  const [leaveModalForm, setLeaveModalForm] = useState({ date_debut: '', date_fin: '', motif: '' })
  const [leaveModalMsg, setLeaveModalMsg] = useState(null)
  const birthdayRef = useRef(null)

  useEffect(() => {
    const matricule = Number(user?.matricule || user?.sub || 0)
    if (matricule) {
      api.get(`/employees/${matricule}`).then(r => {
        setEmploye(r.data)
      }).catch(() => {})
    }
    // Fetch simple stats
    api.get('/employees/').then(r => {
      setStats(prev => ({ ...prev, employees: r.data.length }))
      setAllEmployees(r.data)
    }).catch(() => {})
    api.get('/api/operations').then(r => setOperations(r.data)).catch(() => {})
    // Sorties list loaded via workflow boite in the new pages; skip global fetch here
    // Fetch org structure from DB
    api.get('/employees/autocomplete/entites').then(r => setDbEntites(r.data)).catch(() => {})
    api.get('/employees/autocomplete/directions').then(r => setDbDirections(r.data)).catch(() => {})
    api.get('/employees/autocomplete/departements').then(r => setDbDepartements(r.data)).catch(() => {})
    loadTeamSpacePosts()
  }, [user])

  const splitTeamPosts = (posts) => {
    const nextShoutouts = []
    const nextKudos = []
    const nextPolls = []
    ;(Array.isArray(posts) ? posts : []).forEach((p) => {
      const base = {
        id: p.id,
        from: p.from,
        date: p.date,
        created_at: p.created_at || null,
        destinataire: p.destinataire || '',
        message: p.message || '',
        valeur: p.valeur || '',
        raison: p.raison || '',
        question: p.question || '',
        options: Array.isArray(p.options) ? p.options : [],
        votedBy: Array.isArray(p.votedBy) ? p.votedBy : [],
        likes: Number(p.likes || 0),
        audience: p.audience || { type: 'all', selected: [] }
      }
      if (p.type === 'shoutout') nextShoutouts.push(base)
      if (p.type === 'kudos') nextKudos.push(base)
      if (p.type === 'poll') nextPolls.push(base)
    })
    setShoutouts(nextShoutouts)
    setKudos(nextKudos)
    setPolls(nextPolls)
  }

  const loadTeamSpacePosts = async () => {
    try {
      const res = await api.get('/api/team-space/posts', { params: { limit: 150 } })
      splitTeamPosts(res.data)
    } catch (_) {
      setShoutouts([])
      setKudos([])
      setPolls([])
    }
  }

  const calculateAnciennete = (dateEmbauche) => {
    if (!dateEmbauche) return 'N/A'
    const date = new Date(dateEmbauche)
    const today = new Date()
    const diffTime = today - date
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365.25)
    const months = Math.floor((diffDays % 365.25) / 30.44)
    
    if (years === 0) return `${months} mois`
    if (months === 0) return `${years} an${years > 1 ? 's' : ''}`
    return `${years} an${years > 1 ? 's' : ''} ${months} mois`
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bonsoir'
    return 'Bonne nuit'
  }

  const handleLeaveModalSubmit = async (e) => {
    e.preventDefault()
    setLeaveModalMsg(null)
    try {
      await api.post('/api/conges/demande', null, {
        params: {
          matricule: user?.matricule,
          matricule_createur: user?.matricule,
          date_debut: leaveModalForm.date_debut,
          date_fin: leaveModalForm.date_fin,
          ...(leaveModalForm.motif ? { motif: leaveModalForm.motif } : {})
        }
      })
      setLeaveModalForm({ date_debut: '', date_fin: '', motif: '' })
      setLeaveModalMsg(null)
      setShowLeaveModal(false)
      setLeaveSuccess('Votre demande de congé a été soumise avec succès.')
    } catch (err) {
      setLeaveModalMsg(err?.response?.data?.detail || 'Erreur lors de la soumission.')
    }
  }

  const createAdminItem = async (e) => {
    e.preventDefault()
    try {
      if (createModal === 'entite') {
        await api.post('/employees/create-entite', null, { params: { nom: createForm.nom } })
        toast.success('Entité créée avec succès')
      } else if (createModal === 'direction') {
        await api.post('/employees/create-direction', null, { params: { nom: createForm.nom, id_entite: createForm.id_entite } })
        toast.success('Direction créée avec succès')
      } else if (createModal === 'departement') {
        await api.post('/employees/create-departement', null, { params: { nom: createForm.nom, id_entite: createForm.id_entite, id_direction: createForm.id_direction } })
        toast.success('Département créé avec succès')
      }
      setCreateModal(null)
      setCreateForm({ nom: '', id_entite: '', id_direction: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  const roleAffiche = String(
    employe?.role?.name || employe?.role || user?.role || employe?.fonction || 'EMPLOYE'
  ).toUpperCase()

  const entiteAffiche = employe?.entite || employe?.nom_entite || employe?.id_entite || 'Non renseignée'
  const soldeCp = employe?.solde_conge ?? employe?.solde_conges ?? employe?.solde_conges_annuels ?? employe?.nb_jours_conge_restants ?? null

  // -- Upcoming birthdays --
  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    return allEmployees
      .filter(e => e.date_naissance)
      .map(e => {
        const dn = new Date(e.date_naissance)
        const next = new Date(today.getFullYear(), dn.getMonth(), dn.getDate())
        if (next < today) next.setFullYear(next.getFullYear() + 1)
        const daysUntil = Math.ceil((next - today) / 86400000)
        return { ...e, nextBirthday: next, daysUntil }
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 20)
  }, [allEmployees])

  const normalizeAvatarKey = (value) => String(value || '').trim().toLowerCase()

  const employeeAvatarIndex = useMemo(() => {
    const index = new Map()
    allEmployees.forEach((emp) => {
      const fullName = normalizeAvatarKey(`${emp.prenom || ''} ${emp.nom || ''}`)
      const prenom = normalizeAvatarKey(emp.prenom)
      const matricule = normalizeAvatarKey(emp.matricule)
      if (fullName) index.set(fullName, emp)
      if (prenom && !index.has(prenom)) index.set(prenom, emp)
      if (matricule) index.set(matricule, emp)
    })
    return index
  }, [allEmployees])

  const resolvePhotoUrl = (identity) => {
    const key = normalizeAvatarKey(identity)
    if (!key) return null

    const currentMatricule = normalizeAvatarKey(user?.matricule || user?.sub)
    if (key === currentMatricule) return employe?.photo_url || null

    const fullCurrentName = normalizeAvatarKey(`${employe?.prenom || user?.prenom || ''} ${employe?.nom || user?.nom || ''}`)
    if (key === fullCurrentName) return employe?.photo_url || null

    const found = employeeAvatarIndex.get(key)
    return found?.photo_url || null
  }

  // -- Employees currently on leave / permission / mission / sortie --
  const employeesAbsent = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const fromOps = operations
      .filter(op => op.date_depart && op.date_retour && op.date_depart <= today && op.date_retour >= today)
      .map(op => {
        const emp = allEmployees.find(e => e.matricule === op.matricule)
        return { ...op, nom: emp?.nom, prenom: emp?.prenom }
      })
    const fromSorties = sorties
      .filter(s => s.date_sortie === today && s.statut === 'validé')
      .map(s => {
        const emp = allEmployees.find(e => e.matricule === s.matricule)
        return { ...s, type: 'SORTIE', nom: emp?.nom, prenom: emp?.prenom }
      })
    return [...fromOps, ...fromSorties]
  }, [operations, sorties, allEmployees])

  // -- Filtered feed --
  const filteredFeed = useMemo(() => {
    let feed = [
      ...shoutouts.map(s => ({ ...s, _type: 'shoutout' })),
      ...kudos.map(k => ({ ...k, _type: 'kudos' })),
      ...polls.map(p => ({ ...p, _type: 'poll' })),
    ].sort((a, b) => b.id - a.id)
    if (filterType !== 'all') feed = feed.filter(f => f._type === filterType)
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase()
      feed = feed.filter(f =>
        (f.from || '').toLowerCase().includes(q) ||
        (f.destinataire || '').toLowerCase().includes(q) ||
        (f.message || '').toLowerCase().includes(q) ||
        (f.question || '').toLowerCase().includes(q)
      )
    }
    return feed.slice(0, 20)
  }, [shoutouts, kudos, polls, filterType, filterSearch])

  // -- Birthday wishes --
  const sendWishes = (matricule) => {
    const key = `${matricule}_${new Date().toISOString().slice(0, 10)}`
    if (wishes.includes(key)) return
    const updated = [...wishes, key]
    setWishes(updated); saveLS(WISHES_KEY, updated)
  }
  const hasWished = (matricule) => wishes.includes(`${matricule}_${new Date().toISOString().slice(0, 10)}`)

  // -- Audience helpers --
  const audienceLabel = audienceType === 'all' ? 'Tout le monde' : `${audienceSelected.length} sélection(s)`
  const toggleAudienceItem = (label) => {
    setAudienceSelected(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label])
  }
  const resetAudience = () => { setAudienceType('all'); setAudienceSelected([]); setAudienceOpen(false) }

  // Engagement handlers
  const submitShoutout = async (e) => {
    e.preventDefault()
    if (!shoutoutForm.destinataire.trim() || !shoutoutForm.message.trim()) return
    try {
      await api.post('/api/team-space/posts', {
        type: 'shoutout',
        from: employe?.prenom || user?.prenom || 'Moi',
        from_matricule: Number(user?.matricule || user?.sub || 0) || null,
        destinataire: shoutoutForm.destinataire,
        message: shoutoutForm.message,
        likes: 0,
        audience: { type: audienceType, selected: [...audienceSelected] }
      })
      await loadTeamSpacePosts()
      setShoutoutForm({ destinataire: '', message: '' })
      setShowShoutoutForm(false)
      resetAudience()
    } catch (_) {}
  }
  const likePost = async (type, id) => {
    try {
      const res = await api.patch(`/api/team-space/posts/${id}/like`)
      const updated = {
        id: res.data?.id,
        likes: Number(res.data?.likes || 0)
      }
      if (type === 'shoutout') {
        setShoutouts((prev) => prev.map((s) => s.id === updated.id ? { ...s, likes: updated.likes } : s))
      } else if (type === 'kudos') {
        setKudos((prev) => prev.map((k) => k.id === updated.id ? { ...k, likes: updated.likes } : k))
      } else if (type === 'poll') {
        setPolls((prev) => prev.map((p) => p.id === updated.id ? { ...p, likes: updated.likes } : p))
      }
    } catch (_) {}
  }
  const submitKudos = async (e) => {
    e.preventDefault()
    if (!kudosForm.destinataire.trim()) return
    try {
      await api.post('/api/team-space/posts', {
        type: 'kudos',
        from: employe?.prenom || user?.prenom || 'Moi',
        from_matricule: Number(user?.matricule || user?.sub || 0) || null,
        destinataire: kudosForm.destinataire,
        raison: kudosForm.raison || '',
        valeur: kudosForm.valeur || 'Excellence',
        likes: 0,
        audience: { type: audienceType, selected: [...audienceSelected] }
      })
      await loadTeamSpacePosts()
      setKudosForm({ destinataire: '', raison: '', valeur: 'Excellence' })
      setShowKudosForm(false)
      resetAudience()
    } catch (_) {}
  }
  const submitPoll = async (e) => {
    e.preventDefault()
    if (!pollForm.question.trim() || pollForm.options.filter(o => o.trim()).length < 2) return
    const options = pollForm.options.filter(o => o.trim()).map(o => ({ texte: o, votes: 0 }))
    try {
      await api.post('/api/team-space/posts', {
        type: 'poll',
        from: employe?.prenom || user?.prenom || 'Moi',
        from_matricule: Number(user?.matricule || user?.sub || 0) || null,
        question: pollForm.question,
        options,
        votedBy: [],
        likes: 0,
        audience: { type: audienceType, selected: [...audienceSelected] }
      })
      await loadTeamSpacePosts()
      setPollForm({ question: '', options: ['', ''] })
      setShowPollForm(false)
      resetAudience()
    } catch (_) {}
  }
  const votePoll = async (pollId, optionIdx) => {
    try {
      const voterId = String(user?.matricule || user?.sub || '')
      const res = await api.patch(`/api/team-space/posts/${pollId}/vote`, {
        voter_matricule: voterId,
        option_index: optionIdx
      })
      const updatedPoll = {
        id: res.data?.id,
        options: Array.isArray(res.data?.options) ? res.data.options : [],
        votedBy: Array.isArray(res.data?.votedBy) ? res.data.votedBy : []
      }
      setPolls((prev) => prev.map((p) => p.id === updatedPoll.id ? { ...p, options: updatedPoll.options, votedBy: updatedPoll.votedBy } : p))
    } catch (_) {}
  }

  const deletePost = async (id) => {
    const ok = await confirmDialog({ title: 'Supprimer la publication', message: 'Supprimer définitivement cette publication ?', variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    await api.delete(`/api/team-space/posts/${id}`)
    setPostMenuOpen(null)
    loadTeamSpacePosts()
  }

  const saveEditPost = async (id) => {
    await api.patch(`/api/team-space/posts/${id}`, editPostForm)
    setEditingPost(null)
    setEditPostForm({})
    loadTeamSpacePosts()
  }

  useEffect(() => {
    if (!postMenuOpen) return
    const handler = (e) => {
      if (!e.target.closest('[data-post-menu]')) setPostMenuOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [postMenuOpen])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(90deg, #021630 0%, #ce2b2b 100%)',
          color: 'white',
          padding: '28px 20px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 6, fontSize: '2rem', fontWeight: '700' }}>
          ELITE CAPITAL EMS  
        </h1>
        <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.95 }}>
          Enterprise Management System - votre portail de gestion 
        </p>
      </div>

      {/* Main Content */}
      <div className="container">
        {/* Welcome Section */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: '#ffffff',
            borderLeft: '6px solid #ce2b2b',
            padding: '22px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <AvatarCircle photoUrl={employe?.photo_url} letter={(employe?.prenom || user?.prenom || 'U')[0]} size={72} borderWidth={2} />
                <h2 style={{ fontSize: '1.45rem', margin: 0, color: '#021630' }}>
                  {getGreeting()}, {employe?.prenom || user?.prenom || 'Utilisateur'}
                </h2>
              </div>
              <p style={{ color: '#606060', marginBottom: 12, lineHeight: 1.45, fontSize: '0.92rem' }}>
                Bienvenue sur votre espace personnalisé de EMS. Accédez rapidement à vos tâches, 
                consultez vos congés, etc. et gérez vos informations professionnelles.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <Link to="/dashboard" className="button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems:'center', gap:6, padding: '7px 10px', fontSize: '0.82rem' }}>
                  <BarChart2 size={13}/> Aller au Dashboard
                </Link>
                <button
                  onClick={logout}
                  style={{
                    background: '#e5e7eb',
                    color: '#1f2937',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.82rem',
                    display:'inline-flex', alignItems:'center', gap:6
                  }}
                >
                  <LogOut size={13}/> Déconnexion
                </button>
              </div>
            </div>
            <div
              style={{
                background: '#021630',
                color: 'white',
                borderRadius: '12px',
                padding: '18px',
                textAlign: 'center',
                boxShadow: '0 8px 16px rgba(2,22,46,0.1)',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Identité</p>
              <p style={{ margin: '6px 0 0 0', fontSize: '1.15rem', fontWeight: '700' }}>
                {user?.matricule}
              </p>
              <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)' }} />
              <p style={{ margin: '0 0 6px 0', fontSize: '0.78rem', opacity: 0.8 }}>
                Rôle: <span style={{ fontWeight: '700', color: '#94a3b8' }}>{roleAffiche}</span>
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.8 }}>
                Ancienneté: <span style={{ fontWeight: '700', color: '#94a3b8' }}>{employe?.date_embauche ? calculateAnciennete(employe.date_embauche) : 'N/A'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Informations du compte */}
        <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ background: '#021630', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="user" size={14} stroke={2} />
            <h2 style={{ margin: 0, color: 'white', fontSize: '0.88rem', fontWeight: 700 }}>Informations du compte</h2>
          </div>
          <div style={{ padding: '14px 16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: '#e2e8f0',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {[
              {
                key: 'nom',
                label: 'Nom complet',
                value: [employe?.prenom || user?.prenom, employe?.nom || user?.nom].filter(Boolean).join(' ') || 'Non renseigné',
                icon: 'user',
                border: '#94a3b8',
                bg: '#ffffff',
                color: '#334155',
              },
              {
                key: 'solde_conges',
                label: 'Solde congés',
                value: soldeCp !== null ? soldeCp + ' jour(s)' : 'N/A',
                icon: 'calendar',
                border: '#94a3b8',
                bg: '#ffffff',
                color: '#334155',
              },
              {
                key: 'matricule',
                label: 'Matricule',
                value: user?.matricule || 'N/A',
                icon: 'badge',
                border: '#ce2b2b',
                bg: '#ffffff',
                color: '#021630',
              },
              {
                key: 'email',
                label: 'Email',
                value: employe?.email || user?.email || 'Non renseigné',
                icon: 'email',
                border: '#94a3b8',
                bg: '#ffffff',
                color: '#334155',
              },
              {
                key: 'anciennete',
                label: 'Ancienneté',
                value: employe?.date_embauche ? calculateAnciennete(employe.date_embauche) : 'N/A',
                icon: 'calendar',
                border: '#94a3b8',
                bg: '#ffffff',
                color: '#334155',
              },
              {
                key: 'entite',
                label: 'Entité',
                value: entiteAffiche,
                icon: 'org',
                border: '#94a3b8',
                bg: '#ffffff',
                color: '#334155',
              },
              {
                key: 'structure',
                label: 'Département / Direction',
                value: `${employe?.departement || employe?.nom_departement || 'Non renseigné'}${employe?.direction || employe?.nom_direction ? ` • ${employe?.direction || employe?.nom_direction}` : ''}`,
                icon: 'org',
                border: '#94a3b8',
                bg: '#ffffff',
                color: '#334155',
              },
              {
                key: 'fonction',
                label: 'Fonction',
                value: employe?.fonction || employe?.poste || employe?.titre || 'Non renseignée',
                icon: 'fonction',
                border: '#021630',
                bg: '#ffffff',
                color: '#021630',
              },
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  background: 'var(--card)',
                  padding: '9px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  borderLeft: `3px solid ${item.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name={item.icon} size={11} />
                  <span style={{ fontSize: '0.61rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</span>
                </div>
                <p style={{ margin: 0, color: '#021630', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>          </div>        </div>

        {/* Create Modal */}
        {createModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{ background: 'var(--card)', padding: '32px', borderRadius: '12px', maxWidth: '400px', width: '90%' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#021630' }}>
                {createModal === 'entite' ? 'Créer une Entité' : createModal === 'direction' ? 'Créer une Direction' : 'Créer un Département'}
              </h3>
              <form onSubmit={createAdminItem} style={{ display: 'grid', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Nom"
                  value={createForm.nom}
                  onChange={(e) => setCreateForm({ ...createForm, nom: e.target.value })}
                  required
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                />
                {(createModal === 'direction' || createModal === 'departement') && (
                  <input
                    type="number"
                    placeholder="ID Entité"
                    value={createForm.id_entite}
                    onChange={(e) => setCreateForm({ ...createForm, id_entite: e.target.value })}
                    required
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                  />
                )}
                {createModal === 'departement' && (
                  <input
                    type="number"
                    placeholder="ID Direction (optionnel)"
                    value={createForm.id_direction}
                    onChange={(e) => setCreateForm({ ...createForm, id_direction: e.target.value })}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                  />
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Créer</button>
                  <button
                    type="button"
                    onClick={() => { setCreateModal(null); setCreateForm({ nom: '', id_entite: '', id_direction: '' }); }}
                    className="btn"
                    style={{ flex: 1, background: '#e5e7eb', color: '#1f2937' }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* -- Two-column layout: main content + sidebar -- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
        <div>
        {/* Espace Équipe */}
        <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ background: '#ce2b2b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={14} color="white" />
            <h2 style={{ margin: 0, color: 'white', fontSize: '0.88rem', fontWeight: 700 }}>Espace Équipe</h2>
          </div>
          <div style={{ padding: '14px 16px' }}>

          {/* -- Compose bar -- */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: (showShoutoutForm || showKudosForm || showPollForm) ? 14 : 0 }}>
              <AvatarCircle photoUrl={employe?.photo_url} letter={(employe?.prenom || user?.prenom || 'U')[0]} size={38} />
              {!showShoutoutForm && !showKudosForm && !showPollForm && (
                <div
                  onClick={() => { setShowShoutoutForm(true); setShowKudosForm(false); setShowPollForm(false) }}
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 24, padding: '9px 18px', cursor: 'pointer', fontSize: '0.85rem', color: '#94a3b8', userSelect: 'none' }}>
                  Écrire un shoutout...
                </div>
              )}
              {(showShoutoutForm || showKudosForm || showPollForm) && (
                <div style={{ flex: 1 }} />
              )}
              {/* Audience Picker — inline next to avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button type="button" onClick={() => setAudienceOpen(!audienceOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 20, background: audienceType !== 'all' ? '#eff6ff' : '#f8fafc', color: audienceSelected.length === 0 ? '#021630' : audienceType !== 'all' ? '#2563eb' : '#64748b', fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Users size={12} />
                  {audienceType === 'all' ? 'Tous' : `${audienceSelected.length} sélect.`}
                  <ChevronDown size={11} style={{ transform: audienceOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {audienceOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--card)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid var(--border)', minWidth: 280, zIndex: 50, padding: '10px 0', maxHeight: 340, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', gap: 4, padding: '0 10px 8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                      {[{k:'all',l:'Tous'},{k:'entites',l:'Entités'},{k:'directions',l:'Directions'},{k:'departements',l:'Depts'}].map(t => (
                        <button type="button" key={t.k} onClick={() => { setAudienceType(t.k); if(t.k==='all') setAudienceSelected([]) }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: audienceType === t.k ? '1px solid #2563eb' : '1px solid #e2e8f0', background: audienceType === t.k ? '#eff6ff' : 'white', color: audienceType === t.k ? '#2563eb' : '#64748b', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {t.l}
                        </button>
                      ))}
                    </div>
                    {audienceType === 'all' && <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#475569' }}>Visible par tout le monde.</div>}
                    {audienceType === 'entites' && dbEntites.map(e => (
                      <label key={e.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', color: '#334155' }}>
                        <input type="checkbox" checked={audienceSelected.includes(e.label)} onChange={() => toggleAudienceItem(e.label)} style={{ accentColor: '#2563eb' }} />
                        {e.label}
                      </label>
                    ))}
                    {audienceType === 'directions' && dbDirections.map(d => (
                      <label key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', color: '#334155' }}>
                        <input type="checkbox" checked={audienceSelected.includes(d.label)} onChange={() => toggleAudienceItem(d.label)} style={{ accentColor: '#2563eb' }} />
                        {d.label}
                      </label>
                    ))}
                    {audienceType === 'departements' && dbDepartements.map(d => (
                      <label key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', color: '#334155' }}>
                        <input type="checkbox" checked={audienceSelected.includes(d.label)} onChange={() => toggleAudienceItem(d.label)} style={{ accentColor: '#2563eb' }} />
                        {d.label}
                      </label>
                    ))}
                    {audienceType !== 'all' && audienceSelected.length > 0 && (
                      <div style={{ padding: '6px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {audienceSelected.map(s => (
                          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600 }}>
                            {s} <X size={10} style={{ cursor: 'pointer' }} onClick={() => toggleAudienceItem(s)} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick action buttons */}
            {!showShoutoutForm && !showKudosForm && !showPollForm && (
              <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button onClick={() => { setShowShoutoutForm(true); setShowKudosForm(false); setShowPollForm(false) }}
                  style={{ flex: 1, padding: '7px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <MessageSquare size={13} /> Féliciter
                </button>
                <button onClick={() => { setShowKudosForm(true); setShowShoutoutForm(false); setShowPollForm(false) }}
                  style={{ flex: 1, padding: '7px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Star size={13} /> Kudos
                </button>
                <button onClick={() => { setShowPollForm(true); setShowShoutoutForm(false); setShowKudosForm(false) }}
                  style={{ flex: 1, padding: '7px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <BarChart size={13} /> Sondage
                </button>
              </div>
            )}

            {/* Shoutout Form */}
            {showShoutoutForm && (
              <form onSubmit={submitShoutout} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem' }} placeholder="Qui félicitez-vous ? (prénom)" value={shoutoutForm.destinataire} onChange={e => setShoutoutForm({ ...shoutoutForm, destinataire: e.target.value })} required autoFocus />
                <textarea style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', resize: 'vertical', minHeight: 48 }} placeholder="Votre message de félicitations..." value={shoutoutForm.message} onChange={e => setShoutoutForm({ ...shoutoutForm, message: e.target.value })} required />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setShowShoutoutForm(false); resetAudience() }} style={{ padding: '5px 10px', background: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.78rem' }}>Annuler</button>
                  <button type="submit" style={{ padding: '5px 14px', background: '#021630', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>Publier</button>
                </div>
              </form>
            )}

            {/* Kudos Form */}
            {showKudosForm && (
              <form onSubmit={submitKudos} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem' }} placeholder="Pour qui ? (prénom du collègue)" value={kudosForm.destinataire} onChange={e => setKudosForm({ ...kudosForm, destinataire: e.target.value })} required autoFocus />
                <select style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', background: 'var(--card)' }} value={kudosForm.valeur} onChange={e => setKudosForm({ ...kudosForm, valeur: e.target.value })}>
                  {['Excellence', 'Innovation', 'Collaboration', 'Créativité', 'Leadership', 'Entraide', 'Performance'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <textarea style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', resize: 'vertical', minHeight: 36 }} placeholder="Pourquoi mérite-t-il ces kudos ? (optionnel)" value={kudosForm.raison} onChange={e => setKudosForm({ ...kudosForm, raison: e.target.value })} />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setShowKudosForm(false); resetAudience() }} style={{ padding: '5px 10px', background: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.78rem' }}>Annuler</button>
                  <button type="submit" style={{ padding: '5px 14px', background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>Envoyer les Kudos</button>
                </div>
              </form>
            )}

            {/* Poll Form */}
            {showPollForm && (
              <form onSubmit={submitPoll} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem' }} placeholder="Question du sondage..." value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} required autoFocus />
                {pollForm.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4 }}>
                    <input style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem' }} placeholder={`Option ${i + 1}...`} value={opt} onChange={e => { const opts = [...pollForm.options]; opts[i] = e.target.value; setPollForm({ ...pollForm, options: opts }) }} />
                    {i >= 2 && <button type="button" onClick={() => setPollForm({ ...pollForm, options: pollForm.options.filter((_, j) => j !== i) })} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '6px', cursor: 'pointer', color: '#ce2b2b' }}><X size={12} /></button>}
                  </div>
                ))}
                {pollForm.options.length < 5 && (
                  <button type="button" onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })} style={{ background: 'var(--bg)', border: '1px dashed #cbd5e1', borderRadius: 6, padding: '5px', cursor: 'pointer', color: '#64748b', fontSize: '0.78rem' }}>+ Ajouter une option</button>
                )}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setShowPollForm(false); resetAudience() }} style={{ padding: '5px 10px', background: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.78rem' }}>Annuler</button>
                  <button type="submit" style={{ padding: '5px 14px', background: '#021630', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>Publier</button>
                </div>
              </form>
            )}
          </div>

          {/* -- Filter Bar -- */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {[{ key: 'all', label: 'Tout' }, { key: 'shoutout', label: 'Félicitations' }, { key: 'kudos', label: 'Kudos' }, { key: 'poll', label: 'Sondages' }].map(f => (
              <button key={f.key} onClick={() => setFilterType(f.key)}
                style={{ padding: '5px 12px', borderRadius: 20, border: filterType === f.key ? '2px solid #021630' : '1px solid #e2e8f0', background: filterType === f.key ? '#021630' : 'white', color: filterType === f.key ? 'white' : '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
            <div style={{ flex: 1, minWidth: 140, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                placeholder="Rechercher un nom, message..."
                style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 20, border: '1px solid var(--border)', fontSize: '0.78rem', outline: 'none', background: 'var(--bg)' }}
              />
            </div>
          </div>

          {/* -- Social Feed (scrollable) -- */}
          <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
          {filteredFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <MessageSquare size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: '0.88rem' }}>Le fil est vide. Soyez le premier à publier !</p>
              </div>
          ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredFeed.map(item => (
                  <div key={`${item._type}-${item.id}`} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}
                    onDoubleClick={() => handleDoubleClick(item.id)}>
                    {likeHearts[item.id] && (
                      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, pointerEvents: 'none', animation: 'popHeart 0.9s', fontSize: '2.5rem', color: '#ce2b2b', opacity: 0.85 }}>
                        ??
                      </div>
                    )}
<style>{`
@keyframes popHeart {
  0% { transform: scale(0.7) translate(-50%,-50%); opacity: 0.2; }
  40% { transform: scale(1.2) translate(-50%,-50%); opacity: 1; }
  80% { transform: scale(1) translate(-50%,-50%); opacity: 0.85; }
  100% { transform: scale(0.7) translate(-50%,-50%); opacity: 0; }
}
`}</style>

                    {/* Post header */}
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarCircle photoUrl={resolvePhotoUrl(item.from)} letter={(item.from || 'U')[0]} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#021630', fontSize: '0.88rem', lineHeight: 1.2 }}>{item.from}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {item.date}
                          {item.audience && item.audience.type !== 'all' && item.audience.selected?.length > 0 && (
                            <span style={{ marginLeft: 6, color: '#2563eb' }}>• {item.audience.selected.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.67rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: item._type === 'kudos' ? '#fef2f2' : item._type === 'poll' ? '#f1f5f9' : '#f0f4ff', color: item._type === 'kudos' ? '#ce2b2b' : item._type === 'poll' ? '#475569' : '#021630', border: `1px solid ${item._type === 'kudos' ? '#fecaca' : '#e2e8f0'}` }}>
                        {item._type === 'kudos' ? 'Kudos' : item._type === 'poll' ? 'Sondage' : item._type === 'shoutout' ? 'Félicitations' : 'Post'}
                      </span>
                      <div style={{ position: 'relative' }} data-post-menu>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPostMenuOpen(postMenuOpen === item.id ? null : item.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <MoreVertical size={15} />
                        </button>
                        {postMenuOpen === item.id && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 150, overflow: 'hidden' }}>
                            {(!item.created_at || (Date.now() - new Date(item.created_at).getTime()) <= 3600000) && (
                              <>
                                <button
                                  onClick={() => { setEditingPost(item.id); setEditPostForm({ message: item.message, destinataire: item.destinataire, raison: item.raison, valeur: item.valeur, question: item.question }); setPostMenuOpen(null) }}
                                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.82rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 9, fontWeight: 500 }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  <Pencil size={13} color="#475569" /> Modifier
                                </button>
                                <div style={{ height: 1, background: 'var(--bg)' }} />
                              </>
                            )}
                            <button
                              onClick={() => deletePost(item.id)}
                              style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.82rem', color: '#ce2b2b', display: 'flex', alignItems: 'center', gap: 9, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                              <Trash2 size={13} color="#ce2b2b" /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shoutout body */}
                    {item._type === 'shoutout' && (
                      <div style={{ padding: '0 16px 14px' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.88rem', color: '#334155' }}>
                          Pour <span style={{ fontWeight: 700, color: '#ce2b2b' }}>@{item.destinataire}</span>
                        </p>
                        <p style={{ margin: 0, color: '#475569', fontSize: '0.85rem', lineHeight: 1.55 }}>{item.message}</p>
                      </div>
                    )}

                    {/* Kudos body — visual banner */}
                    {item._type === 'kudos' && (
                      <>
                        <div style={{ padding: '0 16px 10px' }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                            Kudos à <span style={{ fontWeight: 700, color: '#ce2b2b' }}>@{item.destinataire}</span>
                          </p>
                        </div>
                        <div style={{ margin: '0 16px 16px', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #ce2b2b 0%, #a01f1f 100%)', padding: '28px 20px', textAlign: 'center' }}>
                          {[{t:6,l:8,s:16,o:.55},{t:18,l:72,s:11,o:.45},{t:58,l:88,s:20,o:.5},{t:72,l:6,s:13,o:.4},{t:38,l:48,s:9,o:.45},{t:14,l:38,s:18,o:.5},{t:68,l:62,s:11,o:.4},{t:28,l:90,s:15,o:.35},{t:82,l:28,s:17,o:.45},{t:8,l:92,s:10,o:.5},{t:45,l:15,s:14,o:.4},{t:55,l:55,s:8,o:.5}].map((d,i)=>(
                            <div key={i} style={{ position:'absolute', top:`${d.t}%`, left:`${d.l}%`, width:d.s, height:d.s, borderRadius:'50%', background:`rgba(255,255,255,${d.o})`, pointerEvents:'none' }} />
                          ))}
                          <div style={{ position: 'relative', zIndex: 1 }}>
                            <AvatarCircle
                              photoUrl={resolvePhotoUrl(item.destinataire)}
                              letter={(item.destinataire || '?')[0]}
                              size={48}
                              borderWidth={2}
                              borderColor='rgba(255,255,255,0.4)'
                              textColor='rgba(255,255,255,0.9)'
                              fallbackBackground='transparent'
                              style={{ margin: '0 auto 12px' }}
                            />
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: 4, textShadow: '0 3px 10px rgba(0,0,0,0.25)' }}>KUDOS!</div>
                            <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginTop: 5 }}>{item.valeur}</div>
                            {item.raison && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.72)', marginTop: 6, fontStyle: 'italic' }}>"{item.raison}"</div>}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Poll body */}
                    {item._type === 'poll' && (() => {
                      const totalVotes = item.options.reduce((s, o) => s + o.votes, 0)
                      const hasVoted = item.votedBy?.includes(String(user?.matricule))
                      return (
                        <div style={{ padding: '0 16px 14px' }}>
                          <p style={{ margin: '0 0 10px', fontWeight: 700, color: '#021630', fontSize: '0.9rem' }}>{item.question}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {item.options.map((opt, i) => {
                              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
                              return (
                                <div key={i} style={{ cursor: hasVoted ? 'default' : 'pointer' }} onClick={() => !hasVoted && votePoll(item.id, i)}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                                    <span style={{ color: '#334155' }}>{opt.texte}</span>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>{pct}%</span>
                                  </div>
                                  <div style={{ height: 7, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: '#021630', borderRadius: 4, transition: 'width 0.3s' }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 8 }}>
                            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                            {!hasVoted && <span style={{ color: '#ce2b2b', marginLeft: 6 }}>• Cliquez pour voter</span>}
                            {hasVoted && <span style={{ color: '#021630', fontWeight: 600, marginLeft: 6 }}>• Voté</span>}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Inline edit form */}
                    {editingPost === item.id && item._type === 'shoutout' && (
                      <div style={{ padding: '12px 16px 14px', borderTop: '1px solid #f1f5f9' }}>
                        <input
                          style={{ width: '100%', marginBottom: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', boxSizing: 'border-box' }}
                          placeholder="Destinataire"
                          value={editPostForm.destinataire || ''}
                          onChange={e => setEditPostForm({ ...editPostForm, destinataire: e.target.value })} />
                        <textarea
                          style={{ width: '100%', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', resize: 'vertical', minHeight: 48, boxSizing: 'border-box' }}
                          placeholder="Message..."
                          value={editPostForm.message || ''}
                          onChange={e => setEditPostForm({ ...editPostForm, message: e.target.value })} />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => { setEditingPost(null); setEditPostForm({}) }}
                            style={{ padding: '5px 10px', background: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={12} /> Annuler
                          </button>
                          <button type="button" onClick={() => saveEditPost(item.id)}
                            style={{ padding: '5px 14px', background: '#021630', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Enregistrer
                          </button>
                        </div>
                      </div>
                    )}
                    {editingPost === item.id && item._type === 'kudos' && (
                      <div style={{ padding: '12px 16px 14px', borderTop: '1px solid #f1f5f9' }}>
                        <input
                          style={{ width: '100%', marginBottom: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', boxSizing: 'border-box' }}
                          placeholder="Destinataire"
                          value={editPostForm.destinataire || ''}
                          onChange={e => setEditPostForm({ ...editPostForm, destinataire: e.target.value })} />
                        <select
                          style={{ width: '100%', marginBottom: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', background: 'var(--card)', boxSizing: 'border-box' }}
                          value={editPostForm.valeur || 'Excellence'}
                          onChange={e => setEditPostForm({ ...editPostForm, valeur: e.target.value })}>
                          {['Excellence', 'Innovation', 'Collaboration', 'Créativité', 'Leadership', 'Entraide', 'Performance'].map(v => <option key={v}>{v}</option>)}
                        </select>
                        <textarea
                          style={{ width: '100%', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', resize: 'vertical', minHeight: 36, boxSizing: 'border-box' }}
                          placeholder="Raison (optionnel)"
                          value={editPostForm.raison || ''}
                          onChange={e => setEditPostForm({ ...editPostForm, raison: e.target.value })} />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => { setEditingPost(null); setEditPostForm({}) }}
                            style={{ padding: '5px 10px', background: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={12} /> Annuler
                          </button>
                          <button type="button" onClick={() => saveEditPost(item.id)}
                            style={{ padding: '5px 14px', background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Enregistrer
                          </button>
                        </div>
                      </div>
                    )}
                    {editingPost === item.id && item._type === 'poll' && (
                      <div style={{ padding: '12px 16px 14px', borderTop: '1px solid #f1f5f9' }}>
                        <input
                          style={{ width: '100%', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', boxSizing: 'border-box' }}
                          placeholder="Question du sondage..."
                          value={editPostForm.question || ''}
                          onChange={e => setEditPostForm({ ...editPostForm, question: e.target.value })} />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => { setEditingPost(null); setEditPostForm({}) }}
                            style={{ padding: '5px 10px', background: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={12} /> Annuler
                          </button>
                          <button type="button" onClick={() => saveEditPost(item.id)}
                            style={{ padding: '5px 14px', background: '#021630', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Enregistrer
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Post footer — React + Comment */}
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '6px 16px', display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => likePost(item._type, item.id)}
                        style={{ flex: 1, background: 'none', border: 'none', borderRadius: 8, padding: '7px', cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <ThumbsUp size={14} /> {item.likes > 0 ? `${item.likes} ` : ''}React
                      </button>
                      <button
                        style={{ flex: 1, background: 'none', border: 'none', borderRadius: 8, padding: '7px', cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <MessageSquare size={14} /> Comment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          )}
          </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="card" style={{ background: '#ffffff', border: '1px solid var(--border)', borderLeft: '4px solid #021630', marginBottom: 18, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#021630', fontSize: '1rem', fontWeight: 700 }}>Informations utiles</h3>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: '0.84rem' }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Politique de mot de passe:</strong> Min. 14 caractères (majuscule, minuscule, chiffre, spécial)
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Authentification 2FA:</strong> Activée par défaut pour plus de sécurité
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Audit:</strong> Toutes vos actions sont enregistrées dans le respect de la RGPD
            </li>
            <li>
              <strong>Support:</strong> Contactez l'équipe IT pour toute assistance
            </li>
          </ul>
        </div>
        </div>{/* end left column */}

        {/* -- Right Sidebar -- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>

          {/* Profile Card */}
          <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AvatarCircle photoUrl={employe?.photo_url} letter={(employe?.prenom || user?.prenom || 'U')[0]} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#021630', fontSize: '0.82rem', lineHeight: 1.2 }}>{employe?.prenom || user?.prenom} {employe?.nom || user?.nom}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>{employe?.fonction || employe?.poste || roleAffiche}</div>
              </div>
              <Link to="/rh/profile" style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Voir profil ?
              </Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Solde congés</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#021630' }}>{soldeCp !== null ? `${soldeCp} j` : 'N/A'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLeaveSuccess('')
                  setShowLeaveModal(true)
                }}
                style={{ padding: '6px 12px', borderRadius: 6, background: '#021630', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}
              >
                Demander un congé
              </button>
            </div>
            {leaveSuccess && <div style={{ marginTop: 8, color: '#16a34a', fontSize: '0.74rem', fontWeight: 600 }}>{leaveSuccess}</div>}
          </div>

          {/* Disponibilité aujourd'hui */}
          <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#021630' }}>Disponibilité aujourd'hui</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              {(() => {
                const categories = [
                  { key: 'CONGE', label: 'En congé' },
                  { key: 'MISSION', label: 'En mission' },
                  { key: 'PERMISSION', label: 'En permission' },
                  { key: 'SORTIE', label: 'En sortie' },
                ]
                const totalEmployees = allEmployees.length || 1
                return categories.map(cat => {
                  const people = employeesAbsent.filter(op => op.type === cat.key)
                  const pct = Math.round((people.length / totalEmployees) * 100)
                  return (
                    <div key={cat.key} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>{cat.label}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#021630', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>{people.length}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#021630', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                      {people.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
                            {people.slice(0, 3).map((p, i) => (
                              <span key={i} style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.prenom} {p.nom}</span>
                            ))}
                            {people.length > 3 && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>+{people.length - 3} autres</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                            {people.slice(0, 4).map((p, i) => (
                              <AvatarCircle key={i} photoUrl={p.photo_url} letter={(p.prenom || '?')[0]} size={26} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 5 - i }} />
                            ))}
                            {people.length > 4 && (
                              <AvatarCircle letter={`+${people.length - 4}`} size={26} style={{ marginLeft: -6, zIndex: 0 }} />
                            )}
                          </div>
                        </div>
                      )}
                      {people.length === 0 && (
                        <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>Aucun</div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Anniversaires à venir */}
          <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#021630' }}>Anniversaires à venir</span>
            </div>
            <div style={{ padding: '12px 14px' }}>
              {upcomingBirthdays.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '14px 8px', color: '#94a3b8' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem' }}>Aucun anniversaire à venir</p>
                </div>
              ) : (
                <div ref={birthdayRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcomingBirthdays.slice(0, 5).map(b => {
                    const wished = hasWished(b.matricule)
                    const isToday = b.daysUntil === 0
                    const bdDate = b.date_naissance ? new Date(b.date_naissance) : null
                    const dateStr = bdDate ? bdDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''
                    return (
                      <div key={b.matricule} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                        <AvatarCircle photoUrl={b.photo_url} letter={(b.prenom || '?')[0]} size={30} borderWidth={isToday ? 2 : 1.5} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#021630', fontSize: '0.75rem', lineHeight: 1.2 }}>{b.prenom} {b.nom}</div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{dateStr} • {isToday ? 'Aujourd\'hui' : `Dans ${b.daysUntil}j`}</div>
                        </div>
                        <button
                          onClick={() => sendWishes(b.matricule)}
                          disabled={wished || !isToday}
                          title={!isToday ? `Dans ${b.daysUntil} jour(s)` : undefined}
                          style={{ padding: '4px 10px', borderRadius: 4, border: (wished || !isToday) ? '1px solid #d1d5db' : '1px solid #021630', background: (wished || !isToday) ? '#f8fafc' : '#021630', color: (wished || !isToday) ? '#6b7280' : 'white', fontSize: '0.65rem', fontWeight: 600, cursor: (wished || !isToday) ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {wished ? 'Envoyé' : 'Voeux'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>{/* end 2-col grid */}

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: '18px', paddingBottom: '16px' }}>
          <p style={{ margin: 0 }}>© 2026 ELITE CAPITAL Group. Tous droits réservés.</p>
          <p style={{ margin: '6px 0 0 0', opacity: 0.8 }}>Extranet securisé </p>
        </div>

        {showLeaveModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(2,22,48,0.5)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setShowLeaveModal(false)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 640,
                background: 'var(--card)',
                borderRadius: 12,
                boxShadow: '0 16px 40px rgba(2,22,48,0.28)',
                padding: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 4, height: 20, background: '#ce2b2b', borderRadius: 2, marginRight: 10, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.97rem', color: 'var(--text)', flex: 1 }}>Nouvelle demande de congé</span>
                <button type="button" onClick={() => { setShowLeaveModal(false); setLeaveModalMsg(null) }} style={{ border: 'none', background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.82rem' }}>?</button>
              </div>
              {leaveModalMsg && <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 7, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontSize: '0.85rem' }}>{leaveModalMsg}</div>}
              <form onSubmit={handleLeaveModalSubmit} style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }}>Date de début</label>
                  <input type="date" value={leaveModalForm.date_debut} min={new Date().toISOString().split('T')[0]} onChange={e => setLeaveModalForm(f => ({ ...f, date_debut: e.target.value }))} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }}>Date de fin</label>
                  <input type="date" value={leaveModalForm.date_fin} min={leaveModalForm.date_debut || new Date().toISOString().split('T')[0]} onChange={e => setLeaveModalForm(f => ({ ...f, date_fin: e.target.value }))} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Durée (jours)</label>
                  <div style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: 'var(--bg)', fontSize: '0.9rem', fontWeight: 700, color: '#0f766e', minHeight: 38, display: 'flex', alignItems: 'center' }}>
                    {leaveModalForm.date_debut && leaveModalForm.date_fin ? `${Math.ceil((new Date(leaveModalForm.date_fin) - new Date(leaveModalForm.date_debut)) / 86400000) + 1} jour(s)` : '--'}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }}>Motif <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.76rem' }}>(optionnel)</span></label>
                  <textarea value={leaveModalForm.motif} onChange={e => setLeaveModalForm(f => ({ ...f, motif: e.target.value }))} placeholder="Précisez le motif de votre demande..." rows={2} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
                  <button type="button" onClick={() => { setShowLeaveModal(false); setLeaveModalMsg(null); setLeaveModalForm({ date_debut: '', date_fin: '', motif: '' }) }} style={{ padding: '9px 18px', background: 'var(--bg)', color: '#475569', border: '1px solid var(--border)', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
                  <button type="submit" style={{ padding: '9px 22px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Soumettre la demande</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
