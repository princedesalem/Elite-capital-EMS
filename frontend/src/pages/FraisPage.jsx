import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import WorkflowModal from '../components/WorkflowModal'
import ModifiedBadge from '../components/ModifiedBadge'
import '../styles/Operations.css'
import { ClipboardList, AlertTriangle, FileText, CheckCircle, Upload } from 'lucide-react'

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }
const initialFraisForm = { id_operation: '', frais_transport_unitaire: 0, frais_hotel_unitaire: 0, frais_deplacement_unitaire: 0, frais_mission_unitaire: 0, justificatif: '' }
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
const normalizeText = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const normalizeListStatus = (value) => {
  const normalized = normalizeText(value)
  if (normalized.includes('refus')) return 'refusé'
  if (normalized.includes('valid')) return 'validé'
  return 'en attente'
}
const normalizeFraisWorkflow = (rows, label, bucket) => (Array.isArray(rows) ? rows : [])
  .filter((item) => normalizeText(item?.type_demande).includes('frais'))
  .map((item) => ({ ...item, __workflow_label: label, __workflow_bucket: bucket }))
const missionLabel = (item) => item?.objet || item?.titre || `Mission #${item?.id_operation || '-'}`
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
const computeMissionMetrics = (mission) => {
  if (!mission?.date_debut || !mission?.date_fin) {
    return { durationDays: 0, nuits: 0 }
  }
  const dateDebut = new Date(mission.date_debut)
  const dateFin = new Date(mission.date_fin)
  const heureArrivee = mission.heure_arrivee ? String(mission.heure_arrivee).split(':') : ['18', '00', '00']
  const heureRetour = mission.heure_retour ? String(mission.heure_retour).split(':') : ['17', '00', '00']
  const durationDays = Math.ceil((dateFin - dateDebut) / (1000 * 60 * 60 * 24)) + 1
  const dateArrivee = new Date(mission.date_debut)
  dateArrivee.setHours(parseInt(heureArrivee[0], 10), parseInt(heureArrivee[1], 10))
  const dateRetour = new Date(mission.date_fin)
  dateRetour.setHours(parseInt(heureRetour[0], 10), parseInt(heureRetour[1], 10))
  const nuits = Math.max(0, Math.ceil((dateRetour - dateArrivee) / (1000 * 60 * 60 * 24)))
  return { durationDays, nuits }
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
        {['en attente', 'validé', 'refusé'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="Source" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }} />
      <input type="text" value={emetteur} onChange={e => setEmetteur(e.target.value)} placeholder="Emetteur" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={etat} onChange={e => setEtat(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }}>
        <option value="">Tous etats</option>
        {['--', 'AttenteRH', 'Active', 'ClotureDemandee', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>Reinitialiser</button>}
    </div>
  )
}

export default function FraisPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('envoye')
  const [items, setItems] = useState([])
  const [workflowEnvoye, setWorkflowEnvoye] = useState([])
  const [workflowAValider, setWorkflowAValider] = useState([])
  const [workflowValide, setWorkflowValide] = useState([])
  const [workflowRefuse, setWorkflowRefuse] = useState([])
  const [rowEtat, setRowEtat] = useState({})
  const [loadingOp, setLoadingOp] = useState(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterEmetteur, setFilterEmetteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])
  const matricule = useMemo(() => Number(user?.matricule || user?.sub || 0), [user])
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const estRh = useMemo(() => ['RH', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])
  const [selectedOperationForWorkflow, setSelectedOperationForWorkflow] = useState(null)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const opId = searchParams.get('operationId')
    if (opId) setSelectedOperationForWorkflow(Number(opId))
  }, [])

  // All missions for frais selection
  const [missions, setMissions] = useState([])
  const [missionStatuts, setMissionStatuts] = useState({})

  // Frais form state
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [fraisForm, setFraisForm] = useState(initialFraisForm)
  const [fraisEditMode, setFraisEditMode] = useState(false)
  const [fraisEditId, setFraisEditId] = useState(null)
  const [showUploadSection, setShowUploadSection] = useState(false)
  const [preuveUpload, setPreuveUpload] = useState({ id_frais: '', type_preuve: 'facture', file: null })
  const [preuvesFraisEnCours, setPreuvesFraisEnCours] = useState([])

  const fraisMissionCalculs = useMemo(() => {
    if (!fraisForm.id_operation || missions.length === 0) return { durationDays: 0, nuits: 0, frais_transport_total: 0, frais_hotel_total: 0, frais_deplacement_total: 0, frais_mission_total: 0, total_general: 0 }
    const mission = missions.find(m => m.id_operation === parseInt(fraisForm.id_operation, 10))
    if (!mission) return { durationDays: 0, nuits: 0, frais_transport_total: 0, frais_hotel_total: 0, frais_deplacement_total: 0, frais_mission_total: 0, total_general: 0 }
    const { durationDays, nuits } = computeMissionMetrics(mission)
    const frais_transport_total = Number(fraisForm.frais_transport_unitaire || 0)
    const frais_hotel_total = Number(fraisForm.frais_hotel_unitaire || 0) * Math.max(1, nuits)
    const frais_deplacement_total = Number(fraisForm.frais_deplacement_unitaire || 0) * durationDays
    const frais_mission_total = Number(fraisForm.frais_mission_unitaire || 0) * durationDays
    const total_general = frais_transport_total + frais_hotel_total + frais_deplacement_total + frais_mission_total
    return { durationDays, nuits, frais_transport_total, frais_hotel_total, frais_deplacement_total, frais_mission_total, total_general }
  }, [fraisForm.id_operation, fraisForm.frais_transport_unitaire, fraisForm.frais_hotel_unitaire, fraisForm.frais_deplacement_unitaire, fraisForm.frais_mission_unitaire, missions])

  // Auto-remplir transport si routier
  useEffect(() => {
    if (!fraisForm.id_operation || missions.length === 0) return
    const mission = missions.find(m => m.id_operation === parseInt(fraisForm.id_operation, 10))
    if (!mission) return
    if (mission.moyens_transport && mission.moyens_transport.includes('routier')) {
      setFraisForm(prev => ({ ...prev, frais_transport_unitaire: 15000 }))
    } else { setFraisForm(prev => ({ ...prev, frais_transport_unitaire: 0 })) }
  }, [fraisForm.id_operation, missions])

  function resetFraisForm() {
    setFraisForm(initialFraisForm)
    setFraisEditMode(false)
    setFraisEditId(null)
  }

  async function loadData() {
    if (!user?.matricule) { setLoading(false); return }
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get(`/api/missions/mes-missions/${user.matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/boite/${user.matricule}`).catch(() => ({ data: {} })),
        api.get(`/api/missions/en-tant-que-missionnaire/${user.matricule}`).catch(() => ({ data: [] }))
      ])
      const initiatorMissions = Array.isArray(r1.data) ? r1.data : []
      const missionnaireMissions = Array.isArray(r3.data) ? r3.data : []
      const allMissions = [
        ...initiatorMissions,
        ...missionnaireMissions.filter(m => !initiatorMissions.find(x => x.id_operation === m.id_operation))
      ]
      const boite = r2?.data || {}
      setMissions(allMissions)
      setItems(allMissions.filter(m => !!m.a_des_frais))
      const envoyeNorm = normalizeFraisWorkflow(boite.envoye, 'Envoyée', 'envoye')
      const aValiderNorm = normalizeFraisWorkflow(boite.recu, 'À valider', 'recu')
      const valideNorm = normalizeFraisWorkflow(boite.valide, 'Validée par moi', 'valide')
      const refuseNorm = normalizeFraisWorkflow(boite.refuse, 'Refusée par moi', 'refuse')
      setWorkflowEnvoye(envoyeNorm)
      setWorkflowAValider(aValiderNorm)
      setWorkflowValide(valideNorm)
      setWorkflowRefuse(refuseNorm)
      setRowEtat(initRowEtatFromApi([...envoyeNorm, ...aValiderNorm, ...valideNorm, ...refuseNorm]))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user?.matricule])

  useEffect(() => {
    if (missions.length > 0) {
      missions.forEach(async m => {
        if (m.id_operation) {
          try { const res = await api.get(`/api/missions/${m.id_operation}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [m.id_operation]: res.data })) } catch {}
        }
      })
    }
  }, [missions])

  async function handleEditFrais(item) {
    try {
      const response = await api.get(`/api/missions/frais/${item.id_operation}`)
      const detail = response?.data || {}
      const missionId = detail.id_mission || detail?.mission?.id_operation || ''
      const mission = missions.find((entry) => entry.id_operation === missionId) || detail.mission
      const { durationDays, nuits } = computeMissionMetrics(mission)
      setFraisForm({
        id_operation: String(missionId || ''),
        frais_transport_unitaire: Number(detail.frais_transport_voyage || 0),
        frais_hotel_unitaire: nuits > 0 ? Number(detail.frais_hotel || 0) / Math.max(1, nuits) : Number(detail.frais_hotel || 0),
        frais_deplacement_unitaire: durationDays > 0 ? Number(detail.frais_deplacement || 0) / durationDays : Number(detail.frais_deplacement || 0),
        frais_mission_unitaire: durationDays > 0 ? Number(detail.frais_nutrition || 0) / durationDays : Number(detail.frais_nutrition || 0),
        justificatif: detail.justificatif || detail.motif || ''
      })
      setFraisEditMode(true)
      setFraisEditId(detail.id_operation)
      setFormError('')
      setFormSuccess('')
      setShowForm(true)
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Erreur lors du chargement de la demande de frais')
      setShowForm(true)
    }
  }

  async function submitFrais(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!fraisForm.id_operation) { setFormError('Veuillez sélectionner une mission'); return }
    try {
      if (fraisEditMode && fraisEditId) {
        await api.put(`/api/missions/frais/${fraisEditId}/modifier`, null, {
          params: { frais_transport: fraisMissionCalculs.frais_transport_total, frais_hotel: fraisMissionCalculs.frais_hotel_total, frais_deplacement: fraisMissionCalculs.frais_deplacement_total, frais_nutrition: fraisMissionCalculs.frais_mission_total, justificatif: fraisForm.justificatif || null }
        })
        setFormSuccess('Demande de frais modifiée avec succès')
      } else {
        await api.post(`/api/missions/${fraisForm.id_operation}/demande-frais`, null, {
          params: { matricule, frais_transport: fraisMissionCalculs.frais_transport_total, frais_hotel: fraisMissionCalculs.frais_hotel_total, frais_deplacement: fraisMissionCalculs.frais_deplacement_total, frais_nutrition: fraisMissionCalculs.frais_mission_total, justificatif: fraisForm.justificatif || null }
        })
        setFormSuccess('Demande de frais soumise avec succès')
      }
      resetFraisForm()
      await loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la demande de frais') }
  }

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_demande || item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = normalizeText(normalizeListStatus(item.statut || item.status || 'en attente'))
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Frais mission').toLowerCase()
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

  const handleAnnuler = async (id) => {
    if (!confirm('Annuler cette demande ?')) return
    try {
      await api.delete(`/api/missions/frais/${id}`)
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
      const response = await api.post(`/api/missions/activation/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
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
      const response = await api.post(`/api/missions/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur clôture: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleRetourAnticipe = async (id) => {
    if (!confirm('Confirmer le retour anticipé ? Les jours restants seront restitués au solde.')) return
    setLoadingOp(id)
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await api.post(`/api/missions/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule, retour_anticipe: true, date_retour_anticipe: today } })
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
      const response = await api.post(`/api/missions/activation/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
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
      const response = await api.post(`/api/missions/cloture/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
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
    const isValid = isValidated(item.statut || item.status) || item.validation_terminee
    const etat = rowEtat[id] || '--'
    const isLoading = loadingOp === id
    const btnStyle = (base) => ({ ...base, opacity: isLoading ? 0.6 : 1 })

    if (isRecu) {
      const canApprove = !isValid && item.__workflow_bucket === 'recu'
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'validé') }} style={okBtn} disabled={isLoading}>Approuver</button>}
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'refusé') }} style={dangerBtn} disabled={isLoading}>Refuser</button>}
          {estRh && isValid && etat === 'AttenteRH' && <button onClick={(e) => { e.stopPropagation(); handleActiverRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>}
          {estRh && isValid && etat === 'Active' && <button onClick={(e) => { e.stopPropagation(); handleCloturerRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>}
        </div>
      )
    }

    if (!isValid) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleEditFrais(item) }} style={primaryBtn}>Modifier</button>
          <button onClick={(e) => { e.stopPropagation(); handleAnnuler(id) }} style={dangerBtn}>Annuler</button>
        </div>
      )
    }

    if (etat === '--') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleActiver(id) }} style={btnStyle(okBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button></div>
    }

    if (etat === 'AttenteRH') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente RH</span></div>
    }

    if (etat === 'Active') {
      const dateFin = item.date_fin || item.date_retour
      const canRetourAnticipe = dateFin && new Date() < new Date(dateFin)
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleCloturer(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>{canRetourAnticipe && <button onClick={(e) => { e.stopPropagation(); handleRetourAnticipe(id) }} style={btnStyle({ ...primaryBtn, background: '#3b82f6' })} disabled={isLoading}>{isLoading ? '…' : 'Retour anticipé'}</button>}</div>
    }

    if (etat === 'ClotureDemandee') {
      return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente confirmation RH</span>
    }

    return null
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={isRecu ? 11 : 10} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_operation} onClick={() => setSelectedOperationForWorkflow(item.id_operation)} style={{ cursor: 'pointer' }}>
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{item.motif || `Frais mission #${item.id_operation}`}</span>
            <ModifiedBadge estModifie={item.est_modifie} dateModification={item.date_modification} />
          </div>
        </td>
        <td style={td}>{missionLabel(item)}</td>
        <td style={td}>{isRecu ? 'Approbations' : 'Frais mission'}</td>
        <td style={td}>
          <span
            title={item.dernier_validateur_nom && item.derniere_validation_date ? `${item.dernier_validateur_nom} — ${fmtDateTime(item.derniere_validation_date)}` : undefined}
            style={{ cursor: item.dernier_validateur_nom ? 'help' : 'default' }}
          >
            {renderStatusBadge(normalizeListStatus(item.statut || item.status || 'en attente'))}
          </span>
        </td>
        <td style={td}>{fmtDate(item.date_demande || item.date_creation || item.created_at || item.date_debut)}</td>
        {isRecu && <td style={td}>{getEmitterName(item, true, senderName)}</td>}
        <td style={td}>{fmtDate(item.date_debut)}</td>
        <td style={td}>{fmtDate(item.date_fin)}</td>
        <td style={td}>{durationDays(item.date_debut, item.date_fin)}</td>
        <td style={td}>{(() => {
          const etat = rowEtat[item.id_operation] || '--'
          const makeBadge = (label, color, tooltip) => {
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
            return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{makeBadge('Activé', '#10b981', activTooltip)}{makeBadge('Clôture en att. RH', '#f59e0b', clotTooltip)}</div>
          }
          if (etat === 'Cloturee') {
            const clotParts = []
            if (item.cloture_date_demandeur) clotParts.push(`Demandeur: ${fmtDateTime(item.cloture_date_demandeur)}`)
            if (item.cloture_date_rh) clotParts.push(`RH: ${fmtDateTime(item.cloture_date_rh)}`)
            return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{makeBadge('Activé', '#10b981', activTooltip)}{makeBadge('Clôturé', '#6366f1', clotParts.length ? clotParts.join('\n') : null)}</div>
          }
          if (etat === 'Active') return makeBadge('Activé', '#10b981', activTooltip)
          if (etat === 'AttenteRH') return makeBadge('En att. RH', '#f59e0b', item.activation_date_demandeur ? `Demandeur: ${fmtDateTime(item.activation_date_demandeur)}` : null)
          return makeBadge('--', '#64748b', null)
        })()}</td>
        <td style={td}>{renderActionButtons(item, isRecu)}</td>
      </tr>
    ))
  }

  if (loading) return <div style={{ padding: 28 }}>Chargement...</div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>Frais de Mission</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowUploadSection(true); setShowForm(false) }} style={{ padding: '9px 14px', background: '#fff', color: '#334155', border: '1.5px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={15} /> Téléverser preuves</button>
          <button onClick={() => { resetFraisForm(); setShowForm(true); setFormError(''); setFormSuccess(''); setShowUploadSection(false) }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{fraisEditMode ? 'Modifier la demande de frais de mission' : 'Nouvelle demande de frais de mission'}</strong>
            <button onClick={() => { setShowForm(false); resetFraisForm() }} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          </div>
          {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}

          <form className="form-card" onSubmit={submitFrais}>
            <h3>{fraisEditMode ? 'Modifier la demande de frais de mission' : 'Demande de frais de mission'}</h3>
            <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #ffc107', display:'flex', alignItems:'flex-start', gap:6 }}>
              <AlertTriangle size={13} style={{flexShrink:0, marginTop:2}}/> <span><strong>Important:</strong> Vous ne pouvez demander les frais qu'après validation complète de votre mission par tous les validateurs.</span>
            </div>
            <div className="form-group">
              <label>Mission (ID opération)</label>
              <select value={fraisForm.id_operation} onChange={(e) => setFraisForm({ ...fraisForm, id_operation: e.target.value })} required disabled={fraisEditMode}>
                <option value="">Sélectionner une mission</option>
                {missions.filter(m => {
                  const statut = missionStatuts[m.id_operation]
                  const isCurrentEditMission = fraisEditMode && Number(fraisForm.id_operation || 0) === m.id_operation
                  return statut?.validation_complete && (!statut?.frais_deja_demandes || isCurrentEditMission)
                }).map(m => (<option key={m.id_operation} value={m.id_operation}>#{m.id_operation} — {m.mission_comment || `${m.pays}, ${m.ville || 'N/A'}`} (Validée)</option>))}
              </select>
              {missions.filter(m => missionStatuts[m.id_operation]?.validation_complete).length === 0 && <p style={{ fontSize: '0.85em', color: '#666', marginTop: '8px' }}>Aucune mission validée disponible</p>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Frais transport (prix unitaire en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_transport_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_transport_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_transport_total.toFixed(2)} FCFA (payé une fois)</p>
              </div>
              <div className="form-group">
                <label>Frais hôtel (prix unitaire/nuit en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_hotel_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_hotel_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_hotel_total.toFixed(2)} FCFA pour {fraisMissionCalculs.nuits} nuit{fraisMissionCalculs.nuits > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Frais déplacement (prix unitaire/jour en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_deplacement_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_deplacement_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_deplacement_total.toFixed(2)} FCFA pour {fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}</p>
              </div>
              <div className="form-group">
                <label>Frais mission (prix unitaire/jour en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_mission_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_mission_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_mission_total.toFixed(2)} FCFA pour {fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="form-group">
              <label>Justificatif</label>
              <textarea value={fraisForm.justificatif} onChange={(e) => setFraisForm({ ...fraisForm, justificatif: e.target.value })} placeholder="Description des frais engagés..." />
            </div>
            <div style={{ background: '#dbeafe', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9' }}>
              <div style={{ marginBottom: '8px' }}>
                <p style={{margin: '0 0 8px 0', fontSize: '0.9rem', display:'flex', alignItems:'center', gap:5}}><ClipboardList size={12}/> <strong>Récapitulatif des frais:</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Transport: <strong>{fraisMissionCalculs.frais_transport_total.toFixed(2)} FCFA</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Hôtel ({fraisMissionCalculs.nuits} nuit{fraisMissionCalculs.nuits > 1 ? 's' : ''}): <strong>{fraisMissionCalculs.frais_hotel_total.toFixed(2)} FCFA</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Déplacement ({fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}): <strong>{fraisMissionCalculs.frais_deplacement_total.toFixed(2)} FCFA</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Frais mission ({fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}): <strong>{fraisMissionCalculs.frais_mission_total.toFixed(2)} FCFA</strong></p>
              </div>
              <div style={{borderTop: '1px solid #0ea5e9', paddingTop: '10px', marginTop: '10px'}}>
                <p style={{margin: 0, fontSize: '1rem'}}><strong>TOTAL GÉNÉRAL: {fraisMissionCalculs.total_general.toFixed(2)} FCFA</strong></p>
              </div>
            </div>
            <button className="btn btn-success" type="submit" disabled={!fraisForm.id_operation}>{fraisEditMode ? 'Enregistrer les modifications' : 'Soumettre demande de frais'}</button>
          </form>
        </div>
      )}

      {showUploadSection && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowUploadSection(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Téléversement de preuves de frais</strong>
            <button onClick={() => setShowUploadSection(false)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
          </div>
          {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}
          <form className="form-card" onSubmit={async (e) => {
            e.preventDefault(); setFormError(''); setFormSuccess('')
            if (!preuveUpload.id_frais || !preuveUpload.file) { setFormError('Veuillez renseigner l\'ID frais et le fichier'); return }
            const fd = new FormData(); fd.append('fichier', preuveUpload.file)
            try {
              await api.post(`/api/missions/frais/${preuveUpload.id_frais}/televerser-preuves`, fd, { params: { type_preuve: preuveUpload.type_preuve }, headers: { 'Content-Type': 'multipart/form-data' } })
              setFormSuccess(`Preuve ${preuveUpload.type_preuve} téléversée avec succès!`)
              setPreuvesFraisEnCours(prev => [...prev, { type_preuve: preuveUpload.type_preuve, file: preuveUpload.file.name }])
              setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null })
            } catch (err) { setFormError(err.response?.data?.detail || 'Erreur téléversement preuve') }
          }}>
            <h3>Téléversement preuves frais de mission</h3>
            <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}><p style={{margin: 0, fontSize: '0.9rem', color: '#92400e'}}><strong>Important:</strong> La demande de frais doit être associée à une mission <strong>validée et activée</strong>.</p></div>
            <div className="form-group"><label>ID Frais</label><input value={preuveUpload.id_frais} onChange={(e) => setPreuveUpload({ ...preuveUpload, id_frais: e.target.value })} required placeholder="Entrez l'ID de la demande de frais" /></div>
            <div className="form-group"><label>Type de preuve</label>
              <select value={preuveUpload.type_preuve} onChange={(e) => setPreuveUpload({ ...preuveUpload, type_preuve: e.target.value })} required>
                <option value="facture">Facture</option><option value="recu">Reçu</option><option value="ticket">Ticket</option><option value="bordereau">Bordereau</option><option value="quittance">Quittance</option><option value="autre">Autre</option>
              </select>
            </div>
            <div className="form-group"><label>Fichier preuve</label><input type="file" onChange={(e) => setPreuveUpload({ ...preuveUpload, file: e.target.files[0] || null })} required /></div>
            <button className="btn btn-success" type="submit" disabled={!preuveUpload.id_frais || !preuveUpload.file}>Téléverser preuve</button>
          </form>
          {preuvesFraisEnCours.length > 0 && (
            <div className="form-card" style={{background: '#d1e7dd', border: '1px solid #badbcc', marginTop: 12}}>
              <h3 style={{color: '#0f5132', margin: '0 0 12px 0', display:'flex', alignItems:'center', gap:6}}><CheckCircle size={14}/> Preuves téléversées ({preuvesFraisEnCours.length})</h3>
              <ul style={{margin: 0, paddingLeft: '20px'}}>{preuvesFraisEnCours.map((p, idx) => (<li key={idx} style={{color: '#1a5e3b', marginBottom: '8px'}}><FileText size={11} style={{marginRight:4}}/><strong>{p.type_preuve}</strong> — {p.file}</li>))}</ul>
            </div>
          )}
        </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs active={activeTab} setActive={tab => { setActiveTab(tab); setFilterDate(''); setFilterStatut(''); setFilterSource(''); setFilterEmetteur(''); setFilterEtat('') }} counts={{ envoye: workflowEnvoye.length, recu: recu.length }} />
        <FilterBar date={filterDate} setDate={setFilterDate} statut={filterStatut} setStatut={setFilterStatut} source={filterSource} setSource={setFilterSource} emetteur={filterEmetteur} setEmetteur={setFilterEmetteur} etat={filterEtat} setEtat={setFilterEtat} />
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '13%' }}>Titre de demande</th>
              <th style={{ ...th, width: '12%' }}>Mission</th>
              <th style={{ ...th, width: '8%' }}>Source</th>
              <th style={{ ...th, width: '8%' }}>Statut</th>
              <th style={{ ...th, width: '8%' }}>Date creation</th>
              {activeTab !== 'envoye' && <th style={{ ...th, width: '9%' }}>Envoye par</th>}
              <th style={{ ...th, width: '7%' }}>Date depart</th>
              <th style={{ ...th, width: '7%' }}>Date retour</th>
              <th style={{ ...th, width: '5%' }}>Duree</th>
              <th style={{ ...th, width: '5%' }}>Etat</th>
              <th style={{ ...th, width: '18%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>{activeTab === 'envoye' ? renderRows(envoye, false) : renderRows(recu, true)}</tbody>
        </table>
      </div>
      {selectedOperationForWorkflow && (
        <WorkflowModal
          isOpen={!!selectedOperationForWorkflow}
          operationId={selectedOperationForWorkflow}
          onClose={() => setSelectedOperationForWorkflow(null)}
        />
      )}
    </div>
  )
}
