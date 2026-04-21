import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import WorkflowModal from '../components/WorkflowModal'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import ModifiedBadge from '../components/ModifiedBadge'
import { operationLabel } from '../utils/operationLabel'
import { Eye, Pencil, CheckCircle, XCircle, Zap, Lock, CornerUpLeft, UserCheck, FileDown } from 'lucide-react'
import { confirmDialog } from '../components/ui/bridge'
import { Pagination, usePagination, TableSkeleton } from '../components/ui'

const th = { padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.66rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '6px', borderBottom: '1px solid #f1f5f9', fontSize: '0.7rem', color: 'var(--text)', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '3px 6px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.64rem', color: '#fff', lineHeight: 1.2 }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }
const today = new Date().toISOString().split('T')[0]
const fieldLabel = { fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }

const normalizeText = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const fmtDate = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '-'
const parseTimeToMinutes = (value) => {
  if (!value) return null
  const [hours, minutes] = String(value).split(':')
  const h = Number(hours)
  const m = Number(minutes)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return (h * 60) + m
}
// Calcule la durée effective en soustrayant 1h si le créneau chevauche la pause déjeuner [12:00-14:00]
const computeEffectiveDuration = (startStr, endStr) => {
  const startMin = parseTimeToMinutes(startStr)
  const endMin = parseTimeToMinutes(endStr)
  if (startMin == null || endMin == null || endMin <= startMin) return null
  const bruteMins = endMin - startMin
  const overlapStart = Math.max(startMin, 12 * 60)
  const overlapEnd = Math.min(endMin, 14 * 60)
  const deductionMins = overlapEnd > overlapStart ? 60 : 0
  return (bruteMins - deductionMins) / 60
}
const durationHours = (startTime, endTime) => {
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  if (start == null || end == null || end <= start) return '-'
  const totalMinutes = end - start
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}
const isValidated = (value) => ['valide', 'validé'].includes(normalizeText(value))
const statusColor = (value) => ({
  'en attente': '#f59e0b',
  'a valider': '#3b82f6',
  'valide par moi': '#10b981',
  'validé par moi': '#10b981',
  'envoyee': '#3b82f6',
  'envoyée': '#3b82f6',
  'refuse par moi': '#ef4444',
  'refusée par moi': '#ef4444',
  'annule': '#6b7280',
  'annulé': '#6b7280',
  'validé': '#10b981',
  'valide': '#10b981',
  'refusé': '#ef4444',
}[normalizeText(value)] || '#64748b')

const renderStatusBadge = (value) => {
  const label = value || 'en attente'
  const color = statusColor(label)
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color, background: `${color}22` }}>{label}</span>
}
const normalizeListStatus = (value) => {
  const normalized = normalizeText(value)
  if (normalized.includes('refus')) return 'refusé'
  if (normalized.includes('valid')) return 'validé'
  return 'en attente'
}

function getEmitterName(item, isRecu, defaultName) {
  if (!isRecu) return defaultName
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
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
      {[['envoye', "Envoyé", counts.envoye], ['recu', "Recu", counts.recu]].map(([key, label, count]) => (
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
      <input type="text" value={emetteur} onChange={e => setEmetteur(e.target.value)} placeholder="Emetteur" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={etat} onChange={e => setEtat(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }}>
        <option value="">Tous etats</option>
        {['--', 'AttenteRH', 'Active', 'ClotureDemandee', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>{"Réinitialiser les filtres"}</button>}
    </div>
  )
}

export default function SortiesPage() {
  const { user } = useAuth()
  const matricule = Number(user?.matricule || user?.sub || 0)
  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])
  const role = String(user?.role || '').toUpperCase()
  const estRh = role === 'RH' || role === 'ADMIN'

  const [activeTab, setActiveTab] = useState('envoye')
  const [showNewForm, setShowNewForm] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [selectedOperationForWorkflow, setSelectedOperationForWorkflow] = useState(null)
  const [detailSortieItem, setDetailSortieItem] = useState(null)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const opId = searchParams.get('operationId')
    if (opId) setSelectedOperationForWorkflow(Number(opId))
    const tab = searchParams.get('tab')
    if (tab === 'recu' || tab === 'envoye') setActiveTab(tab)
  }, [])
  const [form, setForm] = useState({ date_sortie: today, heure_sortie: '', heure_retour: '', commentaire: '' })
  const [editOperationId, setEditOperationId] = useState(null)

  const [workflowEnvoye, setWorkflowEnvoye] = useState([])
  const [workflowAValider, setWorkflowAValider] = useState([])
  const [workflowValide, setWorkflowValide] = useState([])
  const [workflowRefuse, setWorkflowRefuse] = useState([])
  const [sortieDetailsByOperation, setSortieDetailsByOperation] = useState({})
  const [rowEtat, setRowEtat] = useState({})
  const [loadingOp, setLoadingOp] = useState(null)

  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterEmetteur, setFilterEmetteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')

  const normalizeSortiesWorkflow = (rows, label, bucket, detailsMap) => (Array.isArray(rows) ? rows : [])
    .filter((item) => normalizeText(item?.type_demande).includes('sortie'))
    .map((item) => ({ ...item, __workflow_label: label, __workflow_bucket: bucket, __sortie: detailsMap[item.id_operation] || null }))

  const loadData = async () => {
    if (!matricule) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [boiteRes, sortiesRes] = await Promise.all([
        api.get(`/api/workflow/boite/${matricule}`).catch(() => ({ data: {} })),
        api.get('/api/sorties/').catch(() => ({ data: [] }))
      ])

      const detailsMap = {}
      ;(Array.isArray(sortiesRes.data) ? sortiesRes.data : []).forEach((s) => {
        if (s?.id_operation) detailsMap[s.id_operation] = s
      })

      const boite = boiteRes?.data || {}
      setSortieDetailsByOperation(detailsMap)
      const envoyeNorm = normalizeSortiesWorkflow(boite.envoye, 'Envoyée', 'envoye', detailsMap)
      const aValiderNorm = normalizeSortiesWorkflow(boite.recu, 'À valider', 'recu', detailsMap)
      const valideNorm = normalizeSortiesWorkflow(boite.valide, 'Validée par moi', 'valide', detailsMap)
      const refuseNorm = normalizeSortiesWorkflow(boite.refuse, 'Refusée par moi', 'refuse', detailsMap)
      setWorkflowEnvoye(envoyeNorm)
      setWorkflowAValider(aValiderNorm)
      setWorkflowValide(valideNorm)
      setWorkflowRefuse(refuseNorm)
      setRowEtat(initRowEtatFromApi([...envoyeNorm, ...aValiderNorm, ...valideNorm, ...refuseNorm]))
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur de chargement des demandes de sortie.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [matricule])

  // Actualisation automatique toutes les 30 secondes
  useAutoRefresh(loadData)

  const applyFilters = (list) => list.filter((item) => {
    const dateValue = item.date_demande || item.date_creation || item.created_at || item.date_debut || ''
    const statusValue = normalizeText(normalizeListStatus(item.statut || item.status || 'en attente'))
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Sortie').toLowerCase()
    const emetteurValue = getEmitterName(item, activeTab === 'recu', senderName).toLowerCase()
    const etatValue = (rowEtat[item.id_operation] || '--').toLowerCase()
    return (!filterDate || String(dateValue).startsWith(filterDate))
      && (!filterStatut || statusValue === normalizeText(filterStatut))
      && (!filterSource || sourceValue.includes(filterSource.toLowerCase()))
      && (!filterEmetteur || emetteurValue.includes(filterEmetteur.toLowerCase()))
      && (!filterEtat || etatValue === filterEtat.toLowerCase())
  })

  const envoye = useMemo(() => {
    const dedup = [...new Map(workflowEnvoye.map(item => [item.id_operation, item])).values()]
    return applyFilters(dedup)
  }, [workflowEnvoye, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])
  const recu = useMemo(() => {
    const combined = [...workflowAValider, ...workflowValide, ...workflowRefuse]
    const dedup = [...new Map(combined.map(item => [item.id_operation, item])).values()]
    return applyFilters(dedup)
  }, [workflowAValider, workflowValide, workflowRefuse, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleCreateOrEdit = async (e) => {
    e.preventDefault()
    setMsg(null)

    if (!form.heure_sortie) {
      setMsg({ type: 'error', text: "L'heure de départ est obligatoire" })
      return
    }
    if (!form.heure_retour) {
      setMsg({ type: 'error', text: "L'heure de retour est obligatoire" })
      return
    }
    const departMinutes = parseTimeToMinutes(form.heure_sortie)
    const retourMinutes = parseTimeToMinutes(form.heure_retour)
    if (departMinutes == null || retourMinutes == null || retourMinutes <= departMinutes) {
      setMsg({ type: 'error', text: 'L\'heure de retour doit etre superieure a l\'heure de depart.' })
      return
    }
    const effectiveH = computeEffectiveDuration(form.heure_sortie, form.heure_retour)
    if (effectiveH !== null && effectiveH > 4) {
      setMsg({ type: 'error', text: 'Une sortie ne peut pas dépasser 4 heures effectives (pause déjeuner 12h-14h déduite).' })
      return
    }

    try {
      const payload = {
        matricule,
        date_sortie: form.date_sortie,
        heure_sortie: form.heure_sortie,
        heure_retour: form.heure_retour,
        commentaire: form.commentaire || null
      }

      if (editOperationId) {
        const res = await api.put(`/api/sorties/${editOperationId}/modifier`, payload)
        // Immediately update the local details map so the row re-renders without waiting for loadData
        const idOp = editOperationId
        setSortieDetailsByOperation(prev => ({
          ...prev,
          [idOp]: {
            ...(prev[idOp] || {}),
            heure_sortie: res.data.heure_sortie,
            heure_retour: res.data.heure_retour,
            duree_heures: res.data.duree_heures,
            date_sortie: res.data.date_sortie,
            commentaire: res.data.commentaire,
          }
        }))
        setMsg({ type: 'success', text: "Sortie modifiée avec succès" })
      } else {
        await api.post('/api/sorties/', payload)
        setMsg({ type: 'success', text: "Sortie enregistrée avec succès" })
      }

      setEditOperationId(null)
      setForm({ date_sortie: today, heure_sortie: '', heure_retour: '', commentaire: '' })
      setShowNewForm(false)
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de l\'enregistrement.' })
    }
  }

  const handleModifier = (item) => {
    const detail = item.__sortie || sortieDetailsByOperation[item.id_operation] || {}
    setEditOperationId(item.id_operation)
    setForm({
      date_sortie: (detail.date_sortie || item.date_debut || today),
      heure_sortie: detail.heure_sortie ? String(detail.heure_sortie).slice(0, 5) : '',
      heure_retour: detail.heure_retour ? String(detail.heure_retour).slice(0, 5) : '',
      commentaire: (detail.commentaire || item.motif || '').replace(/\|\s*Heure retour:\s*\d{1,2}:\d{2}/i, '').trim()
    })
    setShowNewForm(true)
  }

  const handleAnnuler = async (idOperation) => {
    const ok = await confirmDialog({
      title: 'Annuler la demande',
      message: 'Êtes-vous sûr de vouloir annuler cette demande ?',
      variant: 'danger',
      confirmLabel: 'Annuler la demande',
      cancelLabel: 'Retour',
    })
    if (!ok) return
    try {
      await api.put(`/api/sorties/${idOperation}/annuler`)
      setMsg({ type: 'success', text: `Opération #${idOperation} annulée.` })
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de l\'annulation.' })
    }
  }

  const handleActiver = async (idOperation) => {
    setLoadingOp(idOperation)
    try {
      const response = await api.post(`/api/sorties/activation/${idOperation}/demandeur`, null, {
        params: { matricule_demandeur: matricule }
      })
      await loadData()
      if (response?.data?.message) setMsg({ type: 'success', text: response.data.message })
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur activation.' })
    } finally {
      setLoadingOp(null)
    }
  }

  const handleActiverRh = async (idOperation) => {
    setLoadingOp(idOperation)
    try {
      const response = await api.post(`/api/sorties/activation/${idOperation}/rh`, null, {
        params: { matricule_rh: matricule }
      })
      if (response?.data?.message) setMsg({ type: 'success', text: response.data.message })
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur activation RH.' })
    } finally {
      setLoadingOp(null)
    }
  }

  const handleCloturer = async (idOperation) => {
    setLoadingOp(idOperation)
    try {
      const response = await api.post(`/api/sorties/cloture/${idOperation}/demandeur`, null, {
        params: { matricule_demandeur: matricule }
      })
      if (response?.data?.message) setMsg({ type: 'success', text: response.data.message })
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur clôture.' })
    } finally {
      setLoadingOp(null)
    }
  }

  const handleRetourAnticipe = async (idOperation) => {
    const ok = await confirmDialog({
      title: 'Retour anticipé',
      message: 'Déclarer un retour anticipé ?',
      variant: 'warning',
      confirmLabel: 'Confirmer le retour',
    })
    if (!ok) return
    setLoadingOp(idOperation)
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await api.post(`/api/sorties/cloture/${idOperation}/demandeur`, null, {
        params: { matricule_demandeur: matricule, retour_anticipe: true, date_retour_anticipe: today }
      })
      if (response?.data?.message) setMsg({ type: 'success', text: response.data.message })
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur retour anticipé.' })
    } finally {
      setLoadingOp(null)
    }
  }

  const handleCloturerRh = async (idOperation) => {
    setLoadingOp(idOperation)
    try {
      const response = await api.post(`/api/sorties/cloture/${idOperation}/rh`, null, {
        params: { matricule_rh: matricule }
      })
      if (response?.data?.message) setMsg({ type: 'success', text: response.data.message })
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur clôture RH.' })
    } finally {
      setLoadingOp(null)
    }
  }

  const handleWorkflow = async (id, statut) => {
    let commentaire = null
    if (statut === 'refusé') {
      commentaire = await confirmDialog({
        title: 'Motif du refus',
        message: 'Indiquez le motif du refus. Ce commentaire sera visible par le demandeur.',
        variant: 'danger',
        confirmLabel: 'Refuser',
        requireInput: { label: 'Motif du refus', placeholder: 'Ex. justification insuffisante…', multiline: true, required: true },
      })
      if (!commentaire) return
    }
    try {
      await api.post(`/api/workflow/valider/${id}`, null, { params: { matricule_validateur: matricule, statut, ...(commentaire ? { commentaire } : {}) } })
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || err.message })
    }
  }

  const renderActionButtons = (item, isRecu) => {
    const id = item.id_operation
    const statut = (item.statut || item.status || '').toLowerCase()
    const isRefus = statut.includes('refus')
    const isValid = statut.includes('valid') || item.validation_terminee
    const etat = rowEtat[id] || '--'
    const isLoading = loadingOp === id
    const btnStyle = (base) => ({ ...base, opacity: isLoading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 3 })
    const eyeBtn = <button key="eye" onClick={(e) => { e.stopPropagation(); setDetailSortieItem({ ...(item.__sortie || {}), ...item }) }} className="btn-ghost-primary" style={{ ...rowBtn, display: 'inline-flex', alignItems: 'center' }} title="Voir détails"><Eye size={12} /></button>
    const pdfBtn = isValid ? <button key="pdf" onClick={(e) => { e.stopPropagation(); setDownloadingPdf(id); api.get(`/api/pdf/sortie/${id}`, { responseType: 'blob' }).then(res => { const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `sortie_${id}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }).finally(() => setDownloadingPdf(null)) }} className="btn-ghost-primary" style={{ ...rowBtn, display: 'inline-flex', alignItems: 'center', opacity: downloadingPdf === id ? 0.6 : 1 }} disabled={downloadingPdf === id} title="Télécharger PDF"><FileDown size={13} /></button> : null

    if (isRefus) return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{eyeBtn}</div>

    if (isRecu) {
      const canApprove = !isValid && item.__workflow_bucket === 'recu'
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'validé') }} style={btnStyle(okBtn)} disabled={isLoading}><CheckCircle size={11} /> {"Approuver"}</button>}
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'refusé') }} style={btnStyle(dangerBtn)} disabled={isLoading}><XCircle size={11} /> {"Refuser"}</button>}
          {estRh && isValid && etat === 'AttenteRH' && <button onClick={(e) => { e.stopPropagation(); handleActiverRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : <><Zap size={11} /> Activer</>}</button>}
          {estRh && isValid && etat === 'Active' && <button onClick={(e) => { e.stopPropagation(); handleCloturerRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : <><Lock size={11} /> {"Clôturer le congé"}</>}</button>}
          {pdfBtn}{eyeBtn}
        </div>
      )
    }

    if (!isValid) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleModifier(item) }} style={btnStyle(primaryBtn)}>{"Modifier"}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAnnuler(id) }} style={btnStyle(dangerBtn)}>{"Annuler"}</button>
          {eyeBtn}
        </div>
      )
    }

    if (etat === '--') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleActiver(id) }} style={btnStyle(okBtn)} disabled={isLoading}>{isLoading ? '…' : <><Zap size={11} /> Activer</>}</button>{pdfBtn}{eyeBtn}</div>
    }

    if (etat === 'AttenteRH') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#92400e', background: '#fef3c7' }}><UserCheck size={10} /> En att. RH</span>{pdfBtn}{eyeBtn}</div>
    }

    if (etat === 'Active') {
      const dateFin = item.date_fin || item.date_retour || item.date_sortie
      const canRetourAnticipe = dateFin && new Date() < new Date(dateFin)
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={(e) => { e.stopPropagation(); handleCloturer(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : <><Lock size={11} /> {"Clôturer le congé"}</>}</button>
        {canRetourAnticipe && <button onClick={(e) => { e.stopPropagation(); handleRetourAnticipe(id) }} style={btnStyle({ ...primaryBtn, background: '#3b82f6' })} disabled={isLoading}>{isLoading ? '…' : <><CornerUpLeft size={11} /> Retour ant.</>}</button>}
        {pdfBtn}{eyeBtn}
      </div>
    }

    if (etat === 'ClotureDemandee') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#92400e', background: '#fef3c7' }}><UserCheck size={10} /> Att. confirmation RH</span>{pdfBtn}{eyeBtn}</div>
    }

    return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{pdfBtn}{eyeBtn}</div>
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={isRecu ? 11 : 10} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>

    return rows.map((item) => {
      const detail = item.__sortie || sortieDetailsByOperation[item.id_operation] || {}
      const heureDepart = detail.heure_sortie ? String(detail.heure_sortie).slice(0, 5) : '--'
      const heureRetour = detail.heure_retour ? String(detail.heure_retour).slice(0, 5) : '--'

      return (
        <tr key={`${activeTab}-${item.id_operation}`} onClick={() => setSelectedOperationForWorkflow(item.id_operation)} style={{ cursor: 'pointer' }}>
          <td style={td} title={operationLabel(item)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{operationLabel(item)}</span>
              <ModifiedBadge estModifie={item.est_modifie} dateModification={item.date_modification} />
            </div>
          </td>
          <td style={td}>{isRecu ? 'Approbations' : 'Sortie'}</td>
          <td style={td}>
            <span
              title={item.dernier_validateur_nom && item.derniere_validation_date ? `${item.dernier_validateur_nom} — ${fmtDateTime(item.derniere_validation_date)}` : undefined}
              style={{ cursor: item.dernier_validateur_nom ? 'help' : 'default' }}
            >
              {renderStatusBadge(normalizeListStatus(item.statut || item.status || 'en attente'))}
            </span>
          </td>
          <td style={td} title={(() => { const v = item.date_demande || item.date_creation || item.created_at || item.date_debut; return v ? new Date(v).toLocaleString('fr-FR') : '' })()}>{fmtDate(item.date_demande || item.date_creation || item.created_at || item.date_debut)}</td>
          {isRecu && <td style={td} title={getEmitterName(item, true, senderName)}>{getEmitterName(item, true, senderName)}</td>}
          <td style={td}>{fmtDate(detail.date_sortie || item.date_debut)}</td>
          <td style={td}>{heureDepart}</td>
          <td style={td}>{heureRetour}</td>
          <td style={td}>{detail.duree_heures != null ? `${detail.duree_heures} h` : durationHours(heureDepart, heureRetour)}</td>
          <td style={td}>{(() => {
            const etat = rowEtat[item.id_operation] || '--'
            const makeBadge = (label, color, tooltip) => {
              const b = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color, background: `${color}22`, cursor: tooltip ? 'help' : 'default' }}>{label}</span>
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
              return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{makeBadge(<><Zap size={9}/> Activé</>, '#10b981', activTooltip)}{makeBadge(<><UserCheck size={9}/> Clôt. att. RH</>, '#f59e0b', clotTooltip)}</div>
            }
            if (etat === 'Cloturee') {
              const clotParts = []
              if (item.cloture_date_demandeur) clotParts.push(`Demandeur: ${fmtDateTime(item.cloture_date_demandeur)}`)
              if (item.cloture_date_rh) clotParts.push(`RH: ${fmtDateTime(item.cloture_date_rh)}`)
              return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{makeBadge(<><Zap size={9}/> Activé</>, '#10b981', activTooltip)}{makeBadge(<><Lock size={9}/> Clôturé</>, '#6366f1', clotParts.length ? clotParts.join('\n') : null)}</div>
            }
            if (etat === 'Active') return makeBadge(<><Zap size={9}/> Activé</>, '#10b981', activTooltip)
            if (etat === 'AttenteRH') return makeBadge(<><UserCheck size={9}/> Att. RH</>, '#f59e0b', item.activation_date_demandeur ? `Demandeur: ${fmtDateTime(item.activation_date_demandeur)}` : null)
            return makeBadge('—', '#94a3b8', null)
          })()}</td>
          <td style={td}>{renderActionButtons(item, isRecu)}</td>
        </tr>
      )
    })
  }

  const _source = activeTab === 'envoye' ? envoye : recu
  const pagination = usePagination(_source, { pageSize: 20 })
  if (loading) return <div style={{ padding: 20 }}><TableSkeleton rows={6} columns={9} /></div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>{"Gestion des Sorties"}</h1>
        <button
          onClick={() => {
            setShowNewForm((prev) => !prev)
            if (!showNewForm) setEditOperationId(null)
          }}
          style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
        >
          Nouvelle demande
        </button>
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 6,
            background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: msg.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}`
          }}
        >
          {msg.text}
        </div>
      )}

      {showNewForm && (
        <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(15,23,42,0.07)', padding: '24px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: 4, height: 20, background: '#ce2b2b', borderRadius: 2, marginRight: 10, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '0.97rem', color: 'var(--text)' }}>{editOperationId ? 'Modifier la demande de sortie' : 'Nouvelle demande de sortie'}</span>
          </div>
          <form onSubmit={handleCreateOrEdit} style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div>
              <label style={fieldLabel}>Date de départ</label>
              <input type="date" value={form.date_sortie} min={today} onChange={(e) => setField('date_sortie', e.target.value)} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: 'var(--text)' }} required />
            </div>
            <div>
              <label style={fieldLabel}>Heure de départ</label>
              <input type="time" value={form.heure_sortie} onChange={(e) => setField('heure_sortie', e.target.value)} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: 'var(--text)' }} required />
            </div>
            <div>
              <label style={fieldLabel}>Heure de retour</label>
              <input type="time" value={form.heure_retour} onChange={(e) => setField('heure_retour', e.target.value)} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: 'var(--text)' }} required />
            </div>
            <div>
              <label style={fieldLabel}>Durée effective</label>
              {(() => {
                const h = (form.heure_sortie && form.heure_retour) ? computeEffectiveDuration(form.heure_sortie, form.heure_retour) : null
                const bg = h == null ? '#f1f5f9' : h <= 4 ? '#d1fae5' : '#fee2e2'
                const color = h == null ? '#94a3b8' : h <= 4 ? '#065f46' : '#991b1b'
                const label = h == null ? '—' : `${h % 1 === 0 ? h : h.toFixed(1)} h`
                return <input readOnly value={label} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', background: bg, color, fontWeight: 700, cursor: 'default' }} />
              })()}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={fieldLabel}>Motif</label>
              <textarea value={form.commentaire} onChange={(e) => setField('commentaire', e.target.value)} rows={2} placeholder="Précisez le motif de la sortie" style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
              <button type="button" onClick={() => { setShowNewForm(false); setEditOperationId(null); setForm({ date_sortie: today, heure_sortie: '', heure_retour: '', commentaire: '' }) }} style={{ padding: '9px 18px', background: 'var(--bg)', color: '#475569', border: '1px solid var(--border)', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>{"Annuler"}</button>
              <button type="submit" style={{ padding: '9px 22px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>{editOperationId ? "Enregistrer" : 'Soumettre la demande'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'var(--card)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs active={activeTab} setActive={(tab) => { setActiveTab(tab); setFilterDate(''); setFilterStatut(''); setFilterSource(''); setFilterEmetteur(''); setFilterEtat('') }} counts={{ envoye: workflowEnvoye.length, recu: recu.length }} />
        <FilterBar date={filterDate} setDate={setFilterDate} statut={filterStatut} setStatut={setFilterStatut} source={filterSource} setSource={setFilterSource} emetteur={filterEmetteur} setEmetteur={setFilterEmetteur} etat={filterEtat} setEtat={setFilterEtat} />
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '15%' }}>Titre de demande</th>
              <th style={{ ...th, width: '7%' }}>Source</th>
              <th style={{ ...th, width: '8%' }}>Statut</th>
              <th style={{ ...th, width: '8%' }}>Date de création</th>
              {activeTab !== 'envoye' && <th style={{ ...th, width: '9%' }}>Envoyé par</th>}
              <th style={{ ...th, width: '8%' }}>Date de départ</th>
              <th style={{ ...th, width: '7%' }}>Heure départ</th>
              <th style={{ ...th, width: '7%' }}>Heure retour</th>
              <th style={{ ...th, width: '8%' }}>Durée</th>
              <th style={{ ...th, width: '6%' }}>État</th>
              <th style={{ ...th, width: '13%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>{renderRows(pagination.pageItems, activeTab === 'recu')}</tbody>
          </table>
          <Pagination {...pagination} />
        </div>
      </div>

      {selectedOperationForWorkflow && (
        <WorkflowModal
          isOpen={!!selectedOperationForWorkflow}
          operationId={selectedOperationForWorkflow}
          onClose={() => setSelectedOperationForWorkflow(null)}
        />
      )}

      {/* Modal: Voir détails sortie */}
      {detailSortieItem && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDetailSortieItem(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--card)', borderRadius: 12, padding: 28, width: '90%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <strong style={{ fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={15} style={{ color: '#6366f1' }} /> Détails sortie #{detailSortieItem.id_operation}
              </strong>
              <button onClick={() => setDetailSortieItem(null)} style={{ padding: '7px 14px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Fermer"}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '0.86rem' }}>
              {detailSortieItem.motif && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Motif: </span>{detailSortieItem.motif}</div>}
              {detailSortieItem.commentaire && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Commentaire: </span>{detailSortieItem.commentaire}</div>}
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Date sortie: </span>{detailSortieItem.date_sortie ? new Date(detailSortieItem.date_sortie).toLocaleDateString('fr-FR') : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Heure départ: </span>{detailSortieItem.heure_sortie ? String(detailSortieItem.heure_sortie).slice(0, 5) : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Heure retour: </span>{detailSortieItem.heure_retour ? String(detailSortieItem.heure_retour).slice(0, 5) : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Durée: </span>{detailSortieItem.duree_heures != null ? `${detailSortieItem.duree_heures} h` : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Statut: </span>
                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                  color: (detailSortieItem.statut || '').toLowerCase().includes('valid') ? '#065f46' : (detailSortieItem.statut || '').toLowerCase().includes('refus') ? '#991b1b' : '#92400e',
                  background: (detailSortieItem.statut || '').toLowerCase().includes('valid') ? '#d1fae5' : (detailSortieItem.statut || '').toLowerCase().includes('refus') ? '#fee2e2' : '#fef3c7'
                }}>{detailSortieItem.statut || 'En attente'}</span>
              </div>
              {(detailSortieItem.demandeur || detailSortieItem.demandeur_nom) && (
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Initié par: </span>{[detailSortieItem.demandeur?.prenom, detailSortieItem.demandeur?.nom].filter(Boolean).join(' ') || detailSortieItem.demandeur?.nom_complet || detailSortieItem.demandeur_nom}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
