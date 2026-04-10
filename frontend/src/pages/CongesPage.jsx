import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import WorkflowModal from '../components/WorkflowModal'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import ModifiedBadge from '../components/ModifiedBadge'
import { Eye } from 'lucide-react'

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
const calcWorkingDays = (start, end) => {
  if (!start || !end) return 0
  const current = new Date(start)
  const limit = new Date(end)
  if (Number.isNaN(current.getTime()) || Number.isNaN(limit.getTime()) || current > limit) return 0

  let days = 0
  while (current <= limit) {
    const weekday = current.getDay()
    if (weekday !== 0 && weekday !== 6) days += 1
    current.setDate(current.getDate() + 1)
  }
  return days
}
const durationDays = (item) => {
  const fromApi = Number(item?.duree_jours)
  if (Number.isFinite(fromApi) && fromApi > 0) return `${fromApi} j`
  const computed = calcWorkingDays(item?.date_debut, item?.date_fin)
  return computed > 0 ? `${computed} j` : '-'
}
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
const normalizeText = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const normalizeListStatus = (value) => {
  const normalized = normalizeText(value)
  if (normalized.includes('refus')) return 'refusé'
  if (normalized.includes('valid')) return 'validé'
  return 'en attente'
}
const normalizeCongesWorkflow = (rows, label, bucket) => (Array.isArray(rows) ? rows : [])
  .filter((item) => normalizeText(item?.type_demande) === 'conge')
  .map((item) => ({ ...item, __workflow_label: label, __workflow_bucket: bucket }))
const getEmitterName = (item, isRecu, senderName) => {
  if (!isRecu) return senderName
  const full = [item?.demandeur?.prenom, item?.demandeur?.nom].filter(Boolean).join(' ').trim()
  return full || item?.demandeur?.nom_complet || item?.demandeur_nom || item?.demandeur?.nom || 'Inconnu'
}

const initRowEtatFromApi = (items) => {
  const map = {}
  items.forEach(item => {
    const id = item.id_operation
    if (!id) return
    if (item.cloture_complete) map[id] = 'Cloturee'
    else if (item.cloture_demandeur_fait) map[id] = 'ClotureDemandee'
    else if (item.activation_complete) map[id] = 'Active'
    else if (item.activation_demandeur_fait && !item.activation_rh_fait) map[id] = 'AttenteRH'
    else map[id] = '--'
  })
  return map
}

const fmtDateTime = (value) => value ? new Date(value).toLocaleString('fr-FR') : '?'

function Tabs({ active, setActive, counts }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
      {[['envoye', 'Envoyé', counts.envoye], ['recu', 'Reçu', counts.recu]].map(([key, label, count]) => (
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
        {['en attente', 'validé', 'refusé'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="Source" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }} />
      <input type="text" value={emetteur} onChange={e => setEmetteur(e.target.value)} placeholder="Émetteur" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={etat} onChange={e => setEtat(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }}>
        <option value="">Tous états</option>
        {['--', 'AttenteRH', 'Active', 'ClotureDemandee', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>Réinitialiser</button>}
    </div>
  )
}

export default function CongesPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('envoye')
  const [items, setItems] = useState([])
  const [workflowEnvoye, setWorkflowEnvoye] = useState([])
  const [workflowAValider, setWorkflowAValider] = useState([])
  const [workflowValide, setWorkflowValide] = useState([])
  const [workflowRefuse, setWorkflowRefuse] = useState([])
  const [workflowPcaAg, setWorkflowPcaAg] = useState([])
  const [rowEtat, setRowEtat] = useState({})
    const [loadingOp, setLoadingOp] = useState(null)
  const [soldeConges, setSoldeConges] = useState(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterEmetteur, setFilterEmetteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [loading, setLoading] = useState(true)
  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const estRh = useMemo(() => ['RH', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])
  const [showNewForm, setShowNewForm] = useState(false)
  const [congeForm, setCongeForm] = useState({ date_debut: '', date_fin: '', motif: '' })
  const [congeEditMode, setCongeEditMode] = useState(false)
  const [congeEditId, setCongeEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [selectedOperationForWorkflow, setSelectedOperationForWorkflow] = useState(null)
  const [detailCongeItem, setDetailCongeItem] = useState(null)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const opId = searchParams.get('operationId')
    if (opId) setSelectedOperationForWorkflow(Number(opId))
    const tab = searchParams.get('tab')
    if (tab === 'recu' || tab === 'envoye') setActiveTab(tab)
  }, [])

  async function loadData() {
    if (!user?.matricule) { setLoading(false); return }
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get(`/api/conges/historique/${user.matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/boite/${user.matricule}`).catch(() => ({ data: {} })),
        api.get(`/api/conges/solde/${user.matricule}`).catch(() => ({ data: {} }))
      ])
      const history = Array.isArray(r1.data) ? r1.data : []
      const boite = r2?.data || {}
      setItems(history)
      const envoyeNorm = normalizeCongesWorkflow(boite.envoye, 'Envoyée', 'envoye')
      const aValiderNorm = normalizeCongesWorkflow(boite.recu, 'À valider', 'recu')
      const valideNorm = normalizeCongesWorkflow(boite.valide, 'Validée par moi', 'valide')
      const refuseNorm = normalizeCongesWorkflow(boite.refuse, 'Refusée par moi', 'refuse')
      const pcaAgRaw = (boite.recu_pca_ag || []).filter(o => (o.type_demande || '').toLowerCase().includes('cong'))
      const pcaAgNorm = normalizeCongesWorkflow(pcaAgRaw, 'PCA/AG', 'recu_pca_ag')
      setWorkflowEnvoye(envoyeNorm)
      setWorkflowAValider(aValiderNorm)
      setWorkflowValide(valideNorm)
      setWorkflowRefuse(refuseNorm)
      setWorkflowPcaAg(pcaAgNorm)
      setRowEtat(initRowEtatFromApi([...envoyeNorm, ...aValiderNorm, ...valideNorm, ...refuseNorm, ...pcaAgNorm]))
      setSoldeConges(Number(r3?.data?.solde_conges ?? 0))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user?.matricule])

  // Actualisation automatique toutes les 30 secondes
  useAutoRefresh(loadData)

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_demande || item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = normalizeText(normalizeListStatus(item.statut || item.status || 'en attente'))
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Conge').toLowerCase()
    const emetteurValue = getEmitterName(item, activeTab === 'recu', senderName).toLowerCase()
    const etatValue = (rowEtat[item.id_operation] || '--').toLowerCase()
    return (!filterDate || String(dateValue).startsWith(filterDate))
      && (!filterStatut || statusValue === normalizeText(filterStatut))
      && (!filterSource || sourceValue.includes(filterSource.toLowerCase()))
      && (!filterEmetteur || emetteurValue.includes(filterEmetteur.toLowerCase()))
      && (!filterEtat || etatValue === filterEtat.toLowerCase())
  })

  const envoye = useMemo(() => applyFilters(workflowEnvoye), [workflowEnvoye, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])
  const recu = useMemo(() => {
    const combined = [...workflowAValider, ...workflowValide, ...workflowRefuse]
    const dedup = [...new Map(combined.map(item => [item.id_operation, item])).values()]
    return applyFilters(dedup)
  }, [workflowAValider, workflowValide, workflowRefuse, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])

  const calcDureeJours = (debut, fin) => calcWorkingDays(debut, fin)

  const resetCongeForm = () => {
    setCongeForm({ date_debut: '', date_fin: '', motif: '' })
    setCongeEditMode(false)
    setCongeEditId(null)
  }

  const handleEditConge = (item) => {
    setCongeForm({
      date_debut: item.date_debut ? String(item.date_debut).slice(0, 10) : '',
      date_fin: item.date_fin ? String(item.date_fin).slice(0, 10) : '',
      motif: item.motif || ''
    })
    setCongeEditMode(true)
    setCongeEditId(item.id_operation)
    setShowNewForm(true)
    setMsg(null)
  }

  const handleCreateConge = async (e) => {
    e.preventDefault()
    setMsg(null)
    try {
      if (congeEditMode && congeEditId) {
        await api.put(`/api/conges/${congeEditId}/modifier`, null, {
          params: {
            date_debut: congeForm.date_debut,
            date_fin: congeForm.date_fin,
            motif: congeForm.motif || null
          }
        })
      } else {
        await api.post('/api/conges/demande', null, {
          params: {
            matricule: user.matricule,
            matricule_createur: user.matricule,
            date_debut: congeForm.date_debut,
            date_fin: congeForm.date_fin,
            motif: congeForm.motif || null
          }
        })
      }
      resetCongeForm()
      setShowNewForm(false)
      setMsg({ type: 'success', text: congeEditMode ? 'Demande de congé modifiée avec succès.' : 'Demande de congé soumise avec succès.' })
      await loadData()
      setTimeout(() => setMsg(null), 5000)
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de la création de la demande.' })
    }
  }

  const handleAnnuler = async (id) => {
    if (!confirm('Annuler cette demande ?')) return
    try {
      await api.delete(`/api/operations/${id}`)
      await loadData()
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
      await loadData()
    } catch (err) {
      alert('Erreur: ' + (err?.response?.data?.detail || err.message))
    }
  }

  const handleActiver = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/conges/activation/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur activation: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleCloturer = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/conges/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur cloture: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleRetourAnticipe = async (id) => {
    if (!confirm('Confirmer le retour anticipé ? Les jours restants seront restitués au solde.')) return
    setLoadingOp(id)
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await api.post(`/api/conges/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule, retour_anticipe: true, date_retour_anticipe: today } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur retour anticipé: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleActiverRh = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/conges/activation/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur activation RH: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleCloturerRh = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/conges/cloture/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur clôture RH: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const renderActionButtons = (item, isRecu) => {
    const id = item.id_operation
    const statut = (item.statut || item.status || '').toLowerCase()
    const isRefus = statut.includes('refus')
    const isValid = statut.includes('valid') || item.validation_terminee
    const etat = rowEtat[id] || '--'
    const isLoading = loadingOp === id
    const btnStyle = (base) => ({ ...base, opacity: isLoading ? 0.6 : 1 })
    const eyeBtn = <button key="eye" onClick={(e) => { e.stopPropagation(); setDetailCongeItem(item) }} style={{ ...rowBtn, background: '#6366f1' }} title="Voir détails"><Eye size={12} /></button>

    if (isRefus) return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{eyeBtn}</div>

    if (isRecu) {
      const canApprove = !isValid && item.__workflow_bucket === 'recu'
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'validé') }} style={okBtn} disabled={isLoading}>Approuver</button>}
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'refusé') }} style={dangerBtn} disabled={isLoading}>Refuser</button>}
          {estRh && isValid && etat === 'AttenteRH' && (
            <button onClick={(e) => { e.stopPropagation(); handleActiverRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>
          )}
          {estRh && isValid && etat === 'Active' && (
            <button onClick={(e) => { e.stopPropagation(); handleCloturerRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>
          )}
          {eyeBtn}
        </div>
      )
    }

    // Envoyé tab (demandeur view)
    if (!isValid) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleEditConge(item) }} style={primaryBtn}>Modifier</button>
          <button onClick={(e) => { e.stopPropagation(); handleAnnuler(id) }} style={dangerBtn}>Annuler</button>
          {eyeBtn}
        </div>
      )
    }

    if (etat === '--') {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleActiver(id) }} style={btnStyle(okBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>
          {eyeBtn}
        </div>
      )
    }

    if (etat === 'AttenteRH') {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente RH</span>
          {eyeBtn}
        </div>
      )
    }

    if (etat === 'Active') {
      const dateFin = item.date_fin || item.date_retour
      const canRetourAnticipe = dateFin && new Date() < new Date(dateFin)
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleCloturer(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>
          {canRetourAnticipe && <button onClick={(e) => { e.stopPropagation(); handleRetourAnticipe(id) }} style={btnStyle({ ...primaryBtn, background: '#3b82f6' })} disabled={isLoading}>{isLoading ? '…' : 'Retour anticipé'}</button>}
          {eyeBtn}
        </div>
      )
    }

    if (etat === 'ClotureDemandee') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente confirmation RH</span>{eyeBtn}</div>
    }

    return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{eyeBtn}</div>
  }

  const renderEtatCell = (item) => {
    const etat = rowEtat[item.id_operation] || '--'
    const mkBadge = (label, color, tooltip) => {
      const b = <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color, background: `${color}22`, cursor: tooltip ? 'help' : 'default' }}>{label}</span>
      return tooltip ? <span title={tooltip}>{b}</span> : b
    }
    const activTooltip = (() => {
      const p = []
      if (item.activation_date_demandeur) p.push(`Demandeur: ${fmtDateTime(item.activation_date_demandeur)}`)
      if (item.activation_date_rh) p.push(`RH: ${fmtDateTime(item.activation_date_rh)}`)
      return p.length ? p.join('\n') : null
    })()
    if (etat === 'ClotureDemandee') {
      const clotTooltip = item.cloture_date_demandeur ? `Demandeur: ${fmtDateTime(item.cloture_date_demandeur)}` : null
      return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{mkBadge('Activé', '#10b981', activTooltip)}{mkBadge('Clôture en att. RH', '#f59e0b', clotTooltip)}</div>
    }
    if (etat === 'Cloturee') {
      const clotParts = []
      if (item.cloture_date_demandeur) clotParts.push(`Demandeur: ${fmtDateTime(item.cloture_date_demandeur)}`)
      if (item.cloture_date_rh) clotParts.push(`RH: ${fmtDateTime(item.cloture_date_rh)}`)
      return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{mkBadge('Activé', '#10b981', activTooltip)}{mkBadge('Clôturé', '#6366f1', clotParts.length ? clotParts.join('\n') : null)}</div>
    }
    if (etat === 'Active') return mkBadge('Activé', '#10b981', activTooltip)
    if (etat === 'AttenteRH') return mkBadge('En att. RH', '#f59e0b', item.activation_date_demandeur ? `Demandeur: ${fmtDateTime(item.activation_date_demandeur)}` : null)
    return mkBadge('--', '#64748b', null)
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={isRecu ? 10 : 9} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_operation} onClick={() => setSelectedOperationForWorkflow(item.id_operation)} style={{ cursor: 'pointer' }}>
        <td style={td} title={item.motif || item.titre || `Conge #${item.id_operation}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{item.motif || item.titre || `Conge #${item.id_operation}`}</span>
            <ModifiedBadge estModifie={item.est_modifie} dateModification={item.date_modification} />
          </div>
        </td>
        <td style={td}>{isRecu ? 'Approbations' : 'Conge'}</td>
        <td style={td}>
          <span
            title={item.dernier_validateur_nom && item.derniere_validation_date ? `${item.dernier_validateur_nom} — ${fmtDateTime(item.derniere_validation_date)}` : undefined}
            style={{ cursor: item.dernier_validateur_nom ? 'help' : 'default' }}
          >
            {renderStatusBadge(normalizeListStatus(item.statut || item.status || 'en attente'))}
          </span>
        </td>
        <td style={td}>{fmtDate(item.date_demande || item.date_creation || item.created_at || item.date_debut)}</td>
        {isRecu && <td style={td} title={getEmitterName(item, true, senderName)}>{getEmitterName(item, true, senderName)}</td>}
        <td style={td}>{fmtDate(item.date_debut)}</td>
        <td style={td}>{fmtDate(item.date_fin)}</td>
        <td style={td}>{durationDays(item)}</td>
        <td style={td}>{renderEtatCell(item)}</td>
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
            <span style={{ fontWeight: 700, fontSize: '0.97rem', color: '#0f172a' }}>{congeEditMode ? 'Modifier la demande de congé' : 'Nouvelle demande de congé'}</span>
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
              <button type="button" onClick={() => { setShowNewForm(false); resetCongeForm() }} style={{ padding: '9px 18px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>{congeEditMode ? 'Fermer' : 'Annuler'}</button>
              <button type="submit" style={{ padding: '9px 22px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>{congeEditMode ? 'Enregistrer les modifications' : 'Soumettre la demande'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: 10, background: 'linear-gradient(90deg, #dbeafe, #f0fdf4)', border: '1px solid #dbeafe', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 700 }}>Solde de conge</div>
        <div style={{ fontSize: '2rem', lineHeight: 1.05, fontWeight: 900, color: '#0f172a' }}>{Number(soldeConges || 0).toLocaleString('fr-FR')} jours</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs active={activeTab} setActive={tab => { setActiveTab(tab); setFilterDate(''); setFilterStatut(''); setFilterSource(''); setFilterEmetteur(''); setFilterEtat('') }} counts={{ envoye: workflowEnvoye.length, recu: recu.length }} />
        <FilterBar date={filterDate} setDate={setFilterDate} statut={filterStatut} setStatut={setFilterStatut} source={filterSource} setSource={setFilterSource} emetteur={filterEmetteur} setEmetteur={setFilterEmetteur} etat={filterEtat} setEtat={setFilterEtat} />
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '16%' }}>Titre de demande</th>
              <th style={{ ...th, width: '9%' }}>Source</th>
              <th style={{ ...th, width: '9%' }}>Statut</th>
              <th style={{ ...th, width: '9%' }}>Date de création</th>
              {activeTab !== 'envoye' && <th style={{ ...th, width: '10%' }}>Envoyé par</th>}
              <th style={{ ...th, width: '8%' }}>Date de départ</th>
              <th style={{ ...th, width: '8%' }}>Date retour</th>
              <th style={{ ...th, width: '5%' }}>Durée</th>
              <th style={{ ...th, width: '5%' }}>État</th>
              <th style={{ ...th, width: '21%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>{activeTab === 'envoye' ? renderRows(envoye, false) : renderRows(recu, true)}</tbody>
        </table>
        {activeTab === 'recu' && estRh && workflowPcaAg.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ padding: '8px 14px', background: '#eff6ff', borderTop: '2px solid #bfdbfe', borderBottom: '1px solid #dbeafe', fontWeight: 700, fontSize: '0.85rem', color: '#1d4ed8', letterSpacing: '0.02em' }}>
              Pour information — PCA / AG
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '20%' }}>Titre de demande</th>
                  <th style={{ ...th, width: '12%' }}>Demandeur</th>
                  <th style={{ ...th, width: '10%' }}>Statut</th>
                  <th style={{ ...th, width: '11%' }}>Date de création</th>
                  <th style={{ ...th, width: '10%' }}>Date de départ</th>
                  <th style={{ ...th, width: '10%' }}>Date retour</th>
                  <th style={{ ...th, width: '6%' }}>Durée</th>
                  <th style={{ ...th, width: '21%' }}>État</th>
                </tr>
              </thead>
              <tbody>
                {workflowPcaAg.map(item => (
                  <tr key={item.id_operation}>
                    <td style={td}>{item.titre || item.type_demande || 'Congé'} #{item.id_operation}</td>
                    <td style={td}>{item.demandeur?.nom_complet || item.demandeur?.nom || `#${item.matricule}`}</td>
                    <td style={td}>{item.statut}</td>
                    <td style={td}>{item.date_demande ? String(item.date_demande).slice(0, 10) : '--'}</td>
                    <td style={td}>{item.date_depart ? String(item.date_depart).slice(0, 10) : '--'}</td>
                    <td style={td}>{item.date_retour ? String(item.date_retour).slice(0, 10) : '--'}</td>
                    <td style={td}>{item.duree_jours ?? item.duree ?? '--'} j</td>
                    <td style={td}>{renderEtatCell(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedOperationForWorkflow && (
        <WorkflowModal
          isOpen={!!selectedOperationForWorkflow}
          operationId={selectedOperationForWorkflow}
          onClose={() => setSelectedOperationForWorkflow(null)}
        />
      )}

      {/* Modal: Voir détails congé */}
      {detailCongeItem && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDetailCongeItem(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={15} style={{ color: '#6366f1' }} /> Détails congé #{detailCongeItem.id_operation}
              </strong>
              <button onClick={() => setDetailCongeItem(null)} style={{ padding: '7px 14px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '0.86rem' }}>
              {detailCongeItem.motif && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Motif: </span>{detailCongeItem.motif}</div>}
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Date début: </span>{detailCongeItem.date_debut ? new Date(detailCongeItem.date_debut).toLocaleDateString('fr-FR') : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Date fin: </span>{detailCongeItem.date_fin ? new Date(detailCongeItem.date_fin).toLocaleDateString('fr-FR') : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Durée: </span>{detailCongeItem.duree_jours ?? '—'} j</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Statut: </span>
                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                  color: (detailCongeItem.statut || '').toLowerCase().includes('valid') ? '#065f46' : (detailCongeItem.statut || '').toLowerCase().includes('refus') ? '#991b1b' : '#92400e',
                  background: (detailCongeItem.statut || '').toLowerCase().includes('valid') ? '#d1fae5' : (detailCongeItem.statut || '').toLowerCase().includes('refus') ? '#fee2e2' : '#fef3c7'
                }}>{detailCongeItem.statut || 'En attente'}</span>
              </div>
              {detailCongeItem.retour_anticipe && (
                <div><span style={{ color: '#64748b', fontWeight: 600 }}>Retour anticipé: </span>
                  {detailCongeItem.date_retour_anticipe ? new Date(detailCongeItem.date_retour_anticipe).toLocaleDateString('fr-FR') : 'Oui'}
                </div>
              )}
              {(detailCongeItem.demandeur || detailCongeItem.demandeur_nom) && (
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Initié par: </span>{[detailCongeItem.demandeur?.prenom, detailCongeItem.demandeur?.nom].filter(Boolean).join(' ') || detailCongeItem.demandeur?.nom_complet || detailCongeItem.demandeur_nom}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
