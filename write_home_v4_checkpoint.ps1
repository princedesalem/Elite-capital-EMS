$content = 'import React, { useState, useEffect, useMemo, useRef } from ''react''
import { Link } from ''react-router-dom''
import { useAuth } from ''../contexts/AuthContext''
import api from ''../services/api''
import { BarChart2, LogOut, Star, MessageSquare, ThumbsUp, BarChart, Send, Plus, X, ChevronDown, Search, Gift, Users, Briefcase, Clock } from ''lucide-react''

// ── Team Engagement local storage helpers ──
const SHOUTOUTS_KEY = ''ems_shoutouts_v1''
const KUDOS_KEY = ''ems_kudos_v1''
const POLLS_KEY = ''ems_polls_v1''
const WISHES_KEY = ''ems_wishes_v1''
const loadLS = (key) => { try { return JSON.parse(localStorage.getItem(key) || ''[]'') } catch { return [] } }
const saveLS = (key, data) => localStorage.setItem(key, JSON.stringify(data))

function Icon({ name, size = 20, stroke = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: ''0 0 24 24'',
    fill: ''none'',
    stroke: ''currentColor'',
    strokeWidth: stroke,
    strokeLinecap: ''round'',
    strokeLinejoin: ''round'',
    ''aria-hidden'': true,
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

function Avatar({ photo, letter, size = 36, borderWidth = 1.5, style = {} }) {
  const s = { width: size, height: size, borderRadius: ''50%'', display: ''flex'', alignItems: ''center'', justifyContent: ''center'', flexShrink: 0, overflow: ''hidden'', border: `${borderWidth}px solid #cbd5e1`, background: ''transparent'', ...style }
  if (photo) return <div style={s}><img src={photo} alt="" style={{ width: ''100%'', height: ''100%'', objectFit: ''cover'' }} /></div>
  return <div style={{ ...s, color: ''#021630'', fontWeight: 700, fontSize: size * 0.38 }}>{(letter || ''?'').toUpperCase()}</div>
}

export default function Home() {
  const { user, logout } = useAuth()
  const [employe, setEmploye] = useState(null)
  const [stats, setStats] = useState({ employees: 0, leaves: 0, pending: 0 })
  const [createModal, setCreateModal] = useState(null)
  const [createForm, setCreateForm] = useState({ nom: '''', id_entite: '''', id_direction: '''' })

  // Team Engagement state
  const [shoutouts, setShoutouts] = useState(() => loadLS(SHOUTOUTS_KEY))
  const [kudos, setKudos] = useState(() => loadLS(KUDOS_KEY))
  const [polls, setPolls] = useState(() => loadLS(POLLS_KEY))
  const [showShoutoutForm, setShowShoutoutForm] = useState(false)
  const [showKudosForm, setShowKudosForm] = useState(false)
  const [showPollForm, setShowPollForm] = useState(false)
  const [shoutoutForm, setShoutoutForm] = useState({ destinataire: '''', message: '''' })
  const [kudosForm, setKudosForm] = useState({ destinataire: '''', raison: '''', valeur: ''Excellence'' })
  const [pollForm, setPollForm] = useState({ question: '''', options: ['''', ''''] })

  const [allEmployees, setAllEmployees] = useState([])
  const [operations, setOperations] = useState([])
  const [sorties, setSorties] = useState([])
  const [wishes, setWishes] = useState(() => loadLS(WISHES_KEY))
  const [audienceType, setAudienceType] = useState(''all'')
  const [audienceSelected, setAudienceSelected] = useState([])
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [dbEntites, setDbEntites] = useState([])
  const [dbDirections, setDbDirections] = useState([])
  const [dbDepartements, setDbDepartements] = useState([])
  const [filterType, setFilterType] = useState(''all'')
  const [filterSearch, setFilterSearch] = useState('''')
  const birthdayRef = useRef(null)

  useEffect(() => {
    const matricule = Number(user?.matricule || user?.sub || 0)
    if (matricule) {
      api.get(`/employees/${matricule}`).then(r => {
        setEmploye(r.data)
      }).catch(() => {})
    }
    // Fetch simple stats
    api.get(''/employees'').then(r => {
      setStats(prev => ({ ...prev, employees: r.data.length }))
      setAllEmployees(r.data)
    }).catch(() => {})
    api.get(''/api/operations'').then(r => setOperations(r.data)).catch(() => {})
    api.get(''/api/sorties'').then(r => setSorties(r.data)).catch(() => {})
    // Fetch org structure from DB
    api.get(''/employees/autocomplete/entites'').then(r => setDbEntites(r.data)).catch(() => {})
    api.get(''/employees/autocomplete/directions'').then(r => setDbDirections(r.data)).catch(() => {})
    api.get(''/employees/autocomplete/departements'').then(r => setDbDepartements(r.data)).catch(() => {})
  }, [user])

  const calculateAnciennete = (dateEmbauche) => {
    if (!dateEmbauche) return ''N/A''
    const date = new Date(dateEmbauche)
    const today = new Date()
    const diffTime = today - date
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365.25)
    const months = Math.floor((diffDays % 365.25) / 30.44)
    
    if (years === 0) return `${months} mois`
    if (months === 0) return `${years} an${years > 1 ? ''s'' : ''''}`
    return `${years} an${years > 1 ? ''s'' : ''''} ${months} mois`
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return ''Bonjour''
    if (hour < 18) return ''Bonsoir''
    return ''Bonne nuit''
  }

  const createAdminItem = async (e) => {
    e.preventDefault()
    try {
      if (createModal === ''entite'') {
        await api.post(''/employees/create-entite'', null, { params: { nom: createForm.nom } })
        alert(''Entité créée avec succès!'')
      } else if (createModal === ''direction'') {
        await api.post(''/employees/create-direction'', null, { params: { nom: createForm.nom, id_entite: createForm.id_entite } })
        alert(''Direction créée avec succès!'')
      } else if (createModal === ''departement'') {
        await api.post(''/employees/create-departement'', null, { params: { nom: createForm.nom, id_entite: createForm.id_entite, id_direction: createForm.id_direction } })
        alert(''Département créé avec succès!'')
      }
      setCreateModal(null)
      setCreateForm({ nom: '''', id_entite: '''', id_direction: '''' })
    } catch (err) {
      alert(''Erreur: '' + (err.response?.data?.detail || err.message))
    }
  }

  const roleAffiche = String(
    employe?.role?.name || employe?.role || user?.role || employe?.fonction || ''EMPLOYE''
  ).toUpperCase()

  const entiteAffiche = employe?.entite || employe?.nom_entite || employe?.id_entite || ''Non renseignée''
  const soldeCp = employe?.solde_conge ?? employe?.solde_conges ?? employe?.solde_conges_annuels ?? employe?.nb_jours_conge_restants ?? null

  // ── Upcoming birthdays ──
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

  // ── Employees currently on leave / permission / mission / sortie ──
  const employeesAbsent = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const fromOps = operations
      .filter(op => op.date_depart && op.date_retour && op.date_depart <= today && op.date_retour >= today)
      .map(op => {
        const emp = allEmployees.find(e => e.matricule === op.matricule)
        return { ...op, nom: emp?.nom, prenom: emp?.prenom }
      })
    const fromSorties = sorties
      .filter(s => s.date_sortie === today && s.statut === ''validé'')
      .map(s => {
        const emp = allEmployees.find(e => e.matricule === s.matricule)
        return { ...s, type: ''SORTIE'', nom: emp?.nom, prenom: emp?.prenom }
      })
    return [...fromOps, ...fromSorties]
  }, [operations, sorties, allEmployees])

  // ── Filtered feed ──
  const filteredFeed = useMemo(() => {
    let feed = [
      ...shoutouts.map(s => ({ ...s, _type: ''shoutout'' })),
      ...kudos.map(k => ({ ...k, _type: ''kudos'' })),
      ...polls.map(p => ({ ...p, _type: ''poll'' })),
    ].sort((a, b) => b.id - a.id)
    if (filterType !== ''all'') feed = feed.filter(f => f._type === filterType)
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase()
      feed = feed.filter(f =>
        (f.from || '''').toLowerCase().includes(q) ||
        (f.destinataire || '''').toLowerCase().includes(q) ||
        (f.message || '''').toLowerCase().includes(q) ||
        (f.question || '''').toLowerCase().includes(q)
      )
    }
    return feed.slice(0, 20)
  }, [shoutouts, kudos, polls, filterType, filterSearch])

  // ── Birthday wishes ──
  const sendWishes = (matricule) => {
    const key = `${matricule}_${new Date().toISOString().slice(0, 10)}`
    if (wishes.includes(key)) return
    const updated = [...wishes, key]
    setWishes(updated); saveLS(WISHES_KEY, updated)
  }
  const hasWished = (matricule) => wishes.includes(`${matricule}_${new Date().toISOString().slice(0, 10)}`)

  // ── Audience helpers ──
  const audienceLabel = audienceType === ''all'' ? ''Tout le monde'' : `${audienceSelected.length} sélection(s)`
  const toggleAudienceItem = (label) => {
    setAudienceSelected(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label])
  }
  const resetAudience = () => { setAudienceType(''all''); setAudienceSelected([]); setAudienceOpen(false) }

  // Engagement handlers
  const submitShoutout = (e) => {
    e.preventDefault()
    if (!shoutoutForm.destinataire.trim() || !shoutoutForm.message.trim()) return
    const updated = [{ id: Date.now(), ...shoutoutForm, from: employe?.prenom || user?.prenom || ''Moi'', date: new Date().toLocaleDateString(''fr-FR''), likes: 0, audience: { type: audienceType, selected: [...audienceSelected] } }, ...shoutouts].slice(0, 20)
    setShoutouts(updated); saveLS(SHOUTOUTS_KEY, updated)
    setShoutoutForm({ destinataire: '''', message: '''' }); setShowShoutoutForm(false); resetAudience()
  }
  const likePost = (type, id) => {
    if (type === ''shoutout'') {
      const updated = shoutouts.map(s => s.id === id ? { ...s, likes: (s.likes || 0) + 1 } : s)
      setShoutouts(updated); saveLS(SHOUTOUTS_KEY, updated)
    } else if (type === ''kudos'') {
      const updated = kudos.map(k => k.id === id ? { ...k, likes: (k.likes || 0) + 1 } : k)
      setKudos(updated); saveLS(KUDOS_KEY, updated)
    } else if (type === ''poll'') {
      const updated = polls.map(p => p.id === id ? { ...p, likes: (p.likes || 0) + 1 } : p)
      setPolls(updated); saveLS(POLLS_KEY, updated)
    }
  }
  const submitKudos = (e) => {
    e.preventDefault()
    if (!kudosForm.destinataire.trim()) return
    const updated = [{ id: Date.now(), ...kudosForm, from: employe?.prenom || user?.prenom || ''Moi'', date: new Date().toLocaleDateString(''fr-FR''), audience: { type: audienceType, selected: [...audienceSelected] } }, ...kudos].slice(0, 20)
    setKudos(updated); saveLS(KUDOS_KEY, updated)
    setKudosForm({ destinataire: '''', raison: '''', valeur: ''Excellence'' }); setShowKudosForm(false); resetAudience()
  }
  const submitPoll = (e) => {
    e.preventDefault()
    if (!pollForm.question.trim() || pollForm.options.filter(o => o.trim()).length < 2) return
    const options = pollForm.options.filter(o => o.trim()).map(o => ({ texte: o, votes: 0 }))
    const updated = [{ id: Date.now(), question: pollForm.question, options, from: employe?.prenom || user?.prenom || ''Moi'', date: new Date().toLocaleDateString(''fr-FR''), votedBy: [], audience: { type: audienceType, selected: [...audienceSelected] } }, ...polls].slice(0, 10)
    setPolls(updated); saveLS(POLLS_KEY, updated)
    setPollForm({ question: '''', options: ['''', ''''] }); setShowPollForm(false); resetAudience()
  }
  const votePoll = (pollId, optionIdx) => {
    const voterId = String(user?.matricule)
    const updated = polls.map(p => {
      if (p.id !== pollId) return p
      if (p.votedBy?.includes(voterId)) return p
      const opts = p.options.map((o, i) => i === optionIdx ? { ...o, votes: o.votes + 1 } : o)
      return { ...p, options: opts, votedBy: [...(p.votedBy || []), voterId] }
    })
    setPolls(updated); saveLS(POLLS_KEY, updated)
  }

  return (
    <div style={{ background: ''#f4f5f7'', minHeight: ''100vh'' }}>
      {/* Hero Banner */}
      <div
        style={{
          background: ''linear-gradient(90deg, #021630 0%, #ce2b2b 100%)'',
          color: ''white'',
          padding: ''28px 20px'',
          textAlign: ''center'',
          boxShadow: ''0 4px 12px rgba(0,0,0,0.1)'',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 6, fontSize: ''2rem'', fontWeight: ''700'' }}>
          ELITE CAPITAL EMS  
        </h1>
        <p style={{ margin: 0, fontSize: ''0.95rem'', opacity: 0.95 }}>
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
            background: ''#ffffff'',
            borderLeft: ''6px solid #ce2b2b'',
            padding: ''22px'',
          }}
        >
          <div style={{ display: ''grid'', gridTemplateColumns: ''1.2fr 0.8fr'', gap: 18, alignItems: ''center'' }}>
            <div>
              <div style={{ display: ''flex'', alignItems: ''center'', gap: 14, marginBottom: 12 }}>
                <Avatar photo={employe?.photo} letter={(employe?.prenom || user?.prenom || ''U'')[0]} size={72} borderWidth={2} />
                <h2 style={{ fontSize: ''1.45rem'', margin: 0, color: ''#021630'' }}>
                  {getGreeting()}, {employe?.prenom || user?.prenom || ''Utilisateur''}
                </h2>
              </div>
              <p style={{ color: ''#606060'', marginBottom: 12, lineHeight: 1.45, fontSize: ''0.92rem'' }}>
                Bienvenue sur votre espace personnalisé de EMS. Accédez rapidement à vos taches, 
                consultez vos congés etc  et gérez vos informations professionnelle.
              </p>
              <div style={{ display: ''flex'', gap: 12 }}>
                <Link to="/dashboard" className="button" style={{ textDecoration: ''none'', display: ''inline-flex'', alignItems:''center'', gap:6, padding: ''7px 10px'', fontSize: ''0.82rem'' }}>
                  <BarChart2 size={13}/> Aller au Dashboard
                </Link>
                <button
                  onClick={logout}
                  style={{
                    background: ''#e5e7eb'',
                    color: ''#1f2937'',
                    padding: ''7px 10px'',
                    borderRadius: ''6px'',
                    border: ''none'',
                    cursor: ''pointer'',
                    fontWeight: ''600'',
                    fontSize: ''0.82rem'',
                    display:''inline-flex'', alignItems:''center'', gap:6
                  }}
                >
                  <LogOut size={13}/> Déconnexion
                </button>
              </div>
            </div>
            <div
              style={{
                background: ''#021630'',
                color: ''white'',
                borderRadius: ''12px'',
                padding: ''18px'',
                textAlign: ''center'',
                boxShadow: ''0 8px 16px rgba(2,22,46,0.1)'',
              }}
            >
              <p style={{ margin: 0, fontSize: ''0.8rem'', opacity: 0.8 }}>Identité</p>
              <p style={{ margin: ''6px 0 0 0'', fontSize: ''1.15rem'', fontWeight: ''700'' }}>
                {user?.matricule}
              </p>
              <hr style={{ margin: ''10px 0'', border: ''none'', borderTop: ''1px solid rgba(255,255,255,0.2)'' }} />
              <p style={{ margin: ''0 0 6px 0'', fontSize: ''0.78rem'', opacity: 0.8 }}>
                Rôle: <span style={{ fontWeight: ''700'', color: ''#94a3b8'' }}>{roleAffiche}</span>
              </p>
              <p style={{ margin: 0, fontSize: ''0.78rem'', opacity: 0.8 }}>
                Ancienneté: <span style={{ fontWeight: ''700'', color: ''#94a3b8'' }}>{employe?.date_embauche ? calculateAnciennete(employe.date_embauche) : ''N/A''}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Informations du compte */}
        <div style={{ background: ''white'', borderRadius: 12, boxShadow: ''0 2px 12px rgba(0,0,0,0.07)'', border: ''1px solid #e2e8f0'', overflow: ''hidden'', marginBottom: 16 }}>
          <div style={{ background: ''#021630'', padding: ''10px 16px'', display: ''flex'', alignItems: ''center'', gap: 8 }}>
            <Icon name="user" size={14} stroke={2} />
            <h2 style={{ margin: 0, color: ''white'', fontSize: ''0.88rem'', fontWeight: 700 }}>Informations du compte</h2>
          </div>
          <div style={{ padding: ''14px 16px'' }}>
          <div
            style={{
              display: ''grid'',
              gridTemplateColumns: ''repeat(4, 1fr)'',
              gap: 1,
              background: ''#e2e8f0'',
              borderRadius: 8,
              overflow: ''hidden'',
            }}
          >
            {[
              {
                key: ''nom'',
                label: ''Nom complet'',
                value: [employe?.prenom || user?.prenom, employe?.nom || user?.nom].filter(Boolean).join('' '') || ''Non renseigné'',
                icon: ''user'',
                border: ''#94a3b8'',
                bg: ''#ffffff'',
                color: ''#334155'',
              },
              {
                key: ''solde_conges'',
                label: ''Solde congés'',
                value: soldeCp !== null ? soldeCp + '' jour(s)'' : ''N/A'',
                icon: ''calendar'',
                border: ''#94a3b8'',
                bg: ''#ffffff'',
                color: ''#334155'',
              },
              {
                key: ''matricule'',
                label: ''Matricule'',
                value: user?.matricule || ''N/A'',
                icon: ''badge'',
                border: ''#ce2b2b'',
                bg: ''#ffffff'',
                color: ''#021630'',
              },
              {
                key: ''email'',
                label: ''Email'',
                value: employe?.email || user?.email || ''Non renseigné'',
                icon: ''email'',
                border: ''#94a3b8'',
                bg: ''#ffffff'',
                color: ''#334155'',
              },
              {
                key: ''anciennete'',
                label: ''Ancienneté'',
                value: employe?.date_embauche ? calculateAnciennete(employe.date_embauche) : ''N/A'',
                icon: ''calendar'',
                border: ''#94a3b8'',
                bg: ''#ffffff'',
                color: ''#334155'',
              },
              {
                key: ''entite'',
                label: ''Entité'',
                value: entiteAffiche,
                icon: ''org'',
                border: ''#94a3b8'',
                bg: ''#ffffff'',
                color: ''#334155'',
              },
              {
                key: ''structure'',
                label: ''Département / Direction'',
                value: `${employe?.departement || employe?.nom_departement || ''Non renseigné''}${employe?.direction || employe?.nom_direction ? ` • ${employe?.direction || employe?.nom_direction}` : ''''}`,
                icon: ''org'',
                border: ''#94a3b8'',
                bg: ''#ffffff'',
                color: ''#334155'',
              },
              {
                key: ''fonction'',
                label: ''Fonction'',
                value: employe?.fonction || employe?.poste || employe?.titre || ''Non renseignée'',
                icon: ''fonction'',
                border: ''#021630'',
                bg: ''#ffffff'',
                color: ''#021630'',
              },
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  background: ''white'',
                  padding: ''9px 12px'',
                  display: ''flex'',
                  flexDirection: ''column'',
                  gap: 3,
                  borderLeft: `3px solid ${item.border}`,
                }}
              >
                <div style={{ display: ''flex'', alignItems: ''center'', gap: 4 }}>
                  <Icon name={item.icon} size={11} />
                  <span style={{ fontSize: ''0.61rem'', fontWeight: 600, color: ''#94a3b8'', textTransform: ''uppercase'', letterSpacing: ''0.04em'' }}>{item.label}</span>
                </div>
                <p style={{ margin: 0, color: ''#021630'', fontSize: ''0.75rem'', fontWeight: 600, lineHeight: 1.3, wordBreak: ''break-word'' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>          </div>        </div>

        {/* Create Modal */}
        {createModal && (
          <div style={{
            position: ''fixed'', top: 0, left: 0, right: 0, bottom: 0, background: ''rgba(0,0,0,0.5)'',
            display: ''flex'', alignItems: ''center'', justifyContent: ''center'', zIndex: 1000
          }}>
            <div style={{ background: ''white'', padding: ''32px'', borderRadius: ''12px'', maxWidth: ''400px'', width: ''90%'' }}>
              <h3 style={{ margin: ''0 0 20px 0'', color: ''#021630'' }}>
                {createModal === ''entite'' ? ''Créer une Entité'' : createModal === ''direction'' ? ''Créer une Direction'' : ''Créer un Département''}
              </h3>
              <form onSubmit={createAdminItem} style={{ display: ''grid'', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Nom"
                  value={createForm.nom}
                  onChange={(e) => setCreateForm({ ...createForm, nom: e.target.value })}
                  required
                  style={{ padding: ''10px'', borderRadius: ''6px'', border: ''1px solid #ddd'' }}
                />
                {(createModal === ''direction'' || createModal === ''departement'') && (
                  <input
                    type="number"
                    placeholder="ID Entité"
                    value={createForm.id_entite}
                    onChange={(e) => setCreateForm({ ...createForm, id_entite: e.target.value })}
                    required
                    style={{ padding: ''10px'', borderRadius: ''6px'', border: ''1px solid #ddd'' }}
                  />
                )}
                {createModal === ''departement'' && (
                  <input
                    type="number"
                    placeholder="ID Direction (optionnel)"
                    value={createForm.id_direction}
                    onChange={(e) => setCreateForm({ ...createForm, id_direction: e.target.value })}
                    style={{ padding: ''10px'', borderRadius: ''6px'', border: ''1px solid #ddd'' }}
                  />
                )}
                <div style={{ display: ''flex'', gap: 12 }}>
                  <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Créer</button>
                  <button
                    type="button"
                    onClick={() => { setCreateModal(null); setCreateForm({ nom: '''', id_entite: '''', id_direction: '''' }); }}
                    className="btn"
                    style={{ flex: 1, background: ''#e5e7eb'', color: ''#1f2937'' }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Two-column layout: main content + sidebar ── */}
        <div style={{ display: ''grid'', gridTemplateColumns: ''1fr 340px'', gap: 18, alignItems: ''start'' }}>
        <div>
        {/* Espace Équipe */}
        <div style={{ background: ''white'', borderRadius: 12, boxShadow: ''0 2px 12px rgba(0,0,0,0.07)'', border: ''1px solid #e2e8f0'', overflow: ''hidden'', marginBottom: 18 }}>
          <div style={{ background: ''#ce2b2b'', padding: ''10px 16px'', display: ''flex'', alignItems: ''center'', gap: 8 }}>
            <MessageSquare size={14} color="white" />
            <h2 style={{ margin: 0, color: ''white'', fontSize: ''0.88rem'', fontWeight: 700 }}>Espace Équipe</h2>
          </div>
          <div style={{ padding: ''14px 16px'' }}>

          {/* ── Compose bar ── */}
          <div style={{ background: ''white'', border: ''1px solid #e2e8f0'', borderRadius: 12, padding: ''14px 16px'', marginBottom: 14 }}>
            <div style={{ display: ''flex'', alignItems: ''center'', gap: 12, marginBottom: (showShoutoutForm || showKudosForm || showPollForm) ? 14 : 0 }}>
              <Avatar photo={employe?.photo} letter={(employe?.prenom || user?.prenom || ''U'')[0]} size={38} />
              {!showShoutoutForm && !showKudosForm && !showPollForm && (
                <div
                  onClick={() => { setShowShoutoutForm(true); setShowKudosForm(false); setShowPollForm(false) }}
                  style={{ flex: 1, background: ''#f8fafc'', border: ''1px solid #e2e8f0'', borderRadius: 24, padding: ''9px 18px'', cursor: ''pointer'', fontSize: ''0.85rem'', color: ''#94a3b8'', userSelect: ''none'' }}>
                  Écrire un shoutout...
                </div>
              )}
              {(showShoutoutForm || showKudosForm || showPollForm) && (
                <div style={{ flex: 1 }} />
              )}
              {/* Audience Picker — inline next to avatar */}
              <div style={{ position: ''relative'', flexShrink: 0 }}>
                <button type="button" onClick={() => setAudienceOpen(!audienceOpen)}
                  style={{ display: ''flex'', alignItems: ''center'', gap: 5, padding: ''6px 12px'', border: ''1px solid #e2e8f0'', borderRadius: 20, background: audienceType !== ''all'' ? ''#eff6ff'' : ''#f8fafc'', color: audienceType !== ''all'' ? ''#2563eb'' : ''#64748b'', fontSize: ''0.73rem'', fontWeight: 600, cursor: ''pointer'', whiteSpace: ''nowrap'' }}>
                  <Users size={12} />
                  {audienceType === ''all'' ? ''Tous'' : `${audienceSelected.length} sélect.`}
                  <ChevronDown size={11} style={{ transform: audienceOpen ? ''rotate(180deg)'' : ''none'', transition: ''transform 0.2s'' }} />
                </button>
                {audienceOpen && (
                  <div style={{ position: ''absolute'', top: ''100%'', right: 0, marginTop: 4, background: ''white'', borderRadius: 10, boxShadow: ''0 8px 24px rgba(0,0,0,0.18)'', border: ''1px solid #e2e8f0'', minWidth: 280, zIndex: 50, padding: ''10px 0'', maxHeight: 340, overflowY: ''auto'' }}>
                    <div style={{ display: ''flex'', gap: 4, padding: ''0 10px 8px'', borderBottom: ''1px solid #f1f5f9'', flexWrap: ''wrap'' }}>
                      {[{k:''all'',l:''Tous''},{k:''entites'',l:''Entités''},{k:''directions'',l:''Directions''},{k:''departements'',l:''Depts''}].map(t => (
                        <button type="button" key={t.k} onClick={() => { setAudienceType(t.k); if(t.k===''all'') setAudienceSelected([]) }}
                          style={{ padding: ''4px 10px'', borderRadius: 6, border: audienceType === t.k ? ''1px solid #2563eb'' : ''1px solid #e2e8f0'', background: audienceType === t.k ? ''#eff6ff'' : ''white'', color: audienceType === t.k ? ''#2563eb'' : ''#64748b'', fontSize: ''0.68rem'', fontWeight: 600, cursor: ''pointer'', whiteSpace: ''nowrap'' }}>
                          {t.l}
                        </button>
                      ))}
                    </div>
                    {audienceType === ''all'' && <div style={{ padding: ''12px 14px'', fontSize: ''0.8rem'', color: ''#475569'' }}>Visible par tout le monde.</div>}
                    {audienceType === ''entites'' && dbEntites.map(e => (
                      <label key={e.value} style={{ display: ''flex'', alignItems: ''center'', gap: 8, padding: ''6px 14px'', cursor: ''pointer'', fontSize: ''0.8rem'', color: ''#334155'' }}>
                        <input type="checkbox" checked={audienceSelected.includes(e.label)} onChange={() => toggleAudienceItem(e.label)} style={{ accentColor: ''#2563eb'' }} />
                        {e.label}
                      </label>
                    ))}
                    {audienceType === ''directions'' && dbDirections.map(d => (
                      <label key={d.value} style={{ display: ''flex'', alignItems: ''center'', gap: 8, padding: ''6px 14px'', cursor: ''pointer'', fontSize: ''0.8rem'', color: ''#334155'' }}>
                        <input type="checkbox" checked={audienceSelected.includes(d.label)} onChange={() => toggleAudienceItem(d.label)} style={{ accentColor: ''#2563eb'' }} />
                        {d.label}
                      </label>
                    ))}
                    {audienceType === ''departements'' && dbDepartements.map(d => (
                      <label key={d.value} style={{ display: ''flex'', alignItems: ''center'', gap: 8, padding: ''6px 14px'', cursor: ''pointer'', fontSize: ''0.8rem'', color: ''#334155'' }}>
                        <input type="checkbox" checked={audienceSelected.includes(d.label)} onChange={() => toggleAudienceItem(d.label)} style={{ accentColor: ''#2563eb'' }} />
                        {d.label}
                      </label>
                    ))}
                    {audienceType !== ''all'' && audienceSelected.length > 0 && (
                      <div style={{ padding: ''6px 14px'', borderTop: ''1px solid #f1f5f9'', display: ''flex'', flexWrap: ''wrap'', gap: 4 }}>
                        {audienceSelected.map(s => (
                          <span key={s} style={{ display: ''inline-flex'', alignItems: ''center'', gap: 4, background: ''#eff6ff'', color: ''#2563eb'', padding: ''2px 8px'', borderRadius: 12, fontSize: ''0.7rem'', fontWeight: 600 }}>
                            {s} <X size={10} style={{ cursor: ''pointer'' }} onClick={() => toggleAudienceItem(s)} />
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
              <div style={{ display: ''flex'', gap: 8, paddingTop: 12, borderTop: ''1px solid #f1f5f9'' }}>
                <button onClick={() => { setShowShoutoutForm(true); setShowKudosForm(false); setShowPollForm(false) }}
                  style={{ flex: 1, padding: ''7px 6px'', background: ''none'', border: ''1px solid #e2e8f0'', borderRadius: 8, cursor: ''pointer'', fontSize: ''0.78rem'', fontWeight: 600, color: ''#475569'', display: ''flex'', alignItems: ''center'', justifyContent: ''center'', gap: 5 }}>
                  <MessageSquare size={13} /> Féliciter
                </button>
                <button onClick={() => { setShowKudosForm(true); setShowShoutoutForm(false); setShowPollForm(false) }}
                  style={{ flex: 1, padding: ''7px 6px'', background: ''none'', border: ''1px solid #e2e8f0'', borderRadius: 8, cursor: ''pointer'', fontSize: ''0.78rem'', fontWeight: 600, color: ''#475569'', display: ''flex'', alignItems: ''center'', justifyContent: ''center'', gap: 5 }}>
                  <Star size={13} /> Kudos
                </button>
                <button onClick={() => { setShowPollForm(true); setShowShoutoutForm(false); setShowKudosForm(false) }}
                  style={{ flex: 1, padding: ''7px 6px'', background: ''none'', border: ''1px solid #e2e8f0'', borderRadius: 8, cursor: ''pointer'', fontSize: ''0.78rem'', fontWeight: 600, color: ''#475569'', display: ''flex'', alignItems: ''center'', justifyContent: ''center'', gap: 5 }}>
                  <BarChart size={13} /> Sondage
                </button>
              </div>
            )}

            {/* Shoutout Form */}
            {showShoutoutForm && (
              <form onSubmit={submitShoutout} style={{ display: ''flex'', flexDirection: ''column'', gap: 10 }}>
                <input style={{ border: ''1px solid #e2e8f0'', borderRadius: 8, padding: ''9px 12px'', fontSize: ''0.85rem'' }} placeholder="Qui félicitez-vous ? (prénom)" value={shoutoutForm.destinataire} onChange={e => setShoutoutForm({ ...shoutoutForm, destinataire: e.target.value })} required autoFocus />
                <textarea style={{ border: ''1px solid #e2e8f0'', borderRadius: 8, padding: ''9px 12px'', fontSize: ''0.85rem'', resize: ''vertical'', minHeight: 72 }} placeholder="Votre message de félicitations..." value={shoutoutForm.message} onChange={e => setShoutoutForm({ ...shoutoutForm, message: e.target.value })} required />
                <div style={{ display: ''flex'', gap: 8, justifyContent: ''flex-end'' }}>
                  <button type="button" onClick={() => { setShowShoutoutForm(false); resetAudience() }} style={{ padding: ''7px 14px'', background: ''#f1f5f9'', border: ''none'', borderRadius: 7, cursor: ''pointer'', color: ''#64748b'', fontSize: ''0.82rem'' }}>Annuler</button>
                  <button type="submit" style={{ padding: ''7px 18px'', background: ''#021630'', color: ''white'', border: ''none'', borderRadius: 7, cursor: ''pointer'', fontWeight: 700, fontSize: ''0.82rem'' }}>Publier</button>
                </div>
              </form>
            )}

            {/* Kudos Form */}
            {showKudosForm && (
              <form onSubmit={submitKudos} style={{ display: ''flex'', flexDirection: ''column'', gap: 10 }}>
                <input style={{ border: ''1px solid #e2e8f0'', borderRadius: 8, padding: ''9px 12px'', fontSize: ''0.85rem'' }} placeholder="Pour qui ? (prénom du collègue)" value={kudosForm.destinataire} onChange={e => setKudosForm({ ...kudosForm, destinataire: e.target.value })} required autoFocus />
                <select style={{ border: ''1px solid #e2e8f0'', borderRadius: 8, padding: ''9px 12px'', fontSize: ''0.85rem'', background: ''white'' }} value={kudosForm.valeur} onChange={e => setKudosForm({ ...kudosForm, valeur: e.target.value })}>
                  {[''Excellence'', ''Innovation'', ''Collaboration'', ''Créativité'', ''Leadership'', ''Entraide'', ''Performance''].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <textarea style={{ border: ''1px solid #e2e8f0'', borderRadius: 8, padding: ''9px 12px'', fontSize: ''0.85rem'', resize: ''vertical'', minHeight: 55 }} placeholder="Pourquoi mérite-t-il ces kudos ? (optionnel)" value={kudosForm.raison} onChange={e => setKudosForm({ ...kudosForm, raison: e.target.value })} />
                <div style={{ display: ''flex'', gap: 8, justifyContent: ''flex-end'' }}>
                  <button type="button" onClick={() => { setShowKudosForm(false); resetAudience() }} style={{ padding: ''7px 14px'', background: ''#f1f5f9'', border: ''none'', borderRadius: 7, cursor: ''pointer'', color: ''#64748b'', fontSize: ''0.82rem'' }}>Annuler</button>
                  <button type="submit" style={{ padding: ''7px 18px'', background: ''#ce2b2b'', color: ''white'', border: ''none'', borderRadius: 7, cursor: ''pointer'', fontWeight: 700, fontSize: ''0.82rem'' }}>Envoyer les Kudos</button>
                </div>
              </form>
            )}

            {/* Poll Form */}
            {showPollForm && (
              <form onSubmit={submitPoll} style={{ display: ''flex'', flexDirection: ''column'', gap: 10 }}>
                <input style={{ border: ''1px solid #e2e8f0'', borderRadius: 8, padding: ''9px 12px'', fontSize: ''0.85rem'' }} placeholder="Question du sondage..." value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} required autoFocus />
                {pollForm.options.map((opt, i) => (
                  <div key={i} style={{ display: ''flex'', gap: 6 }}>
                    <input style={{ flex: 1, border: ''1px solid #e2e8f0'', borderRadius: 8, padding: ''8px 12px'', fontSize: ''0.85rem'' }} placeholder={`Option ${i + 1}...`} value={opt} onChange={e => { const opts = [...pollForm.options]; opts[i] = e.target.value; setPollForm({ ...pollForm, options: opts }) }} />
                    {i >= 2 && <button type="button" onClick={() => setPollForm({ ...pollForm, options: pollForm.options.filter((_, j) => j !== i) })} style={{ background: ''#fef2f2'', border: ''none'', borderRadius: 8, padding: ''8px'', cursor: ''pointer'', color: ''#ce2b2b'' }}><X size={12} /></button>}
                  </div>
                ))}
                {pollForm.options.length < 5 && (
                  <button type="button" onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''''] })} style={{ background: ''#f8fafc'', border: ''1px dashed #cbd5e1'', borderRadius: 8, padding: ''7px'', cursor: ''pointer'', color: ''#64748b'', fontSize: ''0.8rem'' }}>+ Ajouter une option</button>
                )}
                <div style={{ display: ''flex'', gap: 8, justifyContent: ''flex-end'' }}>
                  <button type="button" onClick={() => { setShowPollForm(false); resetAudience() }} style={{ padding: ''7px 14px'', background: ''#f1f5f9'', border: ''none'', borderRadius: 7, cursor: ''pointer'', color: ''#64748b'', fontSize: ''0.82rem'' }}>Annuler</button>
                  <button type="submit" style={{ padding: ''7px 18px'', background: ''#021630'', color: ''white'', border: ''none'', borderRadius: 7, cursor: ''pointer'', fontWeight: 700, fontSize: ''0.82rem'' }}>Publier</button>
                </div>
              </form>
            )}
          </div>

          {/* ── Filter Bar ── */}
          <div style={{ display: ''flex'', gap: 8, marginBottom: 14, flexWrap: ''wrap'', alignItems: ''center'' }}>
            {[{ key: ''all'', label: ''Tout'' }, { key: ''shoutout'', label: ''Félicitations'' }, { key: ''kudos'', label: ''Kudos'' }, { key: ''poll'', label: ''Sondages'' }].map(f => (
              <button key={f.key} onClick={() => setFilterType(f.key)}
                style={{ padding: ''5px 12px'', borderRadius: 20, border: filterType === f.key ? ''2px solid #021630'' : ''1px solid #e2e8f0'', background: filterType === f.key ? ''#021630'' : ''white'', color: filterType === f.key ? ''white'' : ''#475569'', fontSize: ''0.75rem'', fontWeight: 600, cursor: ''pointer'' }}>
                {f.label}
              </button>
            ))}
            <div style={{ flex: 1, minWidth: 140, position: ''relative'' }}>
              <Search size={13} style={{ position: ''absolute'', left: 10, top: ''50%'', transform: ''translateY(-50%)'', color: ''#94a3b8'' }} />
              <input
                value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                placeholder="Rechercher un nom, message..."
                style={{ width: ''100%'', padding: ''6px 10px 6px 30px'', borderRadius: 20, border: ''1px solid #e2e8f0'', fontSize: ''0.78rem'', outline: ''none'', background: ''#f8fafc'' }}
              />
            </div>
          </div>

          {/* ── Social Feed (scrollable) ── */}
          <div style={{ maxHeight: 520, overflowY: ''auto'', paddingRight: 4 }}>
          {filteredFeed.length === 0 ? (
              <div style={{ textAlign: ''center'', padding: ''40px 20px'', color: ''#94a3b8'', background: ''white'', borderRadius: 12, border: ''1px solid #e2e8f0'' }}>
                <MessageSquare size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: ''0.88rem'' }}>Le fil est vide. Soyez le premier à publier !</p>
              </div>
          ) : (
              <div style={{ display: ''flex'', flexDirection: ''column'', gap: 12 }}>
                {filteredFeed.map(item => (
                  <div key={`${item._type}-${item.id}`} style={{ background: ''white'', border: ''1px solid #e2e8f0'', borderRadius: 12, overflow: ''hidden'' }}>

                    {/* Post header */}
                    <div style={{ padding: ''12px 16px'', display: ''flex'', alignItems: ''center'', gap: 10 }}>
                      <Avatar letter={(item.from || ''U'')[0]} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: ''#021630'', fontSize: ''0.88rem'', lineHeight: 1.2 }}>{item.from}</div>
                        <div style={{ fontSize: ''0.7rem'', color: ''#94a3b8'' }}>
                          {item.date}
                          {item.audience && item.audience.type !== ''all'' && item.audience.selected?.length > 0 && (
                            <span style={{ marginLeft: 6, color: ''#2563eb'' }}>• {item.audience.selected.join('', '')}</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: ''0.67rem'', fontWeight: 700, padding: ''2px 9px'', borderRadius: 20, background: item._type === ''kudos'' ? ''#fef2f2'' : item._type === ''poll'' ? ''#f1f5f9'' : ''#f0f4ff'', color: item._type === ''kudos'' ? ''#ce2b2b'' : item._type === ''poll'' ? ''#475569'' : ''#021630'', border: `1px solid ${item._type === ''kudos'' ? ''#fecaca'' : ''#e2e8f0''}` }}>
                        {item._type === ''kudos'' ? ''Kudos'' : item._type === ''poll'' ? ''Sondage'' : ''Shoutout''}
                      </span>
                    </div>

                    {/* Shoutout body */}
                    {item._type === ''shoutout'' && (
                      <div style={{ padding: ''0 16px 14px'' }}>
                        <p style={{ margin: ''0 0 6px'', fontSize: ''0.88rem'', color: ''#334155'' }}>
                          Pour <span style={{ fontWeight: 700, color: ''#ce2b2b'' }}>@{item.destinataire}</span>
                        </p>
                        <p style={{ margin: 0, color: ''#475569'', fontSize: ''0.85rem'', lineHeight: 1.55 }}>{item.message}</p>
                      </div>
                    )}

                    {/* Kudos body — visual banner */}
                    {item._type === ''kudos'' && (
                      <>
                        <div style={{ padding: ''0 16px 10px'' }}>
                          <p style={{ margin: 0, fontSize: ''0.85rem'', color: ''#475569'' }}>
                            Kudos à <span style={{ fontWeight: 700, color: ''#ce2b2b'' }}>@{item.destinataire}</span>
                          </p>
                        </div>
                        <div style={{ margin: ''0 16px 16px'', borderRadius: 10, background: ''#021630'', padding: ''22px 20px'', display: ''flex'', alignItems: ''center'', gap: 16 }}>
                          <div style={{ width: 44, height: 44, borderRadius: ''50%'', background: ''transparent'', border: ''2px solid rgba(255,255,255,0.3)'', display: ''flex'', alignItems: ''center'', justifyContent: ''center'', fontSize: ''1.1rem'', fontWeight: 800, color: ''rgba(255,255,255,0.85)'', flexShrink: 0 }}>
                            {((item.destinataire || ''?'')[0]).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: ''0.82rem'', fontWeight: 700, color: ''white'', letterSpacing: 1.5, textTransform: ''uppercase'', marginBottom: 3 }}>Kudos</div>
                            <div style={{ fontSize: ''0.82rem'', color: ''rgba(255,255,255,0.85)'', fontWeight: 600 }}>{item.valeur}</div>
                            {item.raison && <div style={{ fontSize: ''0.76rem'', color: ''rgba(255,255,255,0.6)'', marginTop: 4, fontStyle: ''italic'' }}>"{item.raison}"</div>}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Poll body */}
                    {item._type === ''poll'' && (() => {
                      const totalVotes = item.options.reduce((s, o) => s + o.votes, 0)
                      const hasVoted = item.votedBy?.includes(String(user?.matricule))
                      return (
                        <div style={{ padding: ''0 16px 14px'' }}>
                          <p style={{ margin: ''0 0 10px'', fontWeight: 700, color: ''#021630'', fontSize: ''0.9rem'' }}>{item.question}</p>
                          <div style={{ display: ''flex'', flexDirection: ''column'', gap: 8 }}>
                            {item.options.map((opt, i) => {
                              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
                              return (
                                <div key={i} style={{ cursor: hasVoted ? ''default'' : ''pointer'' }} onClick={() => !hasVoted && votePoll(item.id, i)}>
                                  <div style={{ display: ''flex'', justifyContent: ''space-between'', fontSize: ''0.8rem'', marginBottom: 3 }}>
                                    <span style={{ color: ''#334155'' }}>{opt.texte}</span>
                                    <span style={{ color: ''#64748b'', fontWeight: 600 }}>{pct}%</span>
                                  </div>
                                  <div style={{ height: 7, background: ''#f1f5f9'', borderRadius: 4, overflow: ''hidden'' }}>
                                    <div style={{ width: `${pct}%`, height: ''100%'', background: ''#021630'', borderRadius: 4, transition: ''width 0.3s'' }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ fontSize: ''0.7rem'', color: ''#94a3b8'', marginTop: 8 }}>
                            {totalVotes} vote{totalVotes !== 1 ? ''s'' : ''''}
                            {!hasVoted && <span style={{ color: ''#ce2b2b'', marginLeft: 6 }}>• Cliquez pour voter</span>}
                            {hasVoted && <span style={{ color: ''#021630'', fontWeight: 600, marginLeft: 6 }}>• Voté</span>}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Post footer — React + Comment */}
                    <div style={{ borderTop: ''1px solid #f1f5f9'', padding: ''6px 16px'', display: ''flex'', gap: 4 }}>
                      <button
                        onClick={() => likePost(item._type, item.id)}
                        style={{ flex: 1, background: ''none'', border: ''none'', borderRadius: 8, padding: ''7px'', cursor: ''pointer'', color: ''#64748b'', fontSize: ''0.78rem'', fontWeight: 600, display: ''flex'', alignItems: ''center'', justifyContent: ''center'', gap: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = ''#f8fafc''}
                        onMouseLeave={e => e.currentTarget.style.background = ''none''}>
                        <ThumbsUp size={14} /> {item.likes > 0 ? `${item.likes} ` : ''''}React
                      </button>
                      <button
                        style={{ flex: 1, background: ''none'', border: ''none'', borderRadius: 8, padding: ''7px'', cursor: ''pointer'', color: ''#64748b'', fontSize: ''0.78rem'', fontWeight: 600, display: ''flex'', alignItems: ''center'', justifyContent: ''center'', gap: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = ''#f8fafc''}
                        onMouseLeave={e => e.currentTarget.style.background = ''none''}>
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
        <div className="card" style={{ background: ''#ffffff'', border: ''1px solid #e2e8f0'', borderLeft: ''4px solid #021630'', marginBottom: 18, padding: ''18px 20px'' }}>
          <h3 style={{ margin: ''0 0 10px 0'', color: ''#021630'', fontSize: ''1rem'', fontWeight: 700 }}>Informations utiles</h3>
          <ul style={{ margin: 0, paddingLeft: 18, color: ''#475569'', fontSize: ''0.84rem'' }}>
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
              <strong>Support:</strong> Contactez l''équipe IT pour toute assistance
            </li>
          </ul>
        </div>
        </div>{/* end left column */}

        {/* ── Right Sidebar ── */}
        <div style={{ display: ''flex'', flexDirection: ''column'', gap: 16, position: ''sticky'', top: 16 }}>

          {/* Profile Card */}
          <div style={{ background: ''white'', borderRadius: 10, border: ''1px solid #e2e8f0'', padding: ''12px 14px'' }}>
            <div style={{ display: ''flex'', alignItems: ''center'', gap: 10, marginBottom: 10 }}>
              <Avatar photo={employe?.photo} letter={(employe?.prenom || user?.prenom || ''U'')[0]} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: ''#021630'', fontSize: ''0.82rem'', lineHeight: 1.2 }}>{employe?.prenom || user?.prenom} {employe?.nom || user?.nom}</div>
                <div style={{ color: ''#94a3b8'', fontSize: ''0.68rem'' }}>{employe?.fonction || employe?.poste || roleAffiche}</div>
              </div>
              <Link to="/profile" style={{ color: ''#64748b'', fontSize: ''0.68rem'', fontWeight: 600, textDecoration: ''none'', whiteSpace: ''nowrap'' }}>
                Voir profil →
              </Link>
            </div>
            <div style={{ display: ''flex'', alignItems: ''center'', gap: 8 }}>
              <div style={{ flex: 1, display: ''flex'', justifyContent: ''space-between'', alignItems: ''center'', background: ''#f8fafc'', borderRadius: 6, padding: ''6px 10px'' }}>
                <span style={{ fontSize: ''0.68rem'', color: ''#64748b'' }}>Solde congés</span>
                <span style={{ fontSize: ''0.78rem'', fontWeight: 700, color: ''#021630'' }}>{soldeCp !== null ? `${soldeCp} j` : ''N/A''}</span>
              </div>
              <Link to="/operations" style={{ padding: ''6px 12px'', borderRadius: 6, background: ''#021630'', color: ''white'', textDecoration: ''none'', fontWeight: 600, fontSize: ''0.7rem'', whiteSpace: ''nowrap'' }}>
                Demander un congé
              </Link>
            </div>
          </div>

          {/* Disponibilité aujourd''hui */}
          <div style={{ background: ''white'', borderRadius: 12, boxShadow: ''0 2px 12px rgba(0,0,0,0.07)'', border: ''1px solid #e2e8f0'', overflow: ''hidden'' }}>
            <div style={{ padding: ''12px 16px'', borderBottom: ''1px solid #f1f5f9'' }}>
              <span style={{ fontSize: ''0.85rem'', fontWeight: 700, color: ''#021630'' }}>Disponibilité aujourd''hui</span>
            </div>
            <div style={{ padding: ''12px 16px'' }}>
              {(() => {
                const categories = [
                  { key: ''CONGE'', label: ''En congé'' },
                  { key: ''MISSION'', label: ''En mission'' },
                  { key: ''PERMISSION'', label: ''En permission'' },
                  { key: ''SORTIE'', label: ''En sortie'' },
                ]
                const totalEmployees = allEmployees.length || 1
                return categories.map(cat => {
                  const people = employeesAbsent.filter(op => op.type === cat.key)
                  const pct = Math.round((people.length / totalEmployees) * 100)
                  return (
                    <div key={cat.key} style={{ marginBottom: 14 }}>
                      <div style={{ display: ''flex'', alignItems: ''center'', justifyContent: ''space-between'', marginBottom: 5 }}>
                        <span style={{ fontSize: ''0.78rem'', fontWeight: 600, color: ''#334155'' }}>{cat.label}</span>
                        <span style={{ fontSize: ''0.72rem'', fontWeight: 700, color: ''#021630'', background: ''#f1f5f9'', padding: ''2px 8px'', borderRadius: 4 }}>{people.length}</span>
                      </div>
                      <div style={{ height: 4, background: ''#f1f5f9'', borderRadius: 2, overflow: ''hidden'', marginBottom: 8 }}>
                        <div style={{ height: ''100%'', width: `${pct}%`, background: ''#021630'', borderRadius: 2, transition: ''width 0.5s ease'' }} />
                      </div>
                      {people.length > 0 && (
                        <div style={{ display: ''flex'', alignItems: ''center'', justifyContent: ''space-between'' }}>
                          <div style={{ display: ''flex'', flexDirection: ''column'', gap: 3, flex: 1, minWidth: 0 }}>
                            {people.slice(0, 3).map((p, i) => (
                              <span key={i} style={{ fontSize: ''0.7rem'', color: ''#475569'', whiteSpace: ''nowrap'', overflow: ''hidden'', textOverflow: ''ellipsis'' }}>{p.prenom} {p.nom}</span>
                            ))}
                            {people.length > 3 && <span style={{ fontSize: ''0.68rem'', color: ''#94a3b8'' }}>+{people.length - 3} autres</span>}
                          </div>
                          <div style={{ display: ''flex'', alignItems: ''center'', flexShrink: 0, marginLeft: 8 }}>
                            {people.slice(0, 4).map((p, i) => (
                              <Avatar key={i} letter={(p.prenom || ''?'')[0]} size={26} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 5 - i }} />
                            ))}
                            {people.length > 4 && (
                              <Avatar letter={`+${people.length - 4}`} size={26} style={{ marginLeft: -6, zIndex: 0 }} />
                            )}
                          </div>
                        </div>
                      )}
                      {people.length === 0 && (
                        <div style={{ fontSize: ''0.68rem'', color: ''#cbd5e1'' }}>Aucun</div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Anniversaires à venir */}
          <div style={{ background: ''white'', borderRadius: 10, border: ''1px solid #e2e8f0'', overflow: ''hidden'' }}>
            <div style={{ padding: ''12px 16px'', borderBottom: ''1px solid #f1f5f9'' }}>
              <span style={{ fontSize: ''0.85rem'', fontWeight: 700, color: ''#021630'' }}>Anniversaires à venir</span>
            </div>
            <div style={{ padding: ''12px 14px'' }}>
              {upcomingBirthdays.length === 0 ? (
                <div style={{ textAlign: ''center'', padding: ''14px 8px'', color: ''#94a3b8'' }}>
                  <p style={{ margin: 0, fontSize: ''0.75rem'' }}>Aucun anniversaire à venir</p>
                </div>
              ) : (
                <div ref={birthdayRef} style={{ display: ''flex'', flexDirection: ''column'', gap: 8 }}>
                  {upcomingBirthdays.slice(0, 5).map(b => {
                    const wished = hasWished(b.matricule)
                    const isToday = b.daysUntil === 0
                    const bdDate = b.date_naissance ? new Date(b.date_naissance) : null
                    const dateStr = bdDate ? bdDate.toLocaleDateString(''fr-FR'', { day: ''2-digit'', month: ''short'' }) : ''''
                    return (
                      <div key={b.matricule} style={{ display: ''flex'', alignItems: ''center'', gap: 10, padding: ''6px 0'' }}>
                        <Avatar letter={(b.prenom || ''?'')[0]} size={30} borderWidth={isToday ? 2 : 1.5} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: ''#021630'', fontSize: ''0.75rem'', lineHeight: 1.2 }}>{b.prenom} {b.nom}</div>
                          <div style={{ fontSize: ''0.65rem'', color: ''#94a3b8'' }}>{dateStr} • {isToday ? ''Aujourd\''hui'' : `Dans ${b.daysUntil}j`}</div>
                        </div>
                        <button
                          onClick={() => sendWishes(b.matricule)}
                          disabled={wished}
                          style={{ padding: ''4px 10px'', borderRadius: 4, border: wished ? ''1px solid #d1d5db'' : ''1px solid #021630'', background: wished ? ''#f8fafc'' : ''#021630'', color: wished ? ''#6b7280'' : ''white'', fontSize: ''0.65rem'', fontWeight: 600, cursor: wished ? ''default'' : ''pointer'', whiteSpace: ''nowrap'' }}
                        >
                          {wished ? ''Envoyé'' : ''Voeux''}
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
        <div style={{ textAlign: ''center'', color: ''#94a3b8'', fontSize: ''0.8rem'', marginTop: ''18px'', paddingBottom: ''16px'' }}>
          <p style={{ margin: 0 }}>© 2026 ELITE CAPITAL Group. Tous droits réservés.</p>
          <p style={{ margin: ''6px 0 0 0'', opacity: 0.8 }}>Extranet securisé - ISO 27001 | RGPD Compliant</p>
        </div>
      </div>
    </div>
  )
}
'
[System.IO.File]::WriteAllText('c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A\Documents\EMS\extranet\frontend\src\pages\Home.jsx', $content, [System.Text.Encoding]::UTF8)
Write-Host 'Home.jsx written:' $content.Length 'chars'