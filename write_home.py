content = r"""import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { BarChart2, LogOut, MessageSquare, ThumbsUp, X, ChevronDown, Search, Filter } from 'lucide-react'

const SHOUTOUTS_KEY = 'ems_shoutouts_v3'
const KUDOS_KEY     = 'ems_kudos_v3'
const POLLS_KEY     = 'ems_polls_v3'
const loadLS = k => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const saveLS = (k, d) => localStorage.setItem(k, JSON.stringify(d))

/* ── Avatar ─────────────────────────────────────────────────────── */
function Avatar({ name = '', bg = '#021630', size = 32 }) {
  const init = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.floor(size * 0.35) + 'px', flexShrink: 0, border: '2px solid white' }}>
      {init}
    </div>
  )
}

/* ── Stacked avatars ─────────────────────────────────────────────── */
function StackedAvatars({ people, max = 3 }) {
  const shown = people.slice(0, max)
  const rest  = people.length - max
  const bgs   = ['#021630', '#ce2b2b', '#334155', '#64748b', '#1e3a5f']
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <div key={i} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: shown.length - i }}>
          <Avatar name={`${p.prenom || ''} ${p.nom || ''}`} bg={bgs[i % bgs.length]} size={24} />
        </div>
      ))}
      {rest > 0 && (
        <div style={{ marginLeft: -8, width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 700, color: '#475569' }}>
          +{rest}
        </div>
      )}
    </div>
  )
}

/* ── Icon ────────────────────────────────────────────────────────── */
function Icon({ name, size = 14, stroke = 1.8 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const icons = {
    user:    (<><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></>),
    badge:   (<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8"/><path d="M8 13h5"/></>),
    email:   (<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>),
    calendar:(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>),
    org:     (<><path d="M12 4v5"/><path d="M6 14h12"/><rect x="3" y="14" width="6" height="6" rx="1"/><rect x="15" y="14" width="6" height="6" rx="1"/><rect x="9" y="8" width="6" height="4" rx="1"/></>),
    fonction:(<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v3"/><path d="M10.5 13.5h3"/></>),
  }
  return <svg {...c}>{icons[name]}</svg>
}

/* ── Audience picker ─────────────────────────────────────────────── */
function AudiencePicker({ value, onChange, employees }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const entites     = useMemo(() => [...new Set(employees.map(e => e.nom_entite || e.entite).filter(Boolean))].sort(), [employees])
  const directions  = useMemo(() => [...new Set(employees.map(e => e.nom_direction || e.direction).filter(Boolean))].sort(), [employees])
  const departements= useMemo(() => [...new Set(employees.map(e => e.nom_departement || e.departement).filter(Boolean))].sort(), [employees])
  const type = value?.type || 'all'
  const vals = value?.values || []
  const label = type === 'all' ? '🌐 Toutes les entités'
    : type === 'entite'      ? `🏢 ${vals.length ? vals.join(', ') : 'Entité...'}`
    : type === 'direction'   ? `📂 ${vals.length ? vals.join(', ') : 'Direction...'}`
    : `📁 ${vals.length ? vals.join(', ') : 'Département...'}`
  const toggleVal = (t, v) => {
    const cur  = type === t ? vals : []
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
    onChange(next.length ? { type: t, values: next } : { type: 'all' })
  }
  const listFor = t => t === 'entite' ? entites : t === 'direction' ? directions : departements
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: type === 'all' ? '#f1f5f9' : '#021630', color: type === 'all' ? '#475569' : 'white', border: `1px solid ${type === 'all' ? '#e2e8f0' : '#021630'}`, borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: '0.68rem', maxWidth: 180 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 500, minWidth: 220, padding: 10 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {['all', 'entite', 'direction', 'departement'].map(t => (
              <button key={t} type="button" onClick={() => onChange(t === 'all' ? { type: 'all' } : { type: t, values: [] })} style={{ flex: 1, padding: '4px 2px', background: type === t ? '#021630' : '#f1f5f9', color: type === t ? 'white' : '#475569', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.6rem' }}>
                {t === 'all' ? 'Tous' : t === 'entite' ? 'Entité' : t === 'direction' ? 'Direction' : 'Dépt.'}
              </button>
            ))}
          </div>
          {type !== 'all' && (
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {listFor(type).map(v => {
                const checked = vals.includes(v)
                return (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', background: checked ? '#f0f4fa' : 'transparent', fontSize: '0.74rem', color: '#334155' }}>
                    <input type="checkbox" checked={!!checked} onChange={() => toggleVal(type, v)} style={{ accentColor: '#021630', width: 12, height: 12 }} />
                    {v}
                  </label>
                )
              })}
              {listFor(type).length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.72rem', padding: '6px' }}>Aucune donnée</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user, logout } = useAuth()
  const [employe, setEmploye]         = useState(null)
  const [allEmployees, setAllEmployees] = useState([])
  const [absences, setAbsences]       = useState([])

  const [shoutouts, setShoutouts] = useState(() => loadLS(SHOUTOUTS_KEY))
  const [kudos, setKudos]         = useState(() => loadLS(KUDOS_KEY))
  const [polls, setPolls]         = useState(() => loadLS(POLLS_KEY))

  const [composeType, setComposeType] = useState(null)
  const [audience, setAudience]       = useState({ type: 'all' })
  const [shoutoutForm, setShoutoutForm] = useState({ destinataire: '', message: '' })
  const [kudosForm, setKudosForm]       = useState({ destinataire: '', raison: '', valeur: 'Excellence' })
  const [pollForm, setPollForm]         = useState({ question: '', options: ['', ''] })

  const [filterType, setFilterType]     = useState('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterEntite, setFilterEntite] = useState('')
  const [filterMonth, setFilterMonth]   = useState('')

  useEffect(() => {
    const matricule = Number(user?.matricule || user?.sub || 0)
    if (matricule) api.get(`/employees/${matricule}`).then(r => setEmploye(r.data)).catch(() => {})
    api.get('/employees').then(r => setAllEmployees(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    api.get('/leaves').then(r => {
      const today = new Date().toISOString().split('T')[0]
      const active = (Array.isArray(r.data) ? r.data : []).filter(l => {
        const s = l.date_debut || l.start_date || l.date_start || ''
        const e = l.date_fin   || l.end_date   || l.date_end   || today
        return l.statut !== 'REFUSE' && s <= today && today <= e
      })
      setAbsences(active)
    }).catch(() => {})
  }, [user])

  const calcAnc = d => {
    if (!d) return 'N/A'
    const diff = new Date() - new Date(d), days = Math.floor(diff / 86400000)
    const y = Math.floor(days / 365.25), m = Math.floor((days % 365.25) / 30.44)
    if (y === 0) return `${m} mois`
    if (m === 0) return `${y} an${y > 1 ? 's' : ''}`
    return `${y} an${y > 1 ? 's' : ''} ${m} mois`
  }
  const greeting    = () => { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bonsoir' : 'Bonne nuit' }
  const entiteAff   = employe?.entite || employe?.nom_entite || 'Non renseignée'

  /* birthdays */
  const birthdays = useMemo(() => {
    const today = new Date()
    const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return allEmployees
      .filter(e => e.date_naissance)
      .map(e => {
        const d  = new Date(e.date_naissance)
        const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
        if (next < today) next.setFullYear(today.getFullYear() + 1)
        return { ...e, _md: md, _isToday: md === todayMD, _diff: Math.round((next - today) / 86400000) }
      })
      .filter(e => e._diff <= 30)
      .sort((a, b) => a._diff - b._diff)
  }, [allEmployees])

  /* availability groups */
  const availGroups = useMemo(() => {
    const g = {
      'Congé':      { icon: '🏖️', color: '#0ea5e9', people: [] },
      'Maladie':    { icon: '🤒', color: '#f59e0b', people: [] },
      'Mission':    { icon: '✈️', color: '#8b5cf6', people: [] },
      'Permission': { icon: '🕐', color: '#10b981', people: [] },
    }
    absences.forEach(l => {
      const emp = allEmployees.find(e => String(e.matricule) === String(l.id_employe || l.matricule || l.employee_id || ''))
      if (!emp) return
      const t = (l.type_conge || l.type || '').toLowerCase()
      const key = t.includes('maladie') ? 'Maladie' : t.includes('mission') ? 'Mission' : t.includes('permission') ? 'Permission' : 'Congé'
      g[key].people.push(emp)
    })
    return g
  }, [absences, allEmployees])

  /* feed */
  const allEntites = useMemo(() => [...new Set(allEmployees.map(e => e.nom_entite || e.entite).filter(Boolean))].sort(), [allEmployees])
  const MONTHS = [['01','Jan'],['02','Fév'],['03','Mar'],['04','Avr'],['05','Mai'],['06','Jun'],['07','Jul'],['08','Aoû'],['09','Sep'],['10','Oct'],['11','Nov'],['12','Déc']]

  const feed = useMemo(() => {
    const merged = [
      ...shoutouts.map(s => ({ ...s, _type: 'shoutout' })),
      ...kudos.map(k => ({ ...k, _type: 'kudos' })),
      ...polls.map(p => ({ ...p, _type: 'poll' })),
    ].sort((a, b) => b.id - a.id)
    return merged.filter(item => {
      if (filterType !== 'all' && item._type !== filterType) return false
      if (filterSearch) {
        const q   = filterSearch.toLowerCase()
        const hay = `${item.from} ${item.destinataire || ''} ${item.message || ''} ${item.question || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filterEntite && item.fromEntite && item.fromEntite !== filterEntite) return false
      if (filterMonth && item.date) { if (item.date.split('/')[1] !== filterMonth) return false }
      return true
    })
  }, [shoutouts, kudos, polls, filterType, filterSearch, filterEntite, filterMonth])

  /* handlers */
  const myName = `${employe?.prenom || user?.prenom || 'Moi'} ${employe?.nom || user?.nom || ''}`.trim()
  const now    = () => ({ id: Date.now(), audience, from: myName, fromEntite: entiteAff, date: new Date().toLocaleDateString('fr-FR'), likes: 0 })

  const submitShoutout = e => {
    e.preventDefault()
    if (!shoutoutForm.destinataire.trim() || !shoutoutForm.message.trim()) return
    const u = [{ ...now(), ...shoutoutForm }, ...shoutouts].slice(0, 30)
    setShoutouts(u); saveLS(SHOUTOUTS_KEY, u)
    setShoutoutForm({ destinataire: '', message: '' }); setComposeType(null); setAudience({ type: 'all' })
  }
  const submitKudos = e => {
    e.preventDefault()
    if (!kudosForm.destinataire.trim()) return
    const u = [{ ...now(), ...kudosForm }, ...kudos].slice(0, 30)
    setKudos(u); saveLS(KUDOS_KEY, u)
    setKudosForm({ destinataire: '', raison: '', valeur: 'Excellence' }); setComposeType(null); setAudience({ type: 'all' })
  }
  const submitPoll = e => {
    e.preventDefault()
    if (!pollForm.question.trim() || pollForm.options.filter(o => o.trim()).length < 2) return
    const options = pollForm.options.filter(o => o.trim()).map(o => ({ texte: o, votes: 0 }))
    const u = [{ ...now(), question: pollForm.question, options, votedBy: [] }, ...polls].slice(0, 20)
    setPolls(u); saveLS(POLLS_KEY, u)
    setPollForm({ question: '', options: ['', ''] }); setComposeType(null); setAudience({ type: 'all' })
  }
  const likePost = (type, id) => {
    if (type === 'shoutout') { const u = shoutouts.map(s => s.id === id ? { ...s, likes: (s.likes || 0) + 1 } : s); setShoutouts(u); saveLS(SHOUTOUTS_KEY, u) }
    if (type === 'kudos')    { const u = kudos.map(k => k.id === id ? { ...k, likes: (k.likes || 0) + 1 } : k); setKudos(u); saveLS(KUDOS_KEY, u) }
    if (type === 'poll')     { const u = polls.map(p => p.id === id ? { ...p, likes: (p.likes || 0) + 1 } : p); setPolls(u); saveLS(POLLS_KEY, u) }
  }
  const votePoll = (pollId, optIdx) => {
    const vid = String(user?.matricule)
    const u = polls.map(p => {
      if (p.id !== pollId || p.votedBy?.includes(vid)) return p
      return { ...p, options: p.options.map((o, i) => i === optIdx ? { ...o, votes: o.votes + 1 } : o), votedBy: [...(p.votedBy || []), vid] }
    })
    setPolls(u); saveLS(POLLS_KEY, u)
  }

  const infoCards = [
    { key: 'nom',       label: 'Nom complet',  value: [employe?.prenom || user?.prenom, employe?.nom || user?.nom].filter(Boolean).join(' ') || 'Non renseigné', icon: 'user',     border: '#94a3b8' },
    { key: 'matricule', label: 'Matricule',    value: user?.matricule || 'N/A',                                                                                   icon: 'badge',    border: '#ce2b2b' },
    { key: 'email',     label: 'Email',        value: employe?.email || user?.email || 'Non renseigné',                                                           icon: 'email',    border: '#94a3b8' },
    { key: 'anc',       label: 'Ancienneté',   value: employe?.date_embauche ? calcAnc(employe.date_embauche) : 'N/A',                                            icon: 'calendar', border: '#94a3b8' },
    { key: 'entite',    label: 'Entité',       value: entiteAff,                                                                                                  icon: 'org',      border: '#94a3b8' },
    { key: 'struct',    label: 'Dépt./Dir.',   value: `${employe?.departement || employe?.nom_departement || 'N/A'}${employe?.direction || employe?.nom_direction ? ' · ' + (employe?.direction || employe?.nom_direction) : ''}`, icon: 'org', border: '#94a3b8' },
    { key: 'fonction',  label: 'Fonction',     value: employe?.fonction || employe?.poste || 'Non renseignée',                                                    icon: 'fonction', border: '#021630' },
  ]

  /* ─── RENDER ──────────────────────────────────────────────────── */
  return (
    <div style={{ background: '#f1f4f8', minHeight: '100vh' }}>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(100deg,#021630 55%,#0f2d50 100%)', color: 'white', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em', opacity: 0.55, textTransform: 'uppercase', marginBottom: 2 }}>ELITE CAPITAL GROUP — EMS</div>
          <h1 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800 }}>
            {greeting()}, {employe?.prenom || user?.prenom || 'Utilisateur'} 👋
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '0.74rem', opacity: 0.65 }}>Enterprise Management System — votre portail personnalisé</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link to="/dashboard" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: 7, fontWeight: 600, fontSize: '0.74rem', border: '1px solid rgba(255,255,255,0.18)' }}>
            <BarChart2 size={12} /> Dashboard
          </Link>
          <button onClick={logout} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(206,43,43,0.28)', color: 'white', borderRadius: 7, fontWeight: 600, fontSize: '0.74rem', border: '1px solid rgba(206,43,43,0.35)', cursor: 'pointer' }}>
            <LogOut size={12} /> Déconnexion
          </button>
        </div>
      </div>

      <div className="container">

        {/* ── Account info ── */}
        <div style={{ background: 'white', borderRadius: 9, border: '1px solid #e2e8f0', overflow: 'hidden', margin: '14px 0' }}>
          <div style={{ background: '#021630', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="user" size={10} stroke={2.5} />
            <span style={{ color: 'white', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mon Compte</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, background: '#e4e9f0' }}>
            {infoCards.map(item => (
              <div key={item.key} style={{ background: 'white', padding: '7px 10px', borderTop: `2px solid ${item.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                  <Icon name={item.icon} size={9} />
                  <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                </div>
                <p style={{ margin: 0, color: '#021630', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main 2-col layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 14, alignItems: 'start' }}>

          {/* ════ LEFT COLUMN ════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Profile / demande congé */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 14px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar name={`${employe?.prenom || user?.prenom || ''} ${employe?.nom || user?.nom || ''}`} bg="#021630" size={44} />
                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: '#10b981', border: '2px solid white' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#021630', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {employe?.prenom || user?.prenom || '—'} {employe?.nom || user?.nom || ''}
                    </div>
                    <Link to="/profile" style={{ fontSize: '0.66rem', color: '#ce2b2b', fontWeight: 600, textDecoration: 'none', display: 'block', marginTop: 2 }}>
                      Voir mon profil →
                    </Link>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
                  <span style={{ background: '#f0f4fa', color: '#021630', borderRadius: 4, padding: '2px 7px', fontSize: '0.65rem', fontWeight: 600 }}>{entiteAff}</span>
                  <span style={{ background: '#f8f9fb', color: '#64748b', borderRadius: 4, padding: '2px 7px', fontSize: '0.65rem', fontWeight: 500 }}>#{user?.matricule}</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{employe?.fonction || employe?.poste || 'Employé'}</div>
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
                <Link to="/leaves" style={{ display: 'block', width: '100%', padding: '8px', background: '#ce2b2b', color: 'white', borderRadius: 7, fontWeight: 700, fontSize: '0.76rem', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                  📋 Demander un congé / permission
                </Link>
              </div>
            </div>

            {/* Disponibilités aujourd'hui */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 700, color: '#021630', fontSize: '0.76rem' }}>Disponibilités aujourd'hui</span>
                <Filter size={11} color="#94a3b8" />
              </div>
              <div style={{ padding: '4px 0' }}>
                {Object.entries(availGroups).filter(([, v]) => v.people.length > 0).length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.71rem' }}>
                    <span style={{ display: 'block', fontSize: '1.3rem', marginBottom: 4 }}>✅</span>
                    Tout le monde est disponible
                  </div>
                ) : (
                  Object.entries(availGroups).map(([label, grp]) =>
                    grp.people.length === 0 ? null : (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: '0.88rem' }}>{grp.icon}</span>
                          <span style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>{label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontWeight: 700, color: grp.color, fontSize: '0.76rem' }}>{grp.people.length}</span>
                          <StackedAvatars people={grp.people} max={3} />
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

          </div>
          {/* ════ END LEFT ════ */}

          {/* ════ RIGHT COLUMN — Espace Équipe ════ */}
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ background: '#ce2b2b', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <MessageSquare size={13} color="white" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Espace Équipe</span>
              <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: 20, padding: '1px 8px', fontSize: '0.64rem', fontWeight: 700 }}>
                {shoutouts.length + kudos.length + polls.length} publications
              </span>
            </div>

            {/* ── Birthdays scroll ── */}
            {birthdays.length > 0 && (
              <div style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: '0.88rem' }}>🎂</span>
                  <span style={{ fontWeight: 700, color: '#021630', fontSize: '0.72rem' }}>Anniversaires — 30 prochains jours</span>
                  <span style={{ marginLeft: 'auto', background: '#fef2f2', color: '#ce2b2b', borderRadius: 20, padding: '1px 7px', fontSize: '0.62rem', fontWeight: 700 }}>{birthdays.length}</span>
                </div>
                <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
                  <div style={{ display: 'flex', gap: 7, minWidth: 'max-content' }}>
                    {birthdays.map(e => (
                      <div key={e.matricule} style={{ background: e._isToday ? '#fef2f2' : '#f8f9fb', border: `1.5px solid ${e._isToday ? '#ce2b2b' : '#e2e8f0'}`, borderRadius: 8, padding: '7px 10px', textAlign: 'center', minWidth: 82, flexShrink: 0 }}>
                        <Avatar name={`${e.prenom} ${e.nom}`} bg={e._isToday ? '#ce2b2b' : '#021630'} size={26} />
                        <div style={{ fontWeight: 700, color: '#021630', fontSize: '0.64rem', marginTop: 4, lineHeight: 1.2 }}>{e.prenom}</div>
                        <div style={{ fontSize: '0.58rem', color: e._isToday ? '#ce2b2b' : '#64748b', fontWeight: 600, marginTop: 2 }}>{e._isToday ? '🎉 Auj.!' : `J−${e._diff}`}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPOSE (top form) ── */}
            <div style={{ padding: '12px 14px', borderBottom: '2px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Avatar name={myName} bg="#ce2b2b" size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#021630', fontSize: '0.72rem' }}>{myName}</div>
                  <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    Pour : <AudiencePicker value={audience} onChange={setAudience} employees={allEmployees} />
                  </div>
                </div>
              </div>

              {/* Type selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: composeType ? 10 : 0 }}>
                {[{ k: 'shoutout', l: '🎉 Félicitation' }, { k: 'kudos', l: '⭐ Kudos' }, { k: 'poll', l: '📊 Sondage' }].map(t => (
                  <button key={t.k} type="button" onClick={() => setComposeType(composeType === t.k ? null : t.k)}
                    style={{ flex: 1, padding: '6px 4px', background: composeType === t.k ? '#021630' : '#f8fafc', color: composeType === t.k ? 'white' : '#475569', border: `1px solid ${composeType === t.k ? '#021630' : '#e2e8f0'}`, borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.68rem', transition: 'all .12s' }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {composeType === 'shoutout' && (
                <form onSubmit={submitShoutout} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <input style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 10px', fontSize: '0.77rem', outline: 'none' }} placeholder="👤 Qui félicitez-vous ?" value={shoutoutForm.destinataire} onChange={e => setShoutoutForm({ ...shoutoutForm, destinataire: e.target.value })} required autoFocus />
                  <textarea style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 10px', fontSize: '0.77rem', resize: 'vertical', minHeight: 64, outline: 'none' }} placeholder="Votre message de félicitations..." value={shoutoutForm.message} onChange={e => setShoutoutForm({ ...shoutoutForm, message: e.target.value })} required />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setComposeType(null)} style={{ padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.74rem' }}>Annuler</button>
                    <button type="submit" style={{ padding: '6px 14px', background: '#021630', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>Publier</button>
                  </div>
                </form>
              )}
              {composeType === 'kudos' && (
                <form onSubmit={submitKudos} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <input style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 10px', fontSize: '0.77rem', outline: 'none' }} placeholder="⭐ Pour qui ?" value={kudosForm.destinataire} onChange={e => setKudosForm({ ...kudosForm, destinataire: e.target.value })} required autoFocus />
                  <select style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 10px', fontSize: '0.77rem', background: 'white' }} value={kudosForm.valeur} onChange={e => setKudosForm({ ...kudosForm, valeur: e.target.value })}>
                    {['Excellence', 'Innovation', 'Collaboration', 'Créativité', 'Leadership', 'Entraide', 'Performance'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <textarea style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 10px', fontSize: '0.77rem', resize: 'vertical', minHeight: 48, outline: 'none' }} placeholder="Pourquoi ? (optionnel)" value={kudosForm.raison} onChange={e => setKudosForm({ ...kudosForm, raison: e.target.value })} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setComposeType(null)} style={{ padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.74rem' }}>Annuler</button>
                    <button type="submit" style={{ padding: '6px 14px', background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>Envoyer ⭐</button>
                  </div>
                </form>
              )}
              {composeType === 'poll' && (
                <form onSubmit={submitPoll} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <input style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 10px', fontSize: '0.77rem', outline: 'none' }} placeholder="📊 Question du sondage..." value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} required autoFocus />
                  {pollForm.options.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 5 }}>
                      <input style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 10px', fontSize: '0.77rem', outline: 'none' }} placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const o = [...pollForm.options]; o[i] = e.target.value; setPollForm({ ...pollForm, options: o }) }} />
                      {i >= 2 && <button type="button" onClick={() => setPollForm({ ...pollForm, options: pollForm.options.filter((_, j) => j !== i) })} style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', color: '#ce2b2b' }}><X size={10} /></button>}
                    </div>
                  ))}
                  {pollForm.options.length < 5 && <button type="button" onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 7, padding: '5px', cursor: 'pointer', color: '#64748b', fontSize: '0.7rem' }}>+ Option</button>}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setComposeType(null)} style={{ padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', fontSize: '0.74rem' }}>Annuler</button>
                    <button type="submit" style={{ padding: '6px 14px', background: '#021630', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>Publier</button>
                  </div>
                </form>
              )}
            </div>

            {/* ── FEED (bottom) ── */}
            <div style={{ padding: '10px 14px' }}>

              {/* Feed filters */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 7, padding: 2, gap: 1 }}>
                  {[{ v: 'all', l: 'Tous' }, { v: 'shoutout', l: '🎉' }, { v: 'kudos', l: '⭐' }, { v: 'poll', l: '📊' }].map(f => (
                    <button key={f.v} onClick={() => setFilterType(f.v)} style={{ padding: '3px 9px', background: filterType === f.v ? 'white' : 'transparent', color: filterType === f.v ? '#021630' : '#64748b', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, boxShadow: filterType === f.v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                      {f.l}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: 100 }}>
                  <Search size={10} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Rechercher..." style={{ width: '100%', padding: '5px 22px 5px 22px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.7rem', boxSizing: 'border-box', outline: 'none' }} />
                  {filterSearch && <button onClick={() => setFilterSearch('')} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: '#94a3b8', display: 'flex' }}><X size={9} /></button>}
                </div>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.7rem', background: 'white', color: filterMonth ? '#021630' : '#94a3b8', cursor: 'pointer' }}>
                  <option value="">Mois</option>
                  {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {allEntites.length > 0 && (
                  <select value={filterEntite} onChange={e => setFilterEntite(e.target.value)} style={{ padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.7rem', background: 'white', color: filterEntite ? '#021630' : '#94a3b8', cursor: 'pointer', maxWidth: 110 }}>
                    <option value="">Entité</option>
                    {allEntites.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                )}
                {(filterSearch || filterMonth || filterEntite || filterType !== 'all') && (
                  <button onClick={() => { setFilterSearch(''); setFilterMonth(''); setFilterEntite(''); setFilterType('all') }} style={{ padding: '3px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#ce2b2b', fontSize: '0.68rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <X size={8} /> Reset
                  </button>
                )}
              </div>

              {/* Posts */}
              {feed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>💬</div>
                  <p style={{ margin: 0, fontSize: '0.78rem' }}>
                    {(filterSearch || filterMonth || filterEntite || filterType !== 'all') ? 'Aucun résultat pour ce filtre' : 'Le fil est vide. Soyez le premier à publier !'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {feed.map(item => {
                    const tc = item._type === 'kudos' ? '#ce2b2b' : item._type === 'poll' ? '#475569' : '#021630'
                    const tb = item._type === 'kudos' ? '#fef2f2' : item._type === 'poll' ? '#f1f5f9' : '#f0f4ff'
                    const tl = item._type === 'kudos' ? '⭐ Kudos' : item._type === 'poll' ? '📊 Sondage' : '🎉 Shoutout'
                    return (
                      <div key={`${item._type}-${item.id}`} style={{ background: 'white', border: '1px solid #e8ecf0', borderRadius: 9, overflow: 'hidden' }}>
                        <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={item.from || 'U'} bg="#021630" size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#021630', fontSize: '0.75rem' }}>{item.from}</div>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 1 }}>
                              {item.date}
                              {item.audience?.type !== 'all' && item.audience?.values?.length > 0 && (
                                <span style={{ color: '#021630', fontWeight: 600 }}>· {item.audience.values.join(', ')}</span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: tb, color: tc, border: `1px solid ${item._type === 'kudos' ? '#fecaca' : '#e2e8f0'}`, whiteSpace: 'nowrap' }}>
                            {tl}
                          </span>
                        </div>

                        {item._type === 'shoutout' && (
                          <div style={{ padding: '0 12px 9px' }}>
                            <p style={{ margin: '0 0 4px', fontSize: '0.76rem', color: '#334155' }}>Pour <span style={{ fontWeight: 700, color: '#ce2b2b' }}>@{item.destinataire}</span></p>
                            <p style={{ margin: 0, color: '#475569', fontSize: '0.76rem', lineHeight: 1.5 }}>{item.message}</p>
                          </div>
                        )}

                        {item._type === 'kudos' && (
                          <>
                            <div style={{ padding: '0 12px 7px' }}>
                              <p style={{ margin: 0, fontSize: '0.76rem', color: '#475569' }}>Kudos à <span style={{ fontWeight: 700, color: '#ce2b2b' }}>@{item.destinataire}</span></p>
                            </div>
                            <div style={{ margin: '0 12px 10px', borderRadius: 8, background: 'linear-gradient(135deg,#ce2b2b,#a01f1f)', padding: '14px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                              {[{ t: 10, l: 10, s: 11 }, { t: 20, l: 82, s: 8 }, { t: 62, l: 88, s: 14 }, { t: 72, l: 8, s: 10 }, { t: 40, l: 50, s: 7 }].map((d, i) => (
                                <div key={i} style={{ position: 'absolute', top: `${d.t}%`, left: `${d.l}%`, width: d.s, height: d.s, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', pointerEvents: 'none' }} />
                              ))}
                              <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'white', margin: '0 auto 7px' }}>
                                  {(item.destinataire || '?')[0].toUpperCase()}
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', letterSpacing: 3 }}>KUDOS!</div>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginTop: 2 }}>{item.valeur}</div>
                                {item.raison && <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.7)', marginTop: 3, fontStyle: 'italic' }}>"{item.raison}"</div>}
                              </div>
                            </div>
                          </>
                        )}

                        {item._type === 'poll' && (() => {
                          const total    = item.options.reduce((s, o) => s + o.votes, 0)
                          const hasVoted = item.votedBy?.includes(String(user?.matricule))
                          return (
                            <div style={{ padding: '0 12px 9px' }}>
                              <p style={{ margin: '0 0 7px', fontWeight: 700, color: '#021630', fontSize: '0.78rem' }}>{item.question}</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {item.options.map((opt, i) => {
                                  const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0
                                  return (
                                    <div key={i} style={{ cursor: hasVoted ? 'default' : 'pointer' }} onClick={() => !hasVoted && votePoll(item.id, i)}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 2 }}>
                                        <span style={{ color: '#334155' }}>{opt.texte}</span>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>{pct}%</span>
                                      </div>
                                      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: '#021630', borderRadius: 3, transition: 'width 0.3s' }} />
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 5 }}>
                                {total} vote{total !== 1 ? 's' : ''}
                                {!hasVoted && <span style={{ color: '#ce2b2b', marginLeft: 5 }}>· Cliquer pour voter</span>}
                                {hasVoted && <span style={{ color: '#021630', fontWeight: 600, marginLeft: 5 }}>· Voté ✓</span>}
                              </div>
                            </div>
                          )
                        })()}

                        <div style={{ borderTop: '1px solid #f5f7fa', padding: '4px 12px', display: 'flex', gap: 4 }}>
                          <button onClick={() => likePost(item._type, item.id)} style={{ flex: 1, background: 'none', border: 'none', borderRadius: 6, padding: '4px', cursor: 'pointer', color: '#64748b', fontSize: '0.68rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <ThumbsUp size={10} /> {item.likes > 0 ? `${item.likes} ` : ''}React
                          </button>
                          <button style={{ flex: 1, background: 'none', border: 'none', borderRadius: 6, padding: '4px', cursor: 'pointer', color: '#64748b', fontSize: '0.68rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <MessageSquare size={10} /> Comment
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          {/* ════ END RIGHT ════ */}

        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.68rem', padding: '18px 0 14px' }}>
          <p style={{ margin: 0 }}>© 2026 ELITE CAPITAL Group S.A. — Tous droits réservés.</p>
          <p style={{ margin: '3px 0 0', opacity: 0.7 }}>Extranet sécurisé — ISO 27001 | RGPD Compliant</p>
        </div>

      </div>
    </div>
  )
}
"""

path = r"c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A\Documents\EMS\extranet\frontend\src\pages\Home.jsx"
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done:", len(content), "chars")
