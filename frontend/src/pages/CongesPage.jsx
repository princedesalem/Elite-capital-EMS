import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }
const today = new Date().toISOString().split('T')[0]
const fieldLabel = { fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }
const fmtDate = value => value ? new Date(value).toLocaleDateString('fr-FR') : '-'
const durationDays = (start, end) => (start && end) ? `${Math.round((new Date(end) - new Date(start)) / 86400000) + 1} j` : '-'
const isValidated = value => ['valide', 'validé'].includes((value || '').toLowerCase())
const statusColor = (value) => ({
  'en attente': '#f59e0b',
  'en cours': '#3b82f6',
  'validé': '#10b981',
  'valide': '#10b981',
  'refusé': '#ef4444',
  'annulé': '#6b7280',
}[String(value || '').toLowerCase()] || '#64748b')
const renderStatusBadge = (value) => {
  const label = value || 'en attente'
  const color = statusColor(label)
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color, background: `${color}22` }}>{label}</span>
}
const getEmitterName = (item, isRecu, senderName) => {
  if (!isRecu) return senderName
  const full = [item?.demandeur?.prenom, item?.demandeur?.nom].filter(Boolean).join(' ').trim()
  return full || item?.demandeur?.nom_complet || item?.demandeur_nom || item?.demandeur?.nom || 'Inconnu'
}

function Tabs({ active, setActive, counts }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
      {[['envoye', 'Envoye', counts.envoye], ['recu', 'Recu', counts.recu]].map(([key, label, count]) => (
        <button key={key} onClick={() => setActive(key)} style={{ flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', background: active === key ? '#fff' : '#f9fafb', fontWeight: active === key ? 700 : 500, fontSize: '0.82rem', borderBottom: active === key ? '2px solid #ce2b2b' : '2px solid transparent', color: active === key ? '#ce2b2b' : '#6b7280' }}>
          {label}
          {count > 0 && <span style={{ marginLeft: 5, padding: '1px 6px', borderRadius: 999, fontSize: '0.68rem', background: active === key ? '#ce2b2b' : '#e5e7eb', color: active === key ? '#fff' : '#374151' }}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

function FilterBar({ date, setDate, statut, setStatut, source, setSource, emetteur, setEmetteur, etat, setEtat }) {
  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="month" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={statut} onChange={e => setStatut(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 110 }}>
        <option value="">Tous statuts</option>
        {['en attente', 'en cours', 'validé', 'refusé', 'annulé'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="Source" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }} />
      <input type="text" value={emetteur} onChange={e => setEmetteur(e.target.value)} placeholder="Emetteur" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={etat} onChange={e => setEtat(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }}>
        <option value="">Tous etats</option>
        {['--', 'Active', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>Reinitialiser</button>}
    </div>
  )
}

export default function CongesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('envoye')
  const [items, setItems] = useState([])
  const [aValider, setAValider] = useState([])
  const [rowEtat, setRowEtat] = useState({})
  const [soldeConges, setSoldeConges] = useState(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterEmetteur, setFilterEmetteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [loading, setLoading] = useState(true)
  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])
  const [showNewForm, setShowNewForm] = useState(false)
  const [congeForm, setCongeForm] = useState({ date_debut: '', date_fin: '', motif: '' })
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!user?.matricule) { setLoading(false); return }
    Promise.all([
      api.get(`/api/conges/historique/${user.matricule}`).catch(() => ({ data: [] })),
      api.get(`/api/workflow/a-valider/${user.matricule}`).catch(() => ({ data: [] })),
      api.get(`/api/conges/solde/${user.matricule}`).catch(() => ({ data: {} }))
    ]).then(([r1, r2, r3]) => {
      const sent = Array.isArray(r1.data) ? r1.data : []
      const recv = (Array.isArray(r2.data) ? r2.data : []).filter(d => d.type_demande === 'Congé')
      setItems(sent)
      setAValider(recv)
      setSoldeConges(Number(r3?.data?.solde_conges ?? 0))
      setLoading(false)
    })
  }, [user?.matricule])

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = (item.statut || item.status || '').toLowerCase()
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Conge').toLowerCase()
    const emetteurValue = getEmitterName(item, activeTab === 'recu', senderName).toLowerCase()
    const etatValue = (rowEtat[item.id_operation] || '--').toLowerCase()
    return (!filterDate || String(dateValue).startsWith(filterDate))
      && (!filterStatut || statusValue === filterStatut)
      && (!filterSource || sourceValue.includes(filterSource.toLowerCase()))
      && (!filterEmetteur || emetteurValue.includes(filterEmetteur.toLowerCase()))
      && (!filterEtat || etatValue === filterEtat.toLowerCase())
  })

  const envoye = useMemo(() => applyFilters(items), [items, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])
  const recu = useMemo(() => applyFilters(aValider), [aValider, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])

  const calcDureeJours = (debut, fin) => (debut && fin) ? Math.ceil((new Date(fin) - new Date(debut)) / 86400000) + 1 : 0

  const handleCreateConge = async (e) => {
    e.preventDefault()
    setMsg(null)
    try {
      const res = await api.post('/api/conges/demande', null, {
        params: {
          matricule: user.matricule,
          matricule_createur: user.matricule,
          date_debut: congeForm.date_debut,
          date_fin: congeForm.date_fin,
          motif: congeForm.motif || null
        }
      })
      setItems(prev => [res.data, ...prev])
      setCongeForm({ date_debut: '', date_fin: '', motif: '' })
      setShowNewForm(false)
      setMsg({ type: 'success', text: 'Demande de congé soumise avec succès.' })
      setTimeout(() => setMsg(null), 5000)
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de la création de la demande.' })
    }
  }

  const handleAnnuler = async (id) => {
    if (!confirm('Annuler cette demande ?')) return
    try {
      await api.put(`/api/conges/${id}`, { statut: 'annulé' })
      setItems(prev => prev.map(item => item.id_operation === id ? { ...item, statut: 'annulé' } : item))
    } catch (err) {
      alert('Erreur: ' + err.message)
    }
  }

  const handleWorkflow = async (id, statut) => {
    let commentaire = null
    if (statut === 'refusé') {
      commentaire = window.prompt('Motif du refus (obligatoire):')
      if (!commentaire?.trim()) return
    }
    try {
      await api.post(`/api/workflow/valider/${id}`, null, { params: { matricule_validateur: user.matricule, statut, ...(commentaire ? { commentaire } : {}) } })
      setAValider(prev => prev.filter(item => item.id_operation !== id))
    } catch (err) {
      alert('Erreur: ' + (err?.response?.data?.detail || err.message))
    }
  }

  const handleActiver = async (id) => {
    try {
      const response = await api.post(`/api/conges/activation/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      setRowEtat(prev => ({ ...prev, [id]: 'Active' }))
      if (response?.data?.message) alert(response.data.message)
    } catch (err) {
      alert('Erreur activation: ' + (err?.response?.data?.detail || err.message))
    }
  }

  const handleCloturer = async (id) => {
    try {
      const response = await api.post(`/api/conges/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      setRowEtat(prev => ({ ...prev, [id]: 'Cloturee' }))
      if (response?.data?.message) alert(response.data.message)
    } catch (err) {
      alert('Erreur cloture: ' + (err?.response?.data?.detail || err.message))
    }
  }

  const renderActionButtons = (item, isRecu) => {
    if (isRecu) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => handleWorkflow(item.id_operation, 'validé')} style={okBtn}>Approuver</button>
          <button onClick={() => handleWorkflow(item.id_operation, 'refusé')} style={dangerBtn}>Refuser</button>
        </div>
      )
    }

    const etat = rowEtat[item.id_operation] || '--'
    const validated = isValidated(item.statut || item.status)
    const canCloture = etat === 'Active'

    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => navigate(`/rh/conges/edit/${item.id_operation}`)} style={primaryBtn}>Modifier</button>
        <button onClick={() => handleAnnuler(item.id_operation)} style={dangerBtn}>Annuler</button>
        {canCloture ? (
          <button onClick={() => handleCloturer(item.id_operation)} style={warnBtn}>Cloturer</button>
        ) : (
          <button onClick={() => handleActiver(item.id_operation)} disabled={!validated} style={{ ...okBtn, opacity: validated ? 1 : 0.45, cursor: validated ? 'pointer' : 'not-allowed' }}>Activer</button>
        )}
      </div>
    )
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_operation}>
        <td style={{ ...td, fontWeight: 600 }}>{item.motif || `Conge #${item.id_operation}`}</td>
        <td style={td}>{isRecu ? 'Approbations' : 'Conge'}</td>
        <td style={td}>{renderStatusBadge(item.statut || item.status || 'en attente')}</td>
        <td style={td}>{fmtDate(item.date_creation || item.created_at || item.date_debut)}</td>
        <td style={td}>{getEmitterName(item, isRecu, senderName)}</td>
        <td style={td}>{fmtDate(item.date_debut)}</td>
        <td style={td}>{fmtDate(item.date_fin)}</td>
        <td style={td}>{durationDays(item.date_debut, item.date_fin)}</td>
        <td style={td}>{rowEtat[item.id_operation] || '--'}</td>
        <td style={td}>{renderActionButtons(item, isRecu)}</td>
      </tr>
    ))
  }

  if (loading) return <div style={{ padding: 28 }}>Chargement...</div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>Gestion des Conges</h1>
        <button onClick={() => { setShowNewForm(prev => !prev); setMsg(null) }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
      </div>

      {msg && <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, background: msg.type === 'success' ? '#dcfce7' : '#fee2e2', color: msg.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}`, fontSize: '0.85rem' }}>{msg.text}</div>}

      {showNewForm && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15,23,42,0.07)', padding: '24px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: 4, height: 20, background: '#ce2b2b', borderRadius: 2, marginRight: 10, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '0.97rem', color: '#0f172a' }}>Nouvelle demande de congé</span>
          </div>
          <form onSubmit={handleCreateConge} style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div>
              <label style={fieldLabel}>Date de début</label>
              <input type="date" value={congeForm.date_debut} min={today} onChange={e => setCongeForm(f => ({ ...f, date_debut: e.target.value }))} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: '#1e293b' }} required />
            </div>
            <div>
              <label style={fieldLabel}>Date de fin</label>
              <input type="date" value={congeForm.date_fin} min={congeForm.date_debut || today} onChange={e => setCongeForm(f => ({ ...f, date_fin: e.target.value }))} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: '#1e293b' }} required />
            </div>
            <div>
              <label style={{ ...fieldLabel, color: '#64748b' }}>Durée (jours)</label>
              <div style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', fontWeight: 700, color: '#0f766e', minHeight: 38, display: 'flex', alignItems: 'center' }}>
                {calcDureeJours(congeForm.date_debut, congeForm.date_fin) > 0 ? `${calcDureeJours(congeForm.date_debut, congeForm.date_fin)} jour(s)` : '--'}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={fieldLabel}>Motif <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.76rem' }}>(optionnel)</span></label>
              <textarea value={congeForm.motif} onChange={e => setCongeForm(f => ({ ...f, motif: e.target.value }))} placeholder="Précisez le motif de votre demande..." rows={2} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: '#1e293b', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
              <button type="button" onClick={() => { setShowNewForm(false); setCongeForm({ date_debut: '', date_fin: '', motif: '' }) }} style={{ padding: '9px 18px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button type="submit" style={{ padding: '9px 22px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Soumettre la demande</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: 10, background: 'linear-gradient(90deg, #dbeafe, #f0fdf4)', border: '1px solid #dbeafe', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 700 }}>Solde de conge</div>
        <div style={{ fontSize: '2rem', lineHeight: 1.05, fontWeight: 900, color: '#0f172a' }}>{Number(soldeConges || 0).toLocaleString('fr-FR')} jours</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs active={activeTab} setActive={tab => { setActiveTab(tab); setFilterDate(''); setFilterStatut(''); setFilterSource(''); setFilterEmetteur(''); setFilterEtat('') }} counts={{ envoye: items.length, recu: aValider.length }} />
        <FilterBar date={filterDate} setDate={setFilterDate} statut={filterStatut} setStatut={setFilterStatut} source={filterSource} setSource={setFilterSource} emetteur={filterEmetteur} setEmetteur={setFilterEmetteur} etat={filterEtat} setEtat={setFilterEtat} />
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '16%' }}>Titre de demande</th>
              <th style={{ ...th, width: '9%' }}>Source</th>
              <th style={{ ...th, width: '9%' }}>Statut</th>
              <th style={{ ...th, width: '9%' }}>Date creation</th>
              <th style={{ ...th, width: '10%' }}>Envoye par</th>
              <th style={{ ...th, width: '8%' }}>Date depart</th>
              <th style={{ ...th, width: '8%' }}>Date retour</th>
              <th style={{ ...th, width: '5%' }}>Duree</th>
              <th style={{ ...th, width: '5%' }}>Etat</th>
              <th style={{ ...th, width: '21%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>{activeTab === 'envoye' ? renderRows(envoye, false) : renderRows(recu, true)}</tbody>
        </table>
      </div>
    </div>
  )
}
