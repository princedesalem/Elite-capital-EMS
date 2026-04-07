import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Users, RefreshCw, CheckCircle, Briefcase, Umbrella, FileText, Clock, User, Calendar, ChevronDown, ChevronUp, Send } from 'lucide-react'

const MANAGER_ROLES = ['RH', 'PCA', 'AG', 'ADMIN', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'DFC']

const TABS = [
  { id: 'missions',    label: 'Missions',    icon: Briefcase, match: (t) => /^mission/i.test(t.trim()) },
  { id: 'conges',      label: 'Congés',      icon: Umbrella,  match: (t) => /cong/i.test(t) },
  { id: 'permissions', label: 'Permissions', icon: FileText,  match: (t) => /perm/i.test(t) },
  { id: 'sorties',     label: 'Sorties',     icon: Clock,     match: (t) => /sortie/i.test(t) },
]

const th = { padding: '9px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: '#475569', background: '#f8fafc', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }
const td = { padding: '9px 12px', color: '#374151', verticalAlign: 'middle', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' }

function StatusBadge({ statut }) {
  const s = (statut || '').toLowerCase()
  const cfg = s.includes('valid') ? { bg: '#dcfce7', color: '#166534' }
    : s.includes('refus') ? { bg: '#fee2e2', color: '#991b1b' }
    : s.includes('attente') ? { bg: '#fef3c7', color: '#92400e' }
    : { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: '0.73rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {statut || '-'}
    </span>
  )
}

function TypeBadge({ type }) {
  return (
    <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: '0.73rem', fontWeight: 600, background: '#eff6ff', color: '#2563eb' }}>
      {type || '-'}
    </span>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }}>-</div>
      <p style={{ margin: 0, fontSize: '0.88rem' }}>{message}</p>
    </div>
  )
}

/* Mes demandes reçues (remplaçant proposé, action requise) */
function MesDemandesSection({ matricule, matchFn }) {
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState({})
  const [msg, setMsg] = useState({})

  const load = useCallback(() => {
    if (!matricule) return
    setLoading(true)
    api.get(`/api/remplacants/mes-demandes/${matricule}`)
      .then(r => setAll(r.data || []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false))
  }, [matricule])

  useEffect(() => { load() }, [load])

  const rows = all.filter(r => matchFn(r.type_demande || ''))

  if (loading || !rows.length) return null

  const handleAccepter = async (id_operation) => {
    const key = id_operation
    setAccepting(a => ({ ...a, [key]: true }))
    try {
      const r = await api.post(`/api/remplacants/${id_operation}/accepter/${matricule}`)
      setMsg(m => ({ ...m, [key]: r.data.message }))
      load()
    } catch (e) {
      setMsg(m => ({ ...m, [key]: e.response?.data?.detail || 'Erreur acceptation' }))
    } finally {
      setAccepting(a => ({ ...a, [key]: false }))
    }
  }

  return (
    <section style={{ background: '#fff', border: '1px solid #fbbf24', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', background: '#fffbeb', borderBottom: '1px solid #fbbf24' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#92400e' }}>
          Demandes de remplacement — action requise
        </h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#b45309' }}>
          Vous avez été désigné remplaçant pour les opérations ci-dessous. Acceptez pour confirmer.
        </p>
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Type</th>
                <th style={th}>Employé absent</th>
                <th style={th}>Du</th>
                <th style={th}>Au</th>
                <th style={th}>Statut opération</th>
                <th style={{ ...th, width: 110 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id_operation}>
                  <td style={td}><TypeBadge type={r.type_demande} /></td>
                  <td style={{ ...td, fontWeight: 500 }}>{r.employe_absent?.nom_complet || '-'}</td>
                  <td style={td}>{r.date_debut || '-'}</td>
                  <td style={td}>{r.date_fin || '-'}</td>
                  <td style={td}><StatusBadge statut={r.statut} /></td>
                  <td style={td}>
                    {msg[r.id_operation] ? (
                      <span style={{ fontSize: '0.78rem', color: '#16a34a' }}>{msg[r.id_operation]}</span>
                    ) : (
                      <button
                        onClick={() => handleAccepter(r.id_operation)}
                        disabled={accepting[r.id_operation]}
                        style={{ padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff', fontSize: '0.8rem', fontWeight: 600, opacity: accepting[r.id_operation] ? 0.6 : 1 }}
                      >
                        {accepting[r.id_operation] ? '...' : 'Accepter'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/* Mes remplacements (filtrés par type) */
function MesRemplacementsSection({ matricule, matchFn }) {
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!matricule) return
    api.get(`/api/remplacants/mes-remplacements/${matricule}`)
      .then(r => setAll(r.data || []))
      .catch(() => setErr('Impossible de charger vos remplacements'))
      .finally(() => setLoading(false))
  }, [matricule])

  const rows = all.filter(r => matchFn(r.type_demande || ''))

  if (loading) return <p style={{ color: '#64748b', fontSize: '0.88rem', padding: '12px 0' }}>Chargement...</p>
  if (err) return <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>{err}</p>
  if (!rows.length) return <EmptyState message="Aucun remplacement accepté pour vous dans cette catégorie." />

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Type</th>
            <th style={th}>Employé absent</th>
            <th style={th}>Du</th>
            <th style={th}>Au</th>
            <th style={th}>Statut opération</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id_operation}>
              <td style={td}><TypeBadge type={r.type_demande} /></td>
              <td style={{ ...td, fontWeight: 500 }}>{r.employe_absent?.nom_complet || '-'}</td>
              <td style={td}>{r.date_debut || '-'}</td>
              <td style={td}>{r.date_fin || '-'}</td>
              <td style={td}><StatusBadge statut={r.statut} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* Gérer les remplacements (filtré par type, managers only) */
function GererSection({ token, matchFn, user }) {
  const [operations, setOperations] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [propositions, setPropositions] = useState({})
  const [loadingProp, setLoadingProp] = useState({})
  const [generating, setGenerating] = useState({})
  const [accepting, setAccepting] = useState({})
  const [demanding, setDemanding] = useState({})
  const [msg, setMsg] = useState({})

  const isRH = String(user?.role || '').toUpperCase() === 'RH'
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const loadOps = useCallback(() => {
    setLoading(true)
    api.get('/api/remplacants/operations-disponibles', { headers: authHeaders })
      .then(r => setOperations(r.data || []))
      .catch(() => setErr('Impossible de charger les opérations'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { loadOps() }, [loadOps])

  const loadProps = async (id) => {
    setLoadingProp(p => ({ ...p, [id]: true }))
    try {
      const r = await api.get(`/api/remplacants/propositions/${id}`)
      setPropositions(p => ({ ...p, [id]: r.data || [] }))
    } catch {
      setMsg(m => ({ ...m, [id]: 'Erreur chargement propositions' }))
    } finally {
      setLoadingProp(p => ({ ...p, [id]: false }))
    }
  }

  const handleExpand = (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!propositions[id]) loadProps(id)
  }

  const handleGenerer = async (id) => {
    setGenerating(g => ({ ...g, [id]: true }))
    setMsg(m => ({ ...m, [id]: null }))
    try {
      const r = await api.post(`/api/remplacants/generer/${id}`)
      setMsg(m => ({ ...m, [id]: r.data.message }))
      await loadProps(id)
    } catch (e) {
      setMsg(m => ({ ...m, [id]: e.response?.data?.detail || 'Erreur génération' }))
    } finally {
      setGenerating(g => ({ ...g, [id]: false }))
    }
  }

  const handleAccepter = async (id, matricule) => {
    const key = `${id}-${matricule}`
    setAccepting(a => ({ ...a, [key]: true }))
    try {
      const r = await api.post(`/api/remplacants/${id}/accepter/${matricule}`)
      setMsg(m => ({ ...m, [id]: r.data.message }))
      await loadProps(id)
    } catch (e) {
      setMsg(m => ({ ...m, [id]: e.response?.data?.detail || 'Erreur acceptation' }))
    } finally {
      setAccepting(a => ({ ...a, [key]: false }))
    }
  }

  const handleDemander = async (id, matricule) => {
    const key = `${id}-${matricule}`
    setDemanding(d => ({ ...d, [key]: true }))
    try {
      const r = await api.post(`/api/remplacants/${id}/demander/${matricule}`)
      setMsg(m => ({ ...m, [id]: r.data.message }))
      await loadProps(id)
    } catch (e) {
      setMsg(m => ({ ...m, [id]: e.response?.data?.detail || 'Erreur envoi demande' }))
    } finally {
      setDemanding(d => ({ ...d, [key]: false }))
    }
  }

  const rows = operations.filter(op => matchFn(op.type_demande || ''))

  if (loading) return <p style={{ color: '#64748b', fontSize: '0.88rem', padding: '12px 0' }}>Chargement...</p>
  if (err) return <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>{err}</p>
  if (!rows.length) return <EmptyState message="Aucune opération disponible dans cette catégorie." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(op => {
        const isOpen = expanded === op.id_operation
        const props = propositions[op.id_operation] || []
        const opMsg = msg[op.id_operation]
        return (
          <div key={op.id_operation} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'box-shadow 0.15s' }}>
            <button
              onClick={() => handleExpand(op.id_operation)}
              style={{ width: '100%', padding: '13px 16px', cursor: 'pointer', background: isOpen ? '#f8faff' : '#fff', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', borderBottom: isOpen ? '1px solid #e2e8f0' : 'none', gap: 12 }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <span style={{ flexShrink: 0, minWidth: 42, padding: '3px 8px', borderRadius: 6, background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.04em', textAlign: 'center' }}>
                  #{op.id_operation}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', flexShrink: 0 }}>
                  <User size={13} style={{ color: '#64748b' }} />
                  {op.nom_employe}
                </span>
                <TypeBadge type={op.type_demande} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#475569', flexShrink: 0 }}>
                  <Calendar size={12} style={{ color: '#94a3b8' }} />
                  {op.date_debut} → {op.date_fin}
                </span>
                <StatusBadge statut={op.statut} />
              </div>
              <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, background: isOpen ? '#dbeafe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                {isOpen
                  ? <ChevronUp size={15} style={{ color: '#2563eb' }} />
                  : <ChevronDown size={15} style={{ color: '#64748b' }} />}
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: '14px 16px', background: '#fafafa' }}>
                {opMsg && (
                  <div style={{ marginBottom: 12, padding: '7px 12px', borderRadius: 6, fontSize: '0.84rem', background: (opMsg || '').toLowerCase().includes('erreur') ? '#fee2e2' : '#dcfce7', color: (opMsg || '').toLowerCase().includes('erreur') ? '#991b1b' : '#166534' }}>
                    {opMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button
                    onClick={() => handleGenerer(op.id_operation)}
                    disabled={generating[op.id_operation]}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#021630', color: '#fff', fontSize: '0.83rem', fontWeight: 600, opacity: generating[op.id_operation] ? 0.6 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                  >
                    <Send size={13} />
                    {generating[op.id_operation] ? 'Génération…' : 'Générer des remplaçants'}
                  </button>
                  <button
                    onClick={() => loadProps(op.id_operation)}
                    disabled={loadingProp[op.id_operation]}
                    title="Actualiser"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 7, border: '1px solid #e2e8f0', cursor: 'pointer', background: '#fff', color: '#475569', fontSize: '0.8rem', fontWeight: 500 }}
                  >
                    <RefreshCw size={13} />
                    Actualiser
                  </button>
                </div>

                {loadingProp[op.id_operation] ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Chargement...</p>
                ) : props.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Aucun remplaçant proposé. Cliquez sur "Générer des remplaçants" pour en obtenir.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 40 }}>#</th>
                        <th style={th}>Remplaçant proposé</th>
                        <th style={th}>Fonction</th>
                        <th style={th}>Statut</th>
                        <th style={{ ...th, width: 120 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.map(p => {
                        const acceptKey = `${op.id_operation}-${p.matricule}`
                        const isSelf = p.matricule === user?.matricule
                        return (
                          <tr key={p.id_remplacant_propose}>
                            <td style={{ ...td, color: '#94a3b8', fontWeight: 600 }}>{p.ordre_proposition}</td>
                            <td style={{ ...td, fontWeight: 500 }}>{p.nom_complet}</td>
                            <td style={{ ...td, color: '#64748b' }}>{p.fonction || '-'}</td>
                            <td style={td}>
                              {p.est_accepte
                                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '0.75rem' }}><CheckCircle size={11} /> Accepté</span>
                                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.75rem' }}><Clock size={11} /> En attente</span>}
                            </td>
                            <td style={td}>
                              {p.est_accepte ? null : isSelf ? (
                                <button
                                  onClick={() => handleAccepter(op.id_operation, p.matricule)}
                                  disabled={accepting[acceptKey]}
                                  style={{ padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff', fontSize: '0.8rem', fontWeight: 600, opacity: accepting[acceptKey] ? 0.6 : 1 }}
                                >
                                  {accepting[acceptKey] ? '...' : 'Accepter'}
                                </button>
                              ) : isRH ? (
                                p.demande_envoyee ? (
                                  <span style={{ padding: '4px 10px', borderRadius: 5, background: '#f1f5f9', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>
                                    Demandé ✓
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleDemander(op.id_operation, p.matricule)}
                                    disabled={demanding[acceptKey]}
                                    style={{ padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff', fontSize: '0.8rem', fontWeight: 600, opacity: demanding[acceptKey] ? 0.6 : 1 }}
                                  >
                                    {demanding[acceptKey] ? '...' : 'Demander'}
                                  </button>
                                )
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* Page principale */
export default function RemplacantsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('missions')
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || ''
  const isManager = user?.role && MANAGER_ROLES.includes(String(user.role).toUpperCase())

  const currentTab = TABS.find(t => t.id === activeTab) || TABS[0]

  return (
    <div style={{ padding: 20, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Remplaçants</h1>
          <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748b' }}>Remplaçants proposés à partir des subordonnés directs</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: isActive ? 700 : 500, fontSize: '0.88rem',
                color: isActive ? '#021630' : '#64748b',
                borderBottom: isActive ? '2.5px solid #021630' : '2.5px solid transparent',
                marginBottom: '-2px', borderRadius: '4px 4px 0 0',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <MesDemandesSection matricule={user?.matricule} matchFn={currentTab.match} />

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>Mes remplacements — {currentTab.label}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Opérations pour lesquelles vous avez été désigné remplaçant</p>
          </div>
          <div style={{ padding: '14px 18px' }}>
            <MesRemplacementsSection matricule={user?.matricule} matchFn={currentTab.match} />
          </div>
        </section>

        {isManager && (
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>Gérer les remplacements — {currentTab.label}</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Générez et validez les remplaçants pour les opérations en cours</p>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <GererSection token={token} matchFn={currentTab.match} user={user} />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}