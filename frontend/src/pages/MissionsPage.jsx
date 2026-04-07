import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import WorkflowModal from '../components/WorkflowModal'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import AutocompleteInput from '../components/AutocompleteInput'
import ModifiedBadge from '../components/ModifiedBadge'
import '../styles/Operations.css'
import {
  ClipboardList, AlertTriangle, FileText, Plus, Trash2, Pencil, Users, CheckCircle, Search, Upload, FileUp, Eye
} from 'lucide-react'

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }

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
const normalizeMissionsWorkflow = (rows, label, bucket) => (Array.isArray(rows) ? rows : [])
  .filter((item) => normalizeText(item?.type_demande) === 'mission')
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
      {[
        ['envoye', 'Envoye', counts.envoye],
        ['recu', 'Recu', counts.recu],
      ].map(([key, label, count]) => (
        <button
          key={key}
          onClick={() => setActive(key)}
          style={{
            flex: 1,
            padding: '10px 8px',
            border: 'none',
            cursor: 'pointer',
            background: active === key ? '#fff' : '#f9fafb',
            fontWeight: active === key ? 700 : 500,
            fontSize: '0.82rem',
            borderBottom: active === key ? '2px solid #ce2b2b' : '2px solid transparent',
            color: active === key ? '#ce2b2b' : '#6b7280',
          }}
        >
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

export default function MissionsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('envoye')
  const [items, setItems] = useState([])
  const [workflowEnvoye, setWorkflowEnvoye] = useState([])
  const [workflowAValider, setWorkflowAValider] = useState([])
  const [workflowValide, setWorkflowValide] = useState([])
  const [workflowRefuse, setWorkflowRefuse] = useState([])
  const [workflowPcaAg, setWorkflowPcaAg] = useState([])
  const [workflowMissionnaire, setWorkflowMissionnaire] = useState([])
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
  const peutInitierMission = useMemo(() => ['RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', 'PCA', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])

  // Form state
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [missionForm, setMissionForm] = useState({ motif: '', email_contact: '', mission_comment: '' })
  const [missionSegments, setMissionSegments] = useState([{ id: 1, pays: '', country_code: '', ville: '', date_debut: '', date_fin: '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
  const [countryOptionsBySegment, setCountryOptionsBySegment] = useState({})
  const [cityOptionsBySegment, setCityOptionsBySegment] = useState({})
  const [missionMissionnaires, setMissionMissionnaires] = useState([])
  const [rechercheEmploye, setRechercheEmploye] = useState('')
  const [employesTrouves, setEmployesTrouves] = useState([])
  const [missionEditMode, setMissionEditMode] = useState(false)
  const [missionEditId, setMissionEditId] = useState(null)
  const [missionStatuts, setMissionStatuts] = useState({})
  const [statutsPaiementFrais, setStatutsPaiementFrais] = useState({})
  const [rapportUpload, setRapportUpload] = useState({ id_operation: '', file: null })
  const [preuveUpload, setPreuveUpload] = useState({ id_frais: '', type_preuve: 'facture', file: null })
  const [preuvesFraisEnCours, setPreuvesFraisEnCours] = useState([])
  const [employe, setEmploye] = useState(null)
  const [selectedOperationForWorkflow, setSelectedOperationForWorkflow] = useState(null)
  const [activeUploadModal, setActiveUploadModal] = useState(null)
  const [detailMissionId, setDetailMissionId] = useState(null)
  const [detailData, setDetailData] = useState(null)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const opId = searchParams.get('operationId')
    if (opId) setSelectedOperationForWorkflow(Number(opId))
  }, [])

  const missionsById = useMemo(() => {
    const map = new Map()
    items.forEach((item) => {
      map.set(item.id_operation, item)
    })
    return map
  }, [items])

  async function loadData() {
    if (!user?.matricule) { setLoading(false); return }
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get(`/api/missions/mes-missions/${user.matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/boite/${user.matricule}`).catch(() => ({ data: {} })),
        api.get(`/api/missions/en-tant-que-missionnaire/${user.matricule}`).catch(() => ({ data: [] })),
      ])
      const sent = Array.isArray(r1.data) ? r1.data : []
      const boite = r2?.data || {}
      const missionnaireRaw = Array.isArray(r3.data) ? r3.data : []
      setItems(sent)
      const missionnaireItems = missionnaireRaw.map(m => ({
        ...m,
        type_demande: 'Mission',
        __workflow_label: 'Missionnaire',
        __workflow_bucket: 'missionnaire',
        titre: m.mission_comment || null,
        objet: `${m.pays || ''} - ${m.ville || 'N/A'}`,
        demandeur: { nom_complet: m.initiateur_nom },
        date_demande: m.date_debut,
      }))
      const envoyeNorm = normalizeMissionsWorkflow(boite.envoye, 'Envoyée', 'envoye')
      const aValiderNorm = normalizeMissionsWorkflow(boite.recu, 'À valider', 'recu')
      const valideNorm = normalizeMissionsWorkflow(boite.valide, 'Validée par moi', 'valide')
      const refuseNorm = normalizeMissionsWorkflow(boite.refuse, 'Refusée par moi', 'refuse')
      const pcaAgRaw = (boite.recu_pca_ag || []).filter(o => (o.type_demande || '').toLowerCase().includes('mission'))
      const pcaAgNorm = normalizeMissionsWorkflow(pcaAgRaw, 'PCA/AG', 'recu_pca_ag')
      setWorkflowEnvoye(envoyeNorm)
      setWorkflowAValider(aValiderNorm)
      setWorkflowValide(valideNorm)
      setWorkflowRefuse(refuseNorm)
      setWorkflowPcaAg(pcaAgNorm)
      setWorkflowMissionnaire(missionnaireItems)
      setRowEtat(initRowEtatFromApi([...envoyeNorm, ...aValiderNorm, ...valideNorm, ...refuseNorm]))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user?.matricule])

  // Actualisation automatique toutes les 30 secondes
  useAutoRefresh(loadData)

  useEffect(() => {
    if (!matricule) return
    api.get(`/employees/${matricule}`).then(r => setEmploye(r.data || {})).catch(() => setEmploye({ solde_conges: 0 }))
  }, [matricule])

  useEffect(() => {
    if (items.length > 0) {
      items.forEach(async m => {
        if (m.id_operation) {
          try {
            const res = await api.get(`/api/missions/${m.id_operation}/statut-mission`)
            setMissionStatuts(prev => ({ ...prev, [m.id_operation]: res.data }))
          } catch {}
          try {
            const res = await api.get(`/api/missions/${m.id_operation}/statut-paiement-frais`)
            setStatutsPaiementFrais(prev => ({ ...prev, [m.id_operation]: res.data }))
          } catch {}
        }
      })
    }
  }, [items])

  async function rechercherEmployes(term) {
    setRechercheEmploye(term)
    if (term.length < 2) { setEmployesTrouves([]); return }
    try {
      const res = await api.get('/api/missions/rechercher-employes', { params: { q: term } })
      setEmployesTrouves(res.data.employes || [])
    } catch { setEmployesTrouves([]) }
  }
  function ajouterMissionnaire(emp) {
    if (!missionMissionnaires.find(m => m.matricule === emp.matricule)) setMissionMissionnaires([...missionMissionnaires, emp])
    setRechercheEmploye(''); setEmployesTrouves([])
  }
  function retirerMissionnaire(mat) { setMissionMissionnaires(missionMissionnaires.filter(m => m.matricule !== mat)) }
  function ajouterSegmentMission() {
    const nouveauId = Math.max(...missionSegments.map(s => s.id), 0) + 1
    setMissionSegments([...missionSegments, { id: nouveauId, pays: '', country_code: '', ville: '', date_debut: '', date_fin: '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
  }
  function supprimerSegmentMission(id) {
    if (missionSegments.length <= 1) { alert('Au moins une destination est requise'); return }
    setMissionSegments(missionSegments.filter(s => s.id !== id))
    setCountryOptionsBySegment(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setCityOptionsBySegment(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }
  function updateSegmentMission(id, field, value) {
    setMissionSegments(missionSegments.map(seg => {
      if (seg.id !== id) return seg
      if (field === 'pays') {
        return { ...seg, pays: value, country_code: '', ville: '' }
      }
      return { ...seg, [field]: value }
    }))
    if (field === 'pays') {
      setCityOptionsBySegment(prev => ({ ...prev, [id]: [] }))
    }
  }

  async function searchCountriesForSegment(segmentId, query) {
    const q = String(query || '').trim()
    if (q.length < 2) {
      setCountryOptionsBySegment(prev => ({ ...prev, [segmentId]: [] }))
      return
    }
    try {
      const res = await api.get('/employees/world-countries/search', { params: { q } })
      const options = (res.data || []).map(c => ({
        value: c.code,
        label: `${c.flag || ''} ${c.name}`.trim(),
        name: c.name,
        code: c.code,
      }))
      setCountryOptionsBySegment(prev => ({ ...prev, [segmentId]: options }))
    } catch {
      setCountryOptionsBySegment(prev => ({ ...prev, [segmentId]: [] }))
    }
  }

  async function searchCitiesForSegment(segmentId, countryCode, query) {
    const q = String(query || '').trim()
    if (!countryCode || q.length < 2) {
      setCityOptionsBySegment(prev => ({ ...prev, [segmentId]: [] }))
      return
    }
    try {
      const res = await api.get('/employees/world-cities/search', { params: { country_code: countryCode, q } })
      const options = (res.data || []).map(c => ({ value: c.name, label: c.name, name: c.name }))
      setCityOptionsBySegment(prev => ({ ...prev, [segmentId]: options }))
    } catch {
      setCityOptionsBySegment(prev => ({ ...prev, [segmentId]: [] }))
    }
  }

  function resetMissionForm() {
    setMissionForm({ motif: '', email_contact: '', mission_comment: '' })
    setMissionSegments([{ id: 1, pays: '', country_code: '', ville: '', date_debut: '', date_fin: '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
    setCountryOptionsBySegment({})
    setCityOptionsBySegment({})
    setMissionMissionnaires([]); setRechercheEmploye(''); setEmployesTrouves([])
    setMissionEditMode(false); setMissionEditId(null)
  }

  async function editMission(mission) {
    setFormSuccess(''); setFormError('')
    try {
      const res = await api.get(`/api/missions/${mission.id_operation}`)
      const detail = res.data
      setMissionForm({ motif: detail.motif || '', email_contact: detail.email_contact || '', mission_comment: detail.mission_comment || '' })
      if (detail.segments && detail.segments.length > 0) {
        setMissionSegments(detail.segments.map((s, idx) => ({
          id: idx + 1,
          pays: s.pays || '',
          country_code: '',
          ville: s.ville || '',
          date_debut: s.date_debut ? s.date_debut.split('T')[0] : '',
          date_fin: s.date_fin ? s.date_fin.split('T')[0] : '',
          heure_depart: s.heure_depart || '08:00:00',
          heure_arrivee: s.heure_arrivee || '18:00:00',
          heure_retour: s.heure_retour || '18:00:00',
          moyen_transport: s.moyen_transport || 'aerien',
        })))
      } else {
        setMissionSegments([{ id: 1, pays: mission.pays || '', country_code: '', ville: mission.ville || '', date_debut: mission.date_debut ? mission.date_debut.split('T')[0] : '', date_fin: mission.date_fin ? mission.date_fin.split('T')[0] : '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
      }
      if (detail.missionnaires && detail.missionnaires.length > 0) {
        setMissionMissionnaires(detail.missionnaires.map(m => ({ matricule: m.matricule, nom_complet: m.nom_complet, fonction: m.fonction, email: m.email })))
      } else {
        setMissionMissionnaires([])
      }
    } catch {
      setMissionForm({ motif: mission.motif || '', email_contact: mission.email || '', mission_comment: '' })
      setMissionSegments([{ id: 1, pays: mission.pays || '', country_code: '', ville: mission.ville || '', date_debut: mission.date_debut ? mission.date_debut.split('T')[0] : '', date_fin: mission.date_fin ? mission.date_fin.split('T')[0] : '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
      setMissionMissionnaires([])
    }
    setMissionEditMode(true); setMissionEditId(mission.id_operation)
    setShowForm(true)
  }

  function handleEditMission(item) {
    const detail = missionsById.get(item.id_operation) || item
    editMission(detail)
  }

  async function submitMission(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    if (!peutInitierMission) { setFormError('Initiation mission interdite pour votre rôle'); return }
    const segmentsInvalides = missionSegments.filter(seg => !seg.pays || !seg.country_code || !seg.ville || !seg.date_debut || !seg.date_fin)
    if (segmentsInvalides.length > 0) { setFormError('Veuillez remplir tous les champs de chaque destination'); return }
    const matriculesMissionnaires = missionMissionnaires.length > 0 ? missionMissionnaires.map(m => m.matricule) : [matricule]
    try {
      const dateDebut = missionSegments.reduce((min, seg) => !min || seg.date_debut < min ? seg.date_debut : min, null)
      const dateFin = missionSegments.reduce((max, seg) => !max || seg.date_fin > max ? seg.date_fin : max, null)
      const checkResponse = await api.get(`/api/missions/verifier-chevauchement/${matricule}`, { params: { date_debut: dateDebut, date_fin: dateFin, id_operation_exclure: missionEditMode ? missionEditId : null } })
      if (checkResponse.data.conflit) { if (!window.confirm(checkResponse.data.message + '. Voulez-vous continuer quand même ?')) return }
      if (missionEditMode && missionEditId) {
        const premierSegment = missionSegments[0]
        await api.put(`/api/missions/${missionEditId}/modifier`, null, { params: { pays: premierSegment.pays, country_code: premierSegment.country_code || null, ville: premierSegment.ville, date_debut: premierSegment.date_debut, date_fin: premierSegment.date_fin, heure_depart: premierSegment.heure_depart, heure_arrivee: premierSegment.heure_arrivee, heure_retour: premierSegment.heure_depart, email: missionForm.email_contact, motif: missionForm.motif || null } })
        setFormSuccess('Mission modifiée avec succès!')
      } else {
        await api.post('/api/missions/creer-multi-segments', { matricule, matricules_missionnaires: matriculesMissionnaires, email_contact: missionForm.email_contact || null, motif: missionForm.motif || null, mission_comment: missionForm.mission_comment || null, segments: missionSegments.map(seg => ({ pays: seg.pays, country_code: seg.country_code || null, ville: seg.ville, date_debut: seg.date_debut, date_fin: seg.date_fin, heure_depart: seg.heure_depart, heure_arrivee: seg.heure_arrivee, heure_retour: seg.heure_retour, moyen_transport: seg.moyen_transport || 'aerien' })) })
        setFormSuccess(`Demande de mission soumise avec ${missionSegments.length} destination(s) et ${matriculesMissionnaires.length} missionnaire(s).`)
      }
      resetMissionForm()
      setShowForm(false)
      loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la soumission de la mission') }
  }

  async function uploadRapport(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!rapportUpload.id_operation || !rapportUpload.file) { setFormError('Veuillez renseigner ID opération et fichier rapport'); return }
    const fd = new FormData(); fd.append('fichier', rapportUpload.file)
    try {
      await api.post(`/api/missions/${rapportUpload.id_operation}/televerser-rapport`, fd, { params: { matricule }, headers: { 'Content-Type': 'multipart/form-data' } })
      setFormSuccess('Rapport téléversé'); setRapportUpload({ id_operation: '', file: null }); loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur téléversement rapport') }
  }

  async function uploadPreuveFrais(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!preuveUpload.id_frais || !preuveUpload.file) { setFormError('Veuillez renseigner ID frais et fichier preuve'); return }
    const fd = new FormData(); fd.append('fichier', preuveUpload.file)
    try {
      await api.post(`/api/missions/frais/${preuveUpload.id_frais}/televerser-preuves`, fd, { params: { type_preuve: preuveUpload.type_preuve }, headers: { 'Content-Type': 'multipart/form-data' } })
      setFormSuccess(`Preuve ${preuveUpload.type_preuve} téléversée avec succès!`)
      setPreuvesFraisEnCours([...preuvesFraisEnCours, { type_preuve: preuveUpload.type_preuve, file: preuveUpload.file.name }])
      setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null }); loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur téléversement preuve') }
  }

  async function validerFraisMissionnaire(idMission) {
    try { setFormError(''); setFormSuccess(''); await api.post(`/api/missions/${idMission}/valider-frais-missionnaire`, { matricule }); setFormSuccess('Frais validés avec succès. En attente validation RH.')
      const res = await api.get(`/api/missions/${idMission}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la validation des frais') }
  }
  async function validerPaiementRH(idMission) {
    try { setFormError(''); setFormSuccess(''); await api.post(`/api/missions/${idMission}/valider-paiement-rh`, { matricule }); setFormSuccess('Paiement validé avec succès.')
      const res = await api.get(`/api/missions/${idMission}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la validation du paiement') }
  }
  async function marquerFraisPaye(idMission) {
    if (!window.confirm('Vous confirmez que les frais de mission ont été payés ?')) return
    try {
      setFormError(''); setFormSuccess('')
      await api.post(`/api/missions/${idMission}/marquer-paye`)
      setFormSuccess('Frais de mission marqués comme payés.')
      const res = await api.get(`/api/missions/${idMission}/statut-paiement-frais`)
      setStatutsPaiementFrais(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors du marquage du paiement') }
  }

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_demande || item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = normalizeText(normalizeListStatus(item.statut || item.status || 'en attente'))
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Mission').toLowerCase()
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
    const combined = [...workflowMissionnaire, ...workflowAValider, ...workflowValide, ...workflowRefuse]
    const dedup = [...new Map(combined.map(item => [item.id_operation, item])).values()]
    return applyFilters(dedup)
  }, [workflowMissionnaire, workflowAValider, workflowValide, workflowRefuse, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])

  const handleAnnuler = async (id) => {
    if (!confirm('Annuler cette demande ?')) return
    try {
      await api.delete(`/api/operations/${id}`)
      await loadData()
    } catch (err) {
      alert('Erreur: ' + (err?.response?.data?.detail || err.message))
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

  async function openMissionDetail(e, id) {
    e.stopPropagation()
    setDetailMissionId(id)
    setDetailData(null)
    try {
      const res = await api.get(`/api/missions/${id}`)
      setDetailData(res.data)
    } catch {
      setDetailData({ error: true })
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
    const eyeBtn = <button key="eye" onClick={(e) => openMissionDetail(e, id)} style={{ ...rowBtn, background: '#6366f1' }} title="Voir détails"><Eye size={12} /></button>

    if (isRefus) return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{eyeBtn}</div>

    if (isRecu) {
      const canApprove = !isValid && item.__workflow_bucket === 'recu'
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'validé') }} style={okBtn} disabled={isLoading}>Approuver</button>}
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'refusé') }} style={dangerBtn} disabled={isLoading}>Refuser</button>}
          {estRh && isValid && etat === 'AttenteRH' && <button onClick={(e) => { e.stopPropagation(); handleActiverRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>}
          {estRh && isValid && etat === 'Active' && <button onClick={(e) => { e.stopPropagation(); handleCloturerRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>}
          {eyeBtn}
        </div>
      )
    }

    if (!isValid) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleEditMission(item) }} style={primaryBtn}>Modifier</button>
          <button onClick={(e) => { e.stopPropagation(); handleAnnuler(id) }} style={dangerBtn}>Annuler</button>
          {eyeBtn}
        </div>
      )
    }

    if (etat === '--') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleActiver(id) }} style={btnStyle(okBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>{eyeBtn}</div>
    }

    if (etat === 'AttenteRH') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente RH</span>{eyeBtn}</div>
    }

    if (etat === 'Active') {
      const dateFin = item.date_fin || item.date_retour
      const canRetourAnticipe = dateFin && new Date() < new Date(dateFin)
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleCloturer(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>{canRetourAnticipe && <button onClick={(e) => { e.stopPropagation(); handleRetourAnticipe(id) }} style={btnStyle({ ...primaryBtn, background: '#3b82f6' })} disabled={isLoading}>{isLoading ? '…' : 'Retour anticipé'}</button>}{eyeBtn}</div>
    }

    if (etat === 'ClotureDemandee') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente confirmation RH</span>{eyeBtn}</div>
    }

    return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{eyeBtn}</div>
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) {
      return <tr><td colSpan={isRecu ? 14 : 13} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    }

    return rows.map(item => (
      <tr key={item.id_operation} onClick={() => setSelectedOperationForWorkflow(item.id_operation)} style={{ cursor: 'pointer' }}>
        <td style={td} title={item.titre || item.objet || item.motif || `Mission #${item.id_operation}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{item.titre || item.objet || item.motif || `Mission #${item.id_operation}`}</span>
            <ModifiedBadge estModifie={item.est_modifie} dateModification={item.date_modification} />
          </div>
        </td>
        <td style={td}>{isRecu ? (item.__workflow_bucket === 'missionnaire' ? 'Missionnaire' : 'Approbations') : 'Mission'}</td>
        <td style={td}>
          <span
            title={item.dernier_validateur_nom && item.derniere_validation_date ? `${item.dernier_validateur_nom} — ${fmtDateTime(item.derniere_validation_date)}` : undefined}
            style={{ cursor: item.dernier_validateur_nom ? 'help' : 'default' }}
          >
            {renderStatusBadge(normalizeListStatus(item.statut || item.status || 'en attente'))}
          </span>
        </td>
        <td style={td}>{fmtDate(item.date_demande || item.date_creation || item.created_at || item.date_soumission || item.date_debut)}</td>
        {isRecu && <td style={td} title={getEmitterName(item, true, senderName)}>{getEmitterName(item, true, senderName)}</td>}
        <td style={td}>{fmtDate(item.date_debut)}</td>
        <td style={td}>{fmtDate(item.date_fin)}</td>
        <td style={td}>{durationDays(item.date_debut, item.date_fin)}</td>
        <td style={td} title={(missionsById.get(item.id_operation)?.missionnaires_noms || item.missionnaires_noms || []).join(', ') || undefined}>{(() => {
          const noms = missionsById.get(item.id_operation)?.missionnaires_noms || item.missionnaires_noms || []
          return noms.length ? noms.join(', ') : '—'
        })()}</td>
        <td style={td} title={(() => { const md = missionsById.get(item.id_operation); const pays = md?.pays || item.pays; const ville = md?.ville || item.ville; if (!pays) return undefined; return ville ? `${pays}, ${ville}` : pays })()}>{(() => {
          const md = missionsById.get(item.id_operation)
          const pays = md?.pays || item.pays
          const ville = md?.ville || item.ville
          if (!pays) return '—'
          return ville ? `${pays}, ${ville}` : pays
        })()}</td>
        <td style={{ ...td, textAlign: 'center' }}>{(() => {
          const hasRapport = missionStatuts[item.id_operation]?.rapport_televerse ?? missionsById.get(item.id_operation)?.rapport_televerse
          return hasRapport
            ? <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>✓</span>
            : <span style={{ color: '#9ca3af' }}>—</span>
        })()}</td>
        <td style={td}>{(() => {
          const p = statutsPaiementFrais[item.id_operation]
          if (!p) return <span style={{ color: '#9ca3af' }}>—</span>
          if (p.frais_payes) return <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#065f46', background: '#d1fae5' }}>Payé</span>
          if (p.frais_valides_rh) return <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe' }}>Validé RH</span>
          if (p.frais_valides_missionnaire) return <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#92400e', background: '#fef3c7' }}>En att. RH</span>
          return <span style={{ color: '#9ca3af' }}>—</span>
        })()}</td>
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
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>Gestion des Missions</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveUploadModal('rapport')} style={{ padding: '9px 14px', background: '#fff', color: '#334155', border: '1.5px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><FileUp size={15} /> Téléverser rapport</button>
          <button onClick={() => setActiveUploadModal('preuves')} style={{ padding: '9px 14px', background: '#fff', color: '#334155', border: '1.5px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={15} /> Téléverser preuves frais</button>
          <button onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); resetMissionForm() }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{missionEditMode ? 'Modifier la mission' : 'Nouvelle demande de mission'}</strong>
            <button onClick={() => { setShowForm(false); resetMissionForm() }} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          </div>
          {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}

          <form className="form-card" onSubmit={submitMission}>
            <h3>{missionEditMode ? 'Modifier la mission' : 'Demande de mission multi-destinations'}</h3>
            {missionEditMode && (
              <div style={{background: '#fff3cd', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #ffc107', display:'flex', alignItems:'center', gap:6}}>
                <AlertTriangle size={13} color="#856404"/> Vous modifiez la mission ID #{missionEditId}
              </div>
            )}
            {/* Informations générales */}
            <div style={{background: '#f0f9ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #0ea5e9'}}>
              <h4 style={{marginTop: 0, color: '#0369a1', display:'flex', alignItems:'center', gap:6}}><ClipboardList size={14}/> Informations générales</h4>
              <div className="form-group"><label>Motif / Objet de la mission</label><input value={missionForm.motif} onChange={(e) => setMissionForm({ ...missionForm, motif: e.target.value })} placeholder="Ex: Formation, Réunion, Audit..." /></div>
              <div className="form-group" style={{marginTop: 8}}><label>Commentaire / Titre de la demande</label><textarea value={missionForm.mission_comment} onChange={(e) => setMissionForm({ ...missionForm, mission_comment: e.target.value })} placeholder="Ex: Mission d'audit annuel Douala, Visite client principal..." rows={2} style={{width: '100%', resize: 'vertical'}} /></div>
            </div>
            {/* Section Missionnaires */}
            <div style={{background: '#f0fdf4', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #22c55e'}}>
              <h4 style={{marginTop: 0, color: '#15803d', display:'flex', alignItems:'center', gap:6}}><Users size={14}/> Missionnaires ({missionMissionnaires.length})</h4>
              <div className="form-group" style={{position: 'relative'}}>
                <label>Rechercher un missionnaire</label>
                <input type="text" value={rechercheEmploye} onChange={(e) => rechercherEmployes(e.target.value)} placeholder="Nom, prénom ou matricule..." style={{width: '100%'}} />
                {employesTrouves.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, marginTop: '4px' }}>
                    {employesTrouves.map(emp => (
                      <div key={emp.matricule} onClick={() => ajouterMissionnaire(emp)} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                        <div style={{fontWeight: '500', color: '#111827'}}>{emp.nom_complet}</div>
                        <div style={{fontSize: '0.85rem', color: '#6b7280'}}>{emp.fonction} - Matricule: {emp.matricule}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {missionMissionnaires.length > 0 && (
                <div style={{marginTop: '15px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>Missionnaires sélectionnés ({missionMissionnaires.length})</label>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {missionMissionnaires.map(m => (
                      <div key={m.matricule} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#dcfce7', border: '1px solid #22c55e', borderRadius: '20px', padding: '6px 12px', fontSize: '0.9rem' }}>
                        <span style={{color: '#15803d', fontWeight: '500'}}>{m.nom_complet}</span>
                        <button type="button" onClick={() => retirerMissionnaire(m.matricule)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.1rem', padding: '0', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {missionMissionnaires.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '10px 0 0 0', fontStyle: 'italic' }}>Si aucun missionnaire n'est ajouté, seul l'initiateur de la demande (vous) sera assigné à cette mission.</p>}
            </div>
            {/* Segments de mission */}
            <div style={{marginBottom: '20px'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px'}}>
                <h4 style={{margin: 0, display:'flex',alignItems:'center',gap:6}}>Destinations ({missionSegments.length})</h4>
                <button type="button" className="btn btn-primary" onClick={ajouterSegmentMission} style={{fontSize: '0.9rem', padding: '8px 16px', display:'inline-flex', alignItems:'center', gap:5}}><Plus size={13}/> Ajouter une destination</button>
              </div>
              {missionSegments.map((segment, index) => (
                <div key={segment.id} style={{background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '2px solid #e5e7eb', position: 'relative'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <h5 style={{margin: 0, color: '#374151'}}>Destination {index + 1}</h5>
                    {missionSegments.length > 1 && <button type="button" onClick={() => supprimerSegmentMission(segment.id)} style={{background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display:'inline-flex', alignItems:'center', gap:4}}><Trash2 size={12}/> Supprimer</button>}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Pays</label>
                      <AutocompleteInput
                        value={segment.pays}
                        onChange={(v) => updateSegmentMission(segment.id, 'pays', v)}
                        onInputChange={(v) => searchCountriesForSegment(segment.id, v)}
                        onSelectOption={(opt) => {
                          if (!opt) return
                          setMissionSegments(prev => prev.map(seg => seg.id === segment.id ? { ...seg, pays: opt.name || opt.label, country_code: opt.code || opt.value, ville: '' } : seg))
                          setCityOptionsBySegment(prev => ({ ...prev, [segment.id]: [] }))
                        }}
                        options={countryOptionsBySegment[segment.id] || []}
                        strictSelection={true}
                        required
                        placeholder="Rechercher un pays..."
                      />
                    </div>
                    <div className="form-group">
                      <label>Ville</label>
                      <AutocompleteInput
                        value={segment.ville}
                        onChange={(v) => updateSegmentMission(segment.id, 'ville', v)}
                        onInputChange={(v) => searchCitiesForSegment(segment.id, segment.country_code, v)}
                        onSelectOption={(opt) => {
                          if (!opt) return
                          setMissionSegments(prev => prev.map(seg => seg.id === segment.id ? { ...seg, ville: opt.name || opt.label } : seg))
                        }}
                        options={cityOptionsBySegment[segment.id] || []}
                        strictSelection={true}
                        required
                        disabled={!segment.country_code}
                        placeholder={segment.country_code ? 'Rechercher une ville...' : 'Sélectionnez d\'abord un pays'}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Date début</label><input type="date" value={segment.date_debut} onChange={(e) => updateSegmentMission(segment.id, 'date_debut', e.target.value)} required /></div>
                    <div className="form-group"><label>Date fin</label><input type="date" value={segment.date_fin} onChange={(e) => updateSegmentMission(segment.id, 'date_fin', e.target.value)} required /></div>
                    <div className="form-group"><label>Durée</label><input type="text" value={segment.date_debut && segment.date_fin ? `${Math.ceil((new Date(segment.date_fin) - new Date(segment.date_debut)) / (1000 * 60 * 60 * 24)) + 1} jours` : '-'} readOnly style={{background: '#e5e7eb'}} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Heure départ</label><input type="time" value={segment.heure_depart.slice(0, 5)} onChange={(e) => updateSegmentMission(segment.id, 'heure_depart', `${e.target.value}:00`)} /></div>
                    <div className="form-group"><label>Heure arrivée</label><input type="time" value={segment.heure_arrivee.slice(0, 5)} onChange={(e) => updateSegmentMission(segment.id, 'heure_arrivee', `${e.target.value}:00`)} /></div>
                    <div className="form-group"><label>Heure retour</label><input type="time" value={segment.heure_retour ? segment.heure_retour.slice(0, 5) : '18:00'} onChange={(e) => updateSegmentMission(segment.id, 'heure_retour', `${e.target.value}:00`)} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Moyen de transport</label>
                      <select value={segment.moyen_transport || 'aerien'} onChange={(e) => updateSegmentMission(segment.id, 'moyen_transport', e.target.value)}>
                        <option value="aerien">Aérien</option><option value="routier">Routier</option><option value="ferroviaire">Ferroviaire</option><option value="maritime">Maritime</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#0369a1'}}><strong style={{display:'inline-flex',alignItems:'center',gap:5}}><FileText size={13}/> Note:</strong> Un email sera envoyé à l'adresse indiquée pour effectuer la demande de frais de mission.</p>
            </div>
            <div style={{display: 'flex', gap: '10px'}}>
              <button className="btn btn-success" type="submit">{missionEditMode ? 'Enregistrer les modifications' : `Soumettre (${missionSegments.length} destination${missionSegments.length > 1 ? 's' : ''})`}</button>
              {missionEditMode && <button className="btn" type="button" onClick={() => { resetMissionForm(); setFormSuccess(''); setFormError('') }} style={{background: '#6c757d', color: 'white'}}>Annuler modification</button>}
            </div>
          </form>
        </div>
      )}

          {/* Modal: Téléversement rapport */}
          {activeUploadModal === 'rapport' && (
            <div onClick={(e) => { if (e.target === e.currentTarget) setActiveUploadModal(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Téléversement rapport mission</strong>
                  <button onClick={() => setActiveUploadModal(null)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
                </div>
                {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
                {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}
                <form className="form-card" onSubmit={uploadRapport}>
                  <div style={{ background: '#d1ecf1', padding: '10px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #bee5eb', fontSize: '0.9em' }}>Le rapport ne peut être téléversé que pour une mission <strong>active</strong> (validée et activée).</div>
                  <div className="form-group"><label>Mission (ID opération)</label>
                    <select value={rapportUpload.id_operation} onChange={(e) => setRapportUpload({ ...rapportUpload, id_operation: e.target.value })}>
                      <option value="">Sélectionner une mission</option>
                      {items.filter(m => missionStatuts[m.id_operation]?.est_active).map(m => (<option key={m.id_operation} value={m.id_operation}>#{m.id_operation} - {m.pays}, {m.ville || 'N/A'} (Active)</option>))}
                    </select>
                    {items.filter(m => missionStatuts[m.id_operation]?.est_active).length === 0 && <p style={{ fontSize: '0.85em', color: '#856404', background: '#fff3cd', padding: '8px', borderRadius: '4px', marginTop: '8px' }}><AlertTriangle size={13}/> Aucune mission activée disponible.</p>}
                  </div>
                  <div className="form-group"><label>Fichier rapport</label><input type="file" onChange={(e) => setRapportUpload({ ...rapportUpload, file: e.target.files[0] })} /></div>
                  <button className="btn btn-primary" type="submit" disabled={!rapportUpload.id_operation || !rapportUpload.file}>Téléverser rapport</button>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Téléversement preuves frais */}
          {activeUploadModal === 'preuves' && (
            <div onClick={(e) => { if (e.target === e.currentTarget) setActiveUploadModal(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Téléversement preuves frais</strong>
                  <button onClick={() => setActiveUploadModal(null)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
                </div>
                {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
                {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}
                <form className="form-card" onSubmit={uploadPreuveFrais}>
                  <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}><p style={{margin: 0, fontSize: '0.9rem', color: '#92400e'}}><strong>Important:</strong> Vous devez d'abord soumettre une demande de frais associée à une mission <strong>validée et activée</strong> pour pouvoir téléverser les preuves.</p></div>
                  <div className="form-group"><label>ID Frais</label><input value={preuveUpload.id_frais} onChange={(e) => setPreuveUpload({ ...preuveUpload, id_frais: e.target.value })} required placeholder="Entrez l'ID de la demande de frais" /></div>
                  <div className="form-group"><label>Type de preuve</label>
                    <select value={preuveUpload.type_preuve} onChange={(e) => setPreuveUpload({ ...preuveUpload, type_preuve: e.target.value })} required>
                      <option value="facture">Facture</option><option value="recu">Reçu</option><option value="ticket">Ticket</option><option value="bordereau">Bordereau</option><option value="quittance">Quittance</option><option value="autre">Autre</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Fichier preuve</label><input type="file" onChange={(e) => setPreuveUpload({ ...preuveUpload, file: e.target.files[0] })} required /></div>
                  <button className="btn btn-success" type="submit" disabled={!preuveUpload.id_frais || !preuveUpload.file}>Téléverser preuve</button>
                </form>
                {preuvesFraisEnCours.length > 0 && (
                  <div className="form-card" style={{background: '#d1e7dd', border: '1px solid #badbcc', marginTop: 12}}>
                    <h3 style={{color: '#0f5132', margin: '0 0 12px 0', display:'flex', alignItems:'center', gap:6}}><CheckCircle size={14}/> Preuves téléversées ({preuvesFraisEnCours.length})</h3>
                    <ul style={{margin: 0, paddingLeft: '20px'}}>{preuvesFraisEnCours.map((p, idx) => (<li key={idx} style={{color: '#1a5e3b', marginBottom: '8px'}}><strong>{p.type_preuve}</strong> - {p.file}</li>))}</ul>
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
              <th style={{ ...th, width: '12%' }}>Titre de demande</th>
              <th style={{ ...th, width: '6%' }}>Source</th>
              <th style={{ ...th, width: '7%' }}>Statut</th>
              <th style={{ ...th, width: '6%' }}>Date creation</th>
              {activeTab !== 'envoye' && <th style={{ ...th, width: '7%' }}>Envoye par</th>}
              <th style={{ ...th, width: '6%' }}>Date depart</th>
              <th style={{ ...th, width: '6%' }}>Date retour</th>
              <th style={{ ...th, width: '4%' }}>Duree</th>
              <th style={{ ...th, width: '8%' }}>Missionnaire(s)</th>
              <th style={{ ...th, width: '7%' }}>Destination(s)</th>
              <th style={{ ...th, width: '4%' }}>Rapport</th>
              <th style={{ ...th, width: '6%' }}>Paiement frais</th>
              <th style={{ ...th, width: '5%' }}>Etat</th>
              <th style={{ ...th, width: '16%' }}>Actions</th>
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
                  <th style={{ ...th, width: '22%' }}>Titre de demande</th>
                  <th style={{ ...th, width: '12%' }}>Demandeur</th>
                  <th style={{ ...th, width: '10%' }}>Statut</th>
                  <th style={{ ...th, width: '11%' }}>Date creation</th>
                  <th style={{ ...th, width: '10%' }}>Date depart</th>
                  <th style={{ ...th, width: '10%' }}>Date retour</th>
                  <th style={{ ...th, width: '6%' }}>Duree</th>
                  <th style={{ ...th, width: '19%' }}>Etat</th>
                </tr>
              </thead>
              <tbody>
                {workflowPcaAg.map(item => {
                  const etat = rowEtat[item.id_operation] || '--'
                  const badgeEl = (label, color) => <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color, background: `${color}22` }}>{label}</span>
                  const etatBadge = etat === 'Cloturee' ? <div style={{ display: 'flex', gap: 4 }}>{badgeEl('Activé', '#10b981')}{badgeEl('Clôturé', '#6366f1')}</div>
                    : etat === 'ClotureDemandee' ? <div style={{ display: 'flex', gap: 4 }}>{badgeEl('Activé', '#10b981')}{badgeEl('Clôture en att. RH', '#f59e0b')}</div>
                    : etat === 'Active' ? badgeEl('Activé', '#10b981')
                    : etat === 'AttenteRH' ? badgeEl('En att. RH', '#f59e0b')
                    : badgeEl('--', '#64748b')
                  return (
                    <tr key={item.id_operation}>
                      <td style={td}>{item.titre || item.type_demande || 'Mission'} #{item.id_operation}</td>
                      <td style={td}>{item.demandeur?.nom_complet || item.demandeur?.nom || `#${item.matricule}`}</td>
                      <td style={td}>{item.statut}</td>
                      <td style={td}>{item.date_demande ? String(item.date_demande).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.date_depart ? String(item.date_depart).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.date_retour ? String(item.date_retour).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.duree_jours ?? item.duree ?? '--'} j</td>
                      <td style={td}>{etatBadge}</td>
                    </tr>
                  )
                })}
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

      {/* Modal: Voir détails mission */}
      {detailMissionId && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setDetailMissionId(null); setDetailData(null) } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '92%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <strong style={{ fontSize: '1.15rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={16} style={{ color: '#6366f1' }} /> Détails mission #{detailMissionId}
              </strong>
              <button onClick={() => { setDetailMissionId(null); setDetailData(null) }} style={{ padding: '7px 14px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
            </div>

            {!detailData && <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0' }}>Chargement…</div>}
            {detailData?.error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: 8 }}>Erreur lors du chargement des détails.</div>}

            {detailData && !detailData.error && (
              <>
                {/* Informations générales */}
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Informations générales</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: '0.85rem' }}>
                    {detailData.motif && <div><span style={{ color: '#64748b', fontWeight: 600 }}>Motif: </span>{detailData.motif}</div>}
                    {detailData.mission_comment && <div><span style={{ color: '#64748b', fontWeight: 600 }}>Commentaire: </span>{detailData.mission_comment}</div>}
                    {detailData.email_contact && <div><span style={{ color: '#64748b', fontWeight: 600 }}>Email contact: </span>{detailData.email_contact}</div>}
                    <div><span style={{ color: '#64748b', fontWeight: 600 }}>Statut: </span>{renderStatusBadge(normalizeListStatus(detailData.statut || 'en attente'))}</div>
                    <div><span style={{ color: '#64748b', fontWeight: 600 }}>Date départ: </span>{detailData.date_debut ? new Date(detailData.date_debut).toLocaleDateString('fr-FR') : '—'}</div>
                    <div><span style={{ color: '#64748b', fontWeight: 600 }}>Date retour: </span>{detailData.date_fin ? new Date(detailData.date_fin).toLocaleDateString('fr-FR') : '—'}</div>
                    <div><span style={{ color: '#64748b', fontWeight: 600 }}>Rapport: </span>
                      {detailData.rapport_televerse
                        ? <>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>Téléversé ✓</span>
                            {detailData.rapport_chemin && (
                              <a href={`${(api.defaults.baseURL||'').replace(/\/$/,'')}/${detailData.rapport_chemin}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: '#3b82f6', fontSize: '0.78rem', textDecoration: 'underline' }}>Voir le rapport</a>
                            )}
                          </>
                        : <span style={{ color: '#9ca3af' }}>Non téléversé</span>}
                    </div>
                    <div><span style={{ color: '#64748b', fontWeight: 600 }}>Frais: </span>
                      {detailData.frais_payes
                        ? <span style={{ color: '#10b981', fontWeight: 700 }}>Payé</span>
                        : detailData.frais_valides_rh
                          ? <span style={{ color: '#1e40af' }}>Validé RH</span>
                          : detailData.frais_valides_missionnaire
                            ? <span style={{ color: '#92400e' }}>En attente RH</span>
                            : <span style={{ color: '#9ca3af' }}>—</span>}
                    </div>
                    {detailData.initiateur_nom && <div><span style={{ color: '#64748b', fontWeight: 600 }}>Initié par: </span>{detailData.initiateur_nom}</div>}
                  </div>
                </div>

                {/* Segments / Destinations */}
                {detailData.segments && detailData.segments.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Destinations ({detailData.segments.length})</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Destination</th>
                          <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Dates</th>
                          <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Transport</th>
                          <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Durée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.segments.map((seg, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '7px 10px', color: '#111827' }}>{seg.pays}{seg.ville ? `, ${seg.ville}` : ''}</td>
                            <td style={{ padding: '7px 10px', color: '#111827' }}>
                              {seg.date_debut ? new Date(seg.date_debut).toLocaleDateString('fr-FR') : '—'}
                              {' → '}
                              {seg.date_fin ? new Date(seg.date_fin).toLocaleDateString('fr-FR') : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: '#374151', textTransform: 'capitalize' }}>{seg.moyen_transport || '—'}</td>
                            <td style={{ padding: '7px 10px', color: '#374151' }}>
                              {seg.date_debut && seg.date_fin
                                ? `${Math.round((new Date(seg.date_fin) - new Date(seg.date_debut)) / 86400000) + 1} j`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Missionnaires */}
                {detailData.missionnaires && detailData.missionnaires.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Missionnaires ({detailData.missionnaires.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detailData.missionnaires.map((m, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.83rem' }}>
                          <Users size={13} style={{ color: '#6366f1', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.nom_complet}</span>
                          {m.fonction && <span style={{ color: '#64748b' }}>— {m.fonction}</span>}
                          {m.role_mission && <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: '0.65rem', background: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}>{m.role_mission}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
