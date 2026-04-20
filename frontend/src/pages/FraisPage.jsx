import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import WorkflowModal from '../components/WorkflowModal'
import ModifiedBadge from '../components/ModifiedBadge'
import { missionDestLabel, fraisLabel } from '../utils/operationLabel'
import '../styles/Operations.css'
import { ClipboardList, AlertTriangle, FileText, CheckCircle, Upload, Eye, Banknote, Clock, Download, Trash2 } from 'lucide-react'

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const errMsg = (err, fallback = 'Une erreur est survenue') => {
  const d = err?.response?.data?.detail
  if (!d) return err?.message || fallback
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map(e => e?.msg || JSON.stringify(e)).join(' ; ')
  return fallback
}
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
const missionLabel = (item) => missionDestLabel(item)
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
      <input type="text" value={emetteur} onChange={e => setEmetteur(e.target.value)} placeholder="Émetteur" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={etat} onChange={e => setEtat(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }}>
        <option value="">Tous États</option>
        {['--', 'AttenteRH', 'Active', 'ClotureDemandee', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>{"Réinitialiser"}</button>}
    </div>
  )
}

function PreuvesModal({ idOperation, matricule, estMissionnaire, onClose, onUploaded }) {
  const [preuves, setPreuves] = React.useState([])
  const [idFrais, setIdFrais] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [typePreuve, setTypePreuve] = React.useState('facture')
  const [error, setError] = React.useState('')
  const fileRef = React.useRef(null)

  const charger = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/missions/frais/${idOperation}`)
      setIdFrais(res.data.id_frais)
      setPreuves(Array.isArray(res.data.preuves_paiement) ? res.data.preuves_paiement : [])
    } catch { setPreuves([]) }
    finally { setLoading(false) }
  }

  React.useEffect(() => { charger() }, [idOperation])

  const buildUrl = (chemin) => {
    const base = (api.defaults?.baseURL || '').replace(/\/$/, '')
    return `${base}/${(chemin || '').replace(/^\//, '').replace(/^api\//, '')}`
  }

  const uploader = async (e) => {
    e.preventDefault()
    const files = fileRef.current?.files
    if (!files || !files.length || !idFrais) { setError("Veuillez sélectionner un fichier"); return }
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('fichier', files[0])
      await api.post(`/api/missions/frais/${idFrais}/televerser-preuves`, fd, { params: { type_preuve: typePreuve, matricule }, headers: { 'Content-Type': 'multipart/form-data' } })
      if (fileRef.current) fileRef.current.value = ''
      await charger()
      onUploaded()
    } catch (err) {
      setError(errMsg(err, "Erreur lors du téléversement"))
    } finally { setUploading(false) }
  }

  const fmtDt = (v) => v ? new Date(v).toLocaleString('fr-FR') : ''

  const supprimerPreuve = async (index) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce justificatif ?")) return
    setError('')
    try {
      await api.delete(`/api/missions/frais/${idFrais}/supprimer-preuve`, { params: { matricule, index } })
      await charger()
      onUploaded()
    } catch (err) {
      setError(errMsg(err, "Erreur lors de la suppression"))
    }
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 540, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={16} style={{ color: '#475569' }} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{"Justificatifs de paiement"}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Frais #{idOperation}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '1rem', fontWeight: 700 }}>✕</button>
        </div>
        <div style={{ padding: '16px 22px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.85rem' }}>{"Chargement..."}</div>
          ) : preuves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#cbd5e1', fontSize: '0.85rem' }}>
              <FileText size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              {"Aucun justificatif"}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preuves.map((p, i) => {
                const chemin = typeof p === 'string' ? p : (p.fichier || p.chemin_fichier || p.chemin || p.path || '')
                const typeP = typeof p === 'object' ? (p.type_preuve || p.type || '') : ''
                const date = typeof p === 'object' ? (p.date_telechargement || p.date_upload || p.date || null) : null
                const fileName = chemin.split('/').pop() || chemin
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9' }}>
                    <FileText size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>{fileName}</div>
                      {typeP && <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{typeP}</div>}
                    </div>
                    {date && <span style={{ fontSize: '0.71rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDt(date)}</span>}
                    <a href={buildUrl(chemin)} download title="Télécharger" style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', textDecoration: 'none', flexShrink: 0 }}><Download size={13} /></a>
                    <a href={buildUrl(chemin)} target="_blank" rel="noopener noreferrer" title="Voir" style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', textDecoration: 'none', flexShrink: 0 }}><Eye size={13} /></a>
                    {estMissionnaire && <button onClick={() => supprimerPreuve(i)} title="Supprimer" style={{ width: 30, height: 30, border: '1px solid #fecaca', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={13} /></button>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {estMissionnaire && <div style={{ padding: '14px 22px 20px', borderTop: '1px solid #f1f5f9' }}>
          <form onSubmit={uploader} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{"Ajouter un justificatif"}</label>
            <select value={typePreuve} onChange={(e) => setTypePreuve(e.target.value)} style={{ fontSize: '0.82rem', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              <option value="facture">Facture</option>
              <option value="recu">Reçu</option>
              <option value="ticket">Ticket</option>
              <option value="transport">Transport</option>
              <option value="hotel">Hôtel</option>
              <option value="autre">Autre</option>
            </select>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ fontSize: '0.82rem', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: 8, cursor: 'pointer', color: '#475569', background: '#f8fafc' }} />
            {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={uploading || !idFrais} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: (uploading || !idFrais) ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: (uploading || !idFrais) ? 'not-allowed' : 'pointer', fontSize: '0.82rem', alignSelf: 'flex-start' }}>
              <Upload size={14} />{uploading ? "Téléversement..." : "Téléverser"}
            </button>
          </form>
        </div>}
      </div>
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
  const [detailFraisData, setDetailFraisData] = useState(null)
  const [preuveModalOp, setPreuveModalOp] = useState(null)
  const [fraisPaymentStatuts, setFraisPaymentStatuts] = useState({}) // frais op id → {id_mission, frais_payes, frais_valides_missionnaire, frais_valides_rh, date_paiement_frais}
  const [estMissionnaire, setEstMissionnaire] = useState(false)
  const [missionnaireMissions, setMissionnaireMissions] = useState([])
  const [preuveUploadMissionId, setPreuveUploadMissionId] = useState('')

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const opId = searchParams.get('operationId')
    if (opId) setSelectedOperationForWorkflow(Number(opId))
    const tab = searchParams.get('tab')
    if (tab === 'recu' || tab === 'envoye') setActiveTab(tab)
  }, [])
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
      const missionnaireRaw = Array.isArray(r3.data) ? r3.data : []
      setEstMissionnaire(missionnaireRaw.length > 0)
      setMissionnaireMissions(missionnaireRaw)
      const allMissions = [
        ...initiatorMissions,
        ...missionnaireRaw.filter(m => !initiatorMissions.find(x => x.id_operation === m.id_operation))
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
  useAutoRefresh(loadData)

  // Charger statut paiement pour chaque item frais du workflow
  useEffect(() => {
    const allItems = [...workflowEnvoye, ...workflowAValider, ...workflowValide, ...workflowRefuse]
    allItems.forEach(async (item) => {
      if (item.id_operation && !fraisPaymentStatuts[item.id_operation]) {
        try {
          const res = await api.get(`/api/missions/frais/${item.id_operation}`)
          const d = res.data
          setFraisPaymentStatuts(prev => ({
            ...prev,
            [item.id_operation]: {
              id_mission: d.id_mission,
              frais_payes: d.frais_payes,
              frais_valides_missionnaire: d.frais_valides_missionnaire,
              frais_valides_rh: d.frais_valides_rh,
              date_paiement_frais: d.date_paiement_frais,
              preuves_paiement: Array.isArray(d.preuves_paiement) ? d.preuves_paiement : [],
            }
          }))
        } catch {}
      }
    })
  }, [workflowEnvoye, workflowAValider, workflowValide, workflowRefuse])

  async function openFraisDetail(e, id) {
    e.stopPropagation()
    setDetailFraisData(null)
    try {
      const res = await api.get(`/api/missions/frais/${id}`)
      setDetailFraisData(res.data)
    } catch {
      setDetailFraisData({ error: true })
    }
  }

  async function openFraisSimple(e, id) {
    e.stopPropagation()
    setDetailFraisData(null)
    try {
      const res = await api.get(`/api/missions/frais/${id}`)
      setDetailFraisData({ ...res.data, _simple: true })
    } catch {
      setDetailFraisData({ error: true })
    }
  }

  async function confirmerPaiementMissionnaire(idMission) {
    if (!confirm('Confirmer votre accord pour le paiement des frais ?')) return
    try {
      await api.post(`/api/missions/${idMission}/valider-frais-missionnaire`, { matricule })
      await loadData()
      setFraisPaymentStatuts({})
    } catch (err) {
      alert('Erreur: ' + errMsg(err, err.message))
    }
  }

  async function confirmerPaiementRH(idMission) {
    if (!confirm('Confirmer le paiement des frais de cette mission ?')) return
    try {
      await api.post(`/api/missions/${idMission}/valider-paiement-rh`, { matricule })
      await loadData()
      setFraisPaymentStatuts({})
    } catch (err) {
      alert('Erreur: ' + errMsg(err, err.message))
    }
  }

  // Pré-remplir la mission depuis le query param mission_id (lien de notification)
  useEffect(() => {
    const missionId = searchParams.get('mission_id')
    if (missionId && missions.length > 0) {
      setFraisForm(prev => ({ ...prev, id_operation: missionId }))
      setShowForm(true)
      setFormError('')
      setFormSuccess('')
    }
  }, [searchParams, missions])

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
      setFormError(errMsg(err, 'Erreur lors du chargement de la demande de frais'))
      setShowForm(true)
    }
  }

  async function handleMissionPreuveSelect(id_mission) {
    setPreuveUploadMissionId(id_mission)
    setPreuveUpload(p => ({ ...p, id_frais: '' }))
    if (!id_mission) return
    try {
      const res = await api.get(`/api/missions/${id_mission}/statut-paiement-frais`)
      if (res.data?.id_frais) setPreuveUpload(p => ({ ...p, id_frais: String(res.data.id_frais) }))
      else setFormError('Aucune demande de frais associée à cette mission')
    } catch (err) { setFormError(errMsg(err, 'Erreur chargement frais')) }
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
    } catch (err) { setFormError(errMsg(err, 'Erreur lors de la demande de frais')) }
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
      alert('Erreur: ' + errMsg(err, err.message))
    }
  }

  const handleActiver = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/missions/activation/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur activation: ' + errMsg(err, err.message))
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
      alert('Erreur clôture: ' + errMsg(err, err.message))
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
      alert('Erreur retour anticipé: ' + errMsg(err, err.message))
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
      alert('Erreur activation RH: ' + errMsg(err, err.message))
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
      alert('Erreur clôture RH: ' + errMsg(err, err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const renderActionButtons = (item, isRecu) => {
    const id = item.id_operation
    const isValid = isValidated(item.statut || item.status) || item.validation_terminee
    const isLoading = loadingOp === id
    const ps = fraisPaymentStatuts[id]
    const eyeBtn = <button key="eye" onClick={(e) => openFraisDetail(e, id)} style={{ ...rowBtn, background: '#6366f1' }} title="Voir détails"><Eye size={12} /></button>

    // Affiche le bouton de confirmation de paiement si disponible
    const paiementBtn = (() => {
      if (!ps) return null
      if (ps.frais_payes) return null
      if (!isValidated(item.statut || item.status)) return null
      const idMission = ps.id_mission
      if (!ps.frais_valides_missionnaire) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); confirmerPaiementMissionnaire(idMission) }}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', border: '1.5px solid #16a34a',
              borderRadius: 6, fontWeight: 700, cursor: 'pointer',
              fontSize: '0.72rem', color: '#fff',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              boxShadow: '0 2px 6px rgba(22,163,74,0.35)',
            }}
          >
            <Banknote size={13} /> Confirmer réception
          </button>
        )
      }
      if (ps.frais_valides_missionnaire && !ps.frais_valides_rh) {
        if (estRh) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); confirmerPaiementRH(idMission) }}
              disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', border: '1.5px solid #1d4ed8',
                borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                fontSize: '0.72rem', color: '#fff',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                boxShadow: '0 2px 6px rgba(29,78,216,0.35)',
              }}
            >
              <Banknote size={13} /> Valider paiement (RH)
            </button>
          )
        }
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d' }}>
            <Clock size={10} /> En att. conf. RH
          </span>
        )
      }
      return null
    })()

    if (isRecu) {
      const canApprove = !isValid && item.__workflow_bucket === 'recu'
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'validé') }} style={okBtn} disabled={isLoading}>{"Approuver"}</button>}
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'refusé') }} style={dangerBtn} disabled={isLoading}>{"Refuser"}</button>}
          {paiementBtn}
          {eyeBtn}
        </div>
      )
    }

    if (!isValid) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleEditFrais(item) }} style={primaryBtn}>{"Modifier"}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAnnuler(id) }} style={dangerBtn}>{"Annuler"}</button>
          {eyeBtn}
        </div>
      )
    }

    return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{paiementBtn}{eyeBtn}</div>
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={isRecu ? 12 : 11} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_operation} onClick={() => setSelectedOperationForWorkflow(item.id_operation)} style={{ cursor: 'pointer' }}>
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{fraisLabel(item)}</span>
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
        <td style={td} onClick={(e) => e.stopPropagation()}>{(() => {
          const ps = fraisPaymentStatuts[item.id_operation]
          if (!isValidated(item.statut || item.status) && !item.validation_terminee) return <span style={{ color: '#9ca3af' }}>—</span>
          if (!ps) return <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>…</span>
          if (ps.frais_payes) {
            const tooltip = ps.date_paiement_frais ? `Payé le ${fmtDateTime(ps.date_paiement_frais)}` : 'Voir détails'
            return <span onClick={(e) => openFraisSimple(e, item.id_operation)} title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}><Banknote size={10}/>Payé</span>
          }
          if (ps.frais_valides_missionnaire && !ps.frais_valides_rh) {
            return <span onClick={(e) => openFraisSimple(e, item.id_operation)} title="Voir détails" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', cursor: 'pointer' }}><Clock size={10}/>Att. conf. RH</span>
          }
          return <span onClick={(e) => openFraisSimple(e, item.id_operation)} title="Voir détails" style={{ padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', cursor: 'pointer' }}>Impayé</span>
        })()}</td>
        <td style={{ ...td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>{(() => {
          const ps = fraisPaymentStatuts[item.id_operation]
          if (!ps) return <span title="Cliquez pour ajouter des preuves" onClick={() => setPreuveModalOp(item.id_operation)} style={{ color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline dotted' }}>—</span>
          const _preuves = ps.preuves_paiement || []
          if (_preuves.length === 0) return <span title="Cliquez pour ajouter des preuves" onClick={() => setPreuveModalOp(item.id_operation)} style={{ color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline dotted' }}>—</span>
          const _latest = _preuves.reduce((max, p) => { const d = typeof p === 'object' ? (p.date_telechargement || p.date_upload || p.date || null) : null; return d && (!max || d > max) ? d : max }, null)
          const _tip = _latest ? `${_preuves.length} preuve${_preuves.length > 1 ? 's' : ''} — Dernier: ${new Date(_latest).toLocaleString('fr-FR')}` : `${_preuves.length} preuve${_preuves.length > 1 ? 's' : ''}`
          return <span title={_tip} onClick={() => setPreuveModalOp(item.id_operation)} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}>✓ Téléversées</span>
        })()}</td>
        <td style={td}>{renderActionButtons(item, isRecu)}</td>
      </tr>
    ))
  }

  if (loading) return <div style={{ padding: 28 }}>{"Chargement..."}</div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>{"Frais de mission"}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowUploadSection(true); setShowForm(false); setPreuveUploadMissionId(''); setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null }) }} style={{ padding: '9px 14px', background: '#fff', color: '#334155', border: '1.5px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={15} /> Téléverser preuves</button>
          <button onClick={() => { resetFraisForm(); setShowForm(true); setFormError(''); setFormSuccess(''); setShowUploadSection(false) }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Ajouter"}</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{fraisEditMode ? 'Modifier la demande de frais de mission' : 'Nouvelle demande de frais de mission'}</strong>
            <button onClick={() => { setShowForm(false); resetFraisForm() }} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Annuler"}</button>
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
            <button onClick={() => setShowUploadSection(false)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Fermer"}</button>
          </div>
          {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}
          <form className="form-card" onSubmit={async (e) => {
            e.preventDefault(); setFormError(''); setFormSuccess('')
            if (!preuveUpload.id_frais || !preuveUpload.file) { setFormError('Veuillez renseigner l\'ID frais et le fichier'); return }
            const fd = new FormData(); fd.append('fichier', preuveUpload.file)
            try {
              await api.post(`/api/missions/frais/${preuveUpload.id_frais}/televerser-preuves`, fd, { params: { type_preuve: preuveUpload.type_preuve, matricule }, headers: { 'Content-Type': 'multipart/form-data' } })
              setFormSuccess(`Preuve ${preuveUpload.type_preuve} téléversée avec succès!`)
              setPreuvesFraisEnCours(prev => [...prev, { type_preuve: preuveUpload.type_preuve, file: preuveUpload.file.name }])
              setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null })
            } catch (err) { setFormError(errMsg(err, 'Erreur téléversement preuve')) }
          }}>
            <h3>Téléversement preuves frais de mission</h3>
            <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}><p style={{margin: 0, fontSize: '0.9rem', color: '#92400e'}}><strong>Important:</strong> La demande de frais doit être associée à une mission <strong>validée et activée</strong>.</p></div>
            <div className="form-group">
              <label>Mission (ID opération)</label>
              <select value={preuveUploadMissionId} onChange={(e) => handleMissionPreuveSelect(e.target.value)} required>
                <option value="">— Sélectionner une mission —</option>
                {missionnaireMissions.filter(m => m.a_des_frais).map(m => (
                  <option key={m.id_operation} value={m.id_operation}>
                    #{m.id_operation} — {m.pays || '?'}{m.ville ? ', ' + m.ville : ''}{m.mission_comment ? ' (' + m.mission_comment + ')' : ''}
                  </option>
                ))}
              </select>
              {missionnaireMissions.filter(m => m.a_des_frais).length === 0 &&
                <p style={{ fontSize: '0.82rem', color: '#92400e', marginTop: 6 }}>Aucune mission avec demande de frais disponible pour vous.</p>}
            </div>
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
              <th style={{ ...th, width: '8%' }}>{"Statut"}</th>
              <th style={{ ...th, width: '8%' }}>Date Création</th>
              {activeTab !== 'envoye' && <th style={{ ...th, width: '9%' }}>Envoyé Par</th>}
              <th style={{ ...th, width: '7%' }}>Date Départ</th>
              <th style={{ ...th, width: '7%' }}>Date Retour</th>
              <th style={{ ...th, width: '5%' }}>Durée</th>
              <th style={{ ...th, width: '7%' }}>{"Paiement des frais"}</th>
              <th style={{ ...th, width: '5%', textAlign: 'center' }}>Preuves</th>
              <th style={{ ...th, width: '14%' }}>{"Actions"}</th>
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

      {preuveModalOp && (
        <PreuvesModal
          idOperation={preuveModalOp}
          matricule={matricule}
          estMissionnaire={estMissionnaire}
          onClose={() => setPreuveModalOp(null)}
          onUploaded={() => { loadData(); setFraisPaymentStatuts({}); setPreuveModalOp(null) }}
        />
      )}

      {detailFraisData && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setDetailFraisData(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Détail des Frais de Mission</strong>
              <button onClick={() => setDetailFraisData(null)} style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{"Fermer"}</button>
            </div>
            {detailFraisData.error ? (
              <p style={{ color: '#dc2626' }}>Impossible de charger les détails.</p>
            ) : (() => {
              const _d = detailFraisData
              const _m = _d.mission || {}
              const _dateDebut = _m.date_debut ? new Date(_m.date_debut) : null
              const _dateFin = _m.date_fin ? new Date(_m.date_fin) : null
              const _nuits = (_dateDebut && _dateFin) ? Math.max(0, Math.round((_dateFin - _dateDebut) / 86400000)) : 0
              const _jours = (_dateDebut && _dateFin) ? Math.round((_dateFin - _dateDebut) / 86400000) + 1 : 0
              const _transport = Number(_d.frais_transport_voyage || 0)
              const _hotel = Number(_d.frais_hotel || 0)
              const _depl = Number(_d.frais_deplacement || 0)
              const _nutri = Number(_d.frais_nutrition || 0)
              const _total = Number(_d.total_frais || 0)
              const _fmt = n => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              const _transports = Array.isArray(_m.moyens_transport) ? _m.moyens_transport.join(', ') : (_m.moyens_transport || '—')
              const _sec = (txt) => (
                <div style={{ fontSize: '0.63rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 7, borderBottom: '1px solid #e2e8f0', paddingBottom: 3 }}>{txt}</div>
              )
              return (
                <>
                  <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', borderRadius: 8, padding: '14px 18px', marginBottom: 6, color: '#fff' }}>
                    <div style={{ fontSize: '0.68rem', opacity: 0.75, marginBottom: 2 }}>Mission #{_d.id_operation} · Frais de mission</div>
                    <div style={{ fontSize: '1.08rem', fontWeight: 800 }}>{_m.pays || '—'}{_m.ville ? ` — ${_m.ville}` : ''}</div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: 4 }}>
                      {fmtDate(_m.date_debut)} → {fmtDate(_m.date_fin)}
                      {_jours > 0 && <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>{_jours} j · {_nuits} nuit{_nuits !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '8px 2px', borderBottom: '1px solid #f1f5f9', marginBottom: 2 }}>
                    {renderStatusBadge(normalizeListStatus(_d.statut || 'en attente'))}
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Transport : <strong style={{ color: '#0f172a' }}>{_transports}</strong></span>
                    {_m.heure_retour && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Retour : <strong style={{ color: '#0f172a' }}>{_m.heure_retour}</strong></span>}
                  </div>
                  {!_d._simple && (_m.titre || _d.demandeur) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', padding: '8px 4px', background: '#f8fafc', borderRadius: 6, marginBottom: 4 }}>
                      {_d.demandeur && <div>
                        <span style={{ fontSize: '0.63rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Demandeur</span>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{_d.demandeur.prenom} {_d.demandeur.nom}</p>
                        {_d.demandeur.fonction && <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{_d.demandeur.fonction}</p>}
                      </div>}
                      {_m.titre && <div>
                        <span style={{ fontSize: '0.63rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Titre mission</span>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{_m.titre}</p>
                      </div>}
                    </div>
                  )}
                  {_sec('Détail des frais')}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ ...th, fontSize: '0.67rem' }}>Poste de frais</th>
                        <th style={{ ...th, fontSize: '0.67rem' }}>Base unitaire</th>
                        <th style={{ ...th, fontSize: '0.67rem' }}>Qté</th>
                        <th style={{ ...th, fontSize: '0.67rem', textAlign: 'right' }}>Total (FCFA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={td}>Transport / Voyage</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_fmt(_transport)} FCFA</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>forfait</td>
                        <td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_transport)}</td>
                      </tr>
                      <tr>
                        <td style={td}>Hôtel / Hébergement</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_nuits > 0 ? `${_fmt(Math.round(_hotel / _nuits))} FCFA/nuit` : `${_fmt(_hotel)} FCFA`}</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_nuits > 0 ? `${_nuits} nuit${_nuits !== 1 ? 's' : ''}` : '—'}</td>
                        <td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_hotel)}</td>
                      </tr>
                      <tr>
                        <td style={td}>Frais déplacement</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_fmt(Math.round(_depl / _jours))} FCFA/j` : `${_fmt(_depl)} FCFA`}</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_jours} jour${_jours !== 1 ? 's' : ''}` : '—'}</td>
                        <td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_depl)}</td>
                      </tr>
                      <tr>
                        <td style={td}>Per diem (nutrition)</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_fmt(Math.round(_nutri / _jours))} FCFA/j` : `${_fmt(_nutri)} FCFA`}</td>
                        <td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_jours} jour${_jours !== 1 ? 's' : ''}` : '—'}</td>
                        <td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_nutri)}</td>
                      </tr>
                      <tr style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderTop: '2px solid #16a34a' }}>
                        <td colSpan={3} style={{ ...td, fontWeight: 800, fontSize: '0.88rem', color: '#14532d' }}>TOTAL GÉNÉRAL</td>
                        <td style={{ ...td, fontWeight: 800, fontSize: '0.98rem', color: '#16a34a', textAlign: 'right' }}>{_fmt(_total)} FCFA</td>
                      </tr>
                    </tbody>
                  </table>
                  {_d.justificatif && (
                    <>
                      {_sec('Justificatif')}
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>{_d.justificatif}</div>
                    </>
                  )}
                  {_sec('État du paiement')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Confirmation missionnaire</span>
                      <p style={{ margin: '3px 0 0', fontSize: '0.8rem', fontWeight: 600 }}>
                        {_d.frais_valides_missionnaire
                          ? <span style={{ color: '#16a34a' }}>✓ Confirmé{_d.date_validation_frais_missionnaire ? ` le ${fmtDate(_d.date_validation_frais_missionnaire)}` : ''}</span>
                          : <span style={{ color: '#dc2626' }}>✗ En attente</span>}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Validation RH</span>
                      <p style={{ margin: '3px 0 0', fontSize: '0.8rem', fontWeight: 600 }}>
                        {_d.frais_valides_rh
                          ? <span style={{ color: '#16a34a' }}>✓ Validé{_d.date_validation_frais_rh ? ` le ${fmtDate(_d.date_validation_frais_rh)}` : ''}</span>
                          : <span style={{ color: '#dc2626' }}>✗ En attente</span>}
                      </p>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Statut paiement final</span>
                      <p style={{ margin: '3px 0 0' }}>
                        {_d.frais_payes
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#14532d', fontWeight: 800, fontSize: '0.9rem' }}><Banknote size={15}/> Payé{_d.date_paiement_frais ? ` le ${fmtDate(_d.date_paiement_frais)}` : ''}</span>
                          : _d.frais_valides_missionnaire
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#92400e', fontWeight: 700, fontSize: '0.82rem' }}><Clock size={13}/> En attente de validation RH</span>
                            : <span style={{ color: '#991b1b', fontWeight: 700, fontSize: '0.82rem' }}>Non payé</span>}
                      </p>
                    </div>
                  </div>
                  {!_d._simple && (() => {
                    const _preuves = Array.isArray(_d.preuves_paiement) ? _d.preuves_paiement : []
                    const _peuVoir = estRh || ['ADMIN','PCA','AG'].includes(roleUtilisateur) || String(user?.fonction || '').toUpperCase().includes('IG')
                    return (
                      <>
                        {_sec('Preuves de paiement téléversées')}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: _preuves.length > 0 ? '#f0fdf4' : '#fef9ec', border: `1px solid ${_preuves.length > 0 ? '#bbf7d0' : '#fde68a'}`, marginBottom: 6 }}>
                          {_preuves.length > 0
                            ? <span style={{ fontSize: '0.82rem', color: '#14532d', fontWeight: 700 }}>✓ {_preuves.length} preuve{_preuves.length > 1 ? 's' : ''} téléversée{_preuves.length > 1 ? 's' : ''}</span>
                            : <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>⚠ Aucune preuve de paiement téléversée</span>}
                        </div>
                        {_peuVoir && _preuves.length > 0 && (
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {_preuves.map((p, i) => {
                              const chemin = typeof p === 'string' ? p : (p.chemin_fichier || p.chemin || p.path || '')
                              const typePreuve = typeof p === 'object' ? (p.type_preuve || p.type || '') : ''
                              const fileName = chemin.split('/').pop() || chemin
                              return (
                                <li key={i} style={{ marginBottom: 4 }}>
                                  <a href={`/${chemin.replace(/^\//, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>
                                    {typePreuve ? `[${typePreuve}] ` : ''}{fileName}
                                  </a>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </>
                    )
                  })()}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
