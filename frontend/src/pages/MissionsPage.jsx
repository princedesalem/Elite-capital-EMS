import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import WorkflowModal from '../components/WorkflowModal'
import RemplacantModal from '../components/RemplacantModal'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import AutocompleteInput from '../components/AutocompleteInput'
import ModifiedBadge from '../components/ModifiedBadge'
import { operationLabel } from '../utils/operationLabel'
import '../styles/Operations.css'
import { toast, confirmDialog } from '../components/ui/bridge'
import { Pagination, usePagination, TableSkeleton } from '../components/ui'

import {
  ClipboardList, AlertTriangle, FileText, Plus, Trash2, Pencil, Users, CheckCircle, Search, Upload, FileUp, Eye, Banknote, Clock, Download, FileDown, Users2
} from 'lucide-react'

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }

const errMsg = (err, fallback = 'Une erreur est survenue') => {
  const d = err?.response?.data?.detail
  if (!d) return err?.message || fallback
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map(e => e?.msg || JSON.stringify(e)).join(' ; ')
  return fallback
}

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
        ['envoye', "Envoyé", counts.envoye],
        ['recu', "Recu", counts.recu],
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
      <input type="text" value={emetteur} onChange={e => setEmetteur(e.target.value)} placeholder="Émetteur" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={etat} onChange={e => setEtat(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }}>
        <option value="">Tous États</option>
        {['--', 'AttenteRH', 'Active', 'ClotureDemandee', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>{"Réinitialiser"}</button>}
    </div>
  )
}

function RapportModal({ idOperation, matricule, missionStatuts, estMissionnaire, onClose, onUploaded }) {
  const [rapport, setRapport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = React.useRef(null)
  const estActive = missionStatuts[idOperation]?.est_active || false

  const charger = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/missions/${idOperation}/rapport`)
      setRapport(res.data)
    } catch {
      setRapport(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [idOperation])

  const uploader = async (e) => {
    e.preventDefault()
    const files = fileRef.current?.files
    if (!files || files.length === 0) { setError('Sélectionnez un fichier'); return }
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('fichier', files[0])
      await api.post(`/api/missions/${idOperation}/televerser-rapport`, fd, { params: { matricule }, headers: { 'Content-Type': 'multipart/form-data' } })
      if (fileRef.current) fileRef.current.value = ''
      await charger()
      onUploaded()
    } catch (err) {
      setError(errMsg(err, "Erreur lors du téléversement"))
    } finally {
      setUploading(false)
    }
  }

  const buildUrl = (chemin) => {
    const base = (api.defaults?.baseURL || '').replace(/\/$/, '')
    return `${base}/${chemin.replace(/^\//, '').replace(/^api\//, '')}`
  }

  const supprimerRapport = async () => {
    const ok = await confirmDialog({
      title: 'Supprimer le rapport',
      message: 'Êtes-vous sûr de vouloir supprimer ce rapport ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
    })
    if (!ok) return
    setError('')
    try {
      await api.delete(`/api/missions/${idOperation}/supprimer-rapport`, { params: { matricule } })
      await charger()
      onUploaded()
    } catch (err) {
      setError(errMsg(err, "Erreur lors de la suppression"))
    }
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 520, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} style={{ color: '#475569' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{"Rapport de mission"}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mission #{idOperation}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '1rem', fontWeight: 700 }}>✕</button>
        </div>

        <div style={{ padding: '16px 22px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.85rem' }}>{"Chargement..."}</div>
          ) : rapport?.rapport_televerse && rapport.fichier ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9' }}>
              <FileText size={15} style={{ color: '#64748b', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.82rem', color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rapport.fichier.nom_fichier}>{rapport.fichier.nom_fichier}</span>
              {rapport.date && <span style={{ fontSize: '0.71rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{new Date(rapport.date).toLocaleDateString('fr-FR')}</span>}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <a href={buildUrl(rapport.fichier.chemin)} download title="Télécharger" style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', textDecoration: 'none' }}><Download size={13} /></a>
                <a href={buildUrl(rapport.fichier.chemin)} target="_blank" rel="noopener noreferrer" title="Voir" style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', textDecoration: 'none' }}><Eye size={13} /></a>
                {estMissionnaire && <button onClick={supprimerRapport} title="Supprimer" style={{ width: 30, height: 30, border: '1px solid #fecaca', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button>}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#cbd5e1', fontSize: '0.85rem' }}>
              <FileUp size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              {"Aucun rapport"}
            </div>
          )}
        </div>

        {estMissionnaire && <div style={{ padding: '14px 22px 20px', borderTop: '1px solid #f1f5f9' }}>
          {!estActive && !rapport?.rapport_televerse && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem', color: '#92400e' }}>
              {"Le rapport n'est disponible que pour les missions actives"}
            </div>
          )}
          <form onSubmit={uploader} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{rapport?.rapport_televerse ? "Remplacer le rapport" : "Téléverser rapport"}</label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.odt" style={{ fontSize: '0.82rem', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: 8, cursor: 'pointer', color: '#475569', background: '#f8fafc' }} />
            {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={uploading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: uploading ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.82rem', alignSelf: 'flex-start' }}>
              <Upload size={14} />{uploading ? "Téléversement..." : "Téléverser"}
            </button>
          </form>
        </div>}
      </div>
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
  const [downloadingPdf, setDownloadingPdf] = useState(null)

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
  const [preuveUploadMissionId, setPreuveUploadMissionId] = useState('')
  const [detailMissionId, setDetailMissionId] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailFraisData, setDetailFraisData] = useState(null)
  const [rapportModalOp, setRapportModalOp] = useState(null)
  const [showRemplacantModal, setShowRemplacantModal] = useState(false)
  const [remplacantOpId, setRemplacantOpId] = useState(null)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const opId = searchParams.get('operationId')
    if (opId) setSelectedOperationForWorkflow(Number(opId))
    const tab = searchParams.get('tab')
    if (tab === 'recu' || tab === 'envoye') setActiveTab(tab)
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
      setRowEtat(initRowEtatFromApi([...envoyeNorm, ...aValiderNorm, ...valideNorm, ...refuseNorm, ...missionnaireItems]))
      // Populate payment statuts from enriched API response (avoids extra requests)
      const _payMap = {}
      missionnaireItems.forEach(m => {
        if (m.id_operation && m.frais_payes !== undefined) {
          _payMap[m.id_operation] = { frais_payes: m.frais_payes || false, frais_valides_missionnaire: m.frais_valides_missionnaire || false, frais_valides_rh: m.frais_valides_rh || false, date_paiement_frais: m.date_paiement_frais || null }
        }
      })
      ;[...envoyeNorm, ...aValiderNorm, ...valideNorm, ...refuseNorm, ...pcaAgNorm].forEach(item => {
        if (item.id_operation && item.frais_payes !== undefined) {
          _payMap[item.id_operation] = { frais_payes: item.frais_payes || false, frais_valides_missionnaire: item.frais_valides_missionnaire || false, frais_valides_rh: item.frais_valides_rh || false, date_paiement_frais: item.date_paiement_frais || null }
        }
      })
      if (Object.keys(_payMap).length > 0) setStatutsPaiementFrais(prev => ({ ...prev, ..._payMap }))
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
    const toFetch = [...items, ...workflowMissionnaire].filter(
      (m, i, arr) => m.id_operation && arr.findIndex(x => x.id_operation === m.id_operation) === i
    )
    if (toFetch.length === 0) return
    toFetch.forEach(async m => {
      try {
        const res = await api.get(`/api/missions/${m.id_operation}/statut-mission`)
        setMissionStatuts(prev => ({ ...prev, [m.id_operation]: res.data }))
      } catch {}
    })
    items.forEach(async m => {
      if (m.id_operation) {
        try {
          const res = await api.get(`/api/missions/${m.id_operation}/statut-paiement-frais`)
          setStatutsPaiementFrais(prev => ({ ...prev, [m.id_operation]: res.data }))
        } catch {}
      }
    })
  }, [items, workflowMissionnaire])

  async function rechercherEmployes(term) {
    setRechercheEmploye(term)
    if (term.length < 2) { setEmployesTrouves([]); return }
    try {
      const res = await api.get('/api/missions/rechercher-employes', { params: { q: term, matricule_initiateur: user?.matricule } })
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
    if (missionSegments.length <= 1) { toast.warning('Au moins une destination est requise'); return }
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
      if (checkResponse.data.conflit) {
        const ok = await confirmDialog({
          title: 'Chevauchement détecté',
          message: checkResponse.data.message + '. Voulez-vous continuer quand même ?',
          variant: 'warning',
          confirmLabel: 'Continuer',
        })
        if (!ok) return
      }
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
    } catch (err) { setFormError(errMsg(err, 'Erreur lors de la soumission de la mission')) }
  }

  async function openFraisDetail(e, idMission) {
    e.stopPropagation()
    setDetailFraisData(null)
    try {
      let idFrais = statutsPaiementFrais[idMission]?.id_frais_operation
      if (!idFrais) {
        const psRes = await api.get(`/api/missions/${idMission}/statut-paiement-frais`)
        idFrais = psRes.data?.id_frais_operation
        if (psRes.data) setStatutsPaiementFrais(prev => ({ ...prev, [idMission]: psRes.data }))
      }
      if (!idFrais) { setDetailFraisData({ error: true }); return }
      const res = await api.get(`/api/missions/frais/${idFrais}`)
      setDetailFraisData(res.data)
    } catch {
      setDetailFraisData({ error: true })
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

  async function uploadRapport(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!rapportUpload.id_operation || !rapportUpload.file) { setFormError('Veuillez renseigner ID opération et fichier rapport'); return }
    const fd = new FormData(); fd.append('fichier', rapportUpload.file)
    try {
      await api.post(`/api/missions/${rapportUpload.id_operation}/televerser-rapport`, fd, { params: { matricule }, headers: { 'Content-Type': 'multipart/form-data' } })
      setFormSuccess('Rapport téléversé'); setRapportUpload({ id_operation: '', file: null }); loadData()
    } catch (err) { setFormError(errMsg(err, 'Erreur téléversement rapport')) }
  }

  async function uploadPreuveFrais(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!preuveUpload.id_frais || !preuveUpload.file) { setFormError('Veuillez renseigner ID frais et fichier preuve'); return }
    const fd = new FormData(); fd.append('fichier', preuveUpload.file)
    try {
      await api.post(`/api/missions/frais/${preuveUpload.id_frais}/televerser-preuves`, fd, { params: { type_preuve: preuveUpload.type_preuve, matricule }, headers: { 'Content-Type': 'multipart/form-data' } })
      setFormSuccess(`Preuve ${preuveUpload.type_preuve} téléversée avec succès!`)
      setPreuvesFraisEnCours([...preuvesFraisEnCours, { type_preuve: preuveUpload.type_preuve, file: preuveUpload.file.name }])
      setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null }); loadData()
    } catch (err) { setFormError(errMsg(err, 'Erreur téléversement preuve')) }
  }

  async function validerFraisMissionnaire(idMission) {
    try { setFormError(''); setFormSuccess(''); await api.post(`/api/missions/${idMission}/valider-frais-missionnaire`, { matricule }); setFormSuccess('Frais validés avec succès. En attente validation RH.')
      const res = await api.get(`/api/missions/${idMission}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(errMsg(err, 'Erreur lors de la validation des frais')) }
  }
  async function validerPaiementRH(idMission) {
    try { setFormError(''); setFormSuccess(''); await api.post(`/api/missions/${idMission}/valider-paiement-rh`, { matricule }); setFormSuccess('Paiement validé avec succès.')
      const res = await api.get(`/api/missions/${idMission}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(errMsg(err, 'Erreur lors de la validation du paiement')) }
  }
  async function marquerFraisPaye(idMission) {
    const ok = await confirmDialog({
      title: 'Confirmer le paiement',
      message: 'Vous confirmez que les frais de mission ont été payés ?',
      variant: 'primary',
      confirmLabel: 'Confirmer le paiement',
    })
    if (!ok) return
    try {
      setFormError(''); setFormSuccess('')
      await api.post(`/api/missions/${idMission}/marquer-paye`)
      setFormSuccess('Frais de mission marqués comme payés.')
      const res = await api.get(`/api/missions/${idMission}/statut-paiement-frais`)
      setStatutsPaiementFrais(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(errMsg(err, 'Erreur lors du marquage du paiement')) }
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
    const ok = await confirmDialog({
      title: 'Annuler la demande',
      message: 'Annuler cette demande ?',
      variant: 'danger',
      confirmLabel: 'Annuler la demande',
      cancelLabel: 'Retour',
    })
    if (!ok) return
    try {
      await api.delete(`/api/operations/${id}`)
      await loadData()
      toast.success('Demande annulée')
    } catch (err) {
      toast.error(errMsg(err, err.message))
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
        requireInput: { label: 'Motif du refus', placeholder: 'Ex. mission non justifiée…', multiline: true, required: true },
      })
      if (!commentaire) return
    }
    try {
      await api.post(`/api/workflow/valider/${id}`, null, { params: { matricule_validateur: user.matricule, statut, ...(commentaire ? { commentaire } : {}) } })
      await loadData()
      toast.success(statut === 'refusé' ? 'Demande refusée' : 'Demande validée')
    } catch (err) {
      toast.error(errMsg(err, err.message))
    }
  }

  const handleActiver = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/missions/activation/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      if (response?.data?.message) toast.success(response.data.message)
      await loadData()
    } catch (err) {
      toast.error('Activation : ' + errMsg(err, err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleCloturer = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/missions/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      if (response?.data?.message) toast.success(response.data.message)
      await loadData()
    } catch (err) {
      toast.error('Clôture : ' + errMsg(err, err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleRetourAnticipe = async (id) => {
    const ok = await confirmDialog({
      title: 'Retour anticipé',
      message: 'Confirmer le retour anticipé ? Les jours restants seront restitués au solde.',
      variant: 'warning',
      confirmLabel: 'Confirmer le retour',
    })
    if (!ok) return
    setLoadingOp(id)
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await api.post(`/api/missions/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule, retour_anticipe: true, date_retour_anticipe: today } })
      if (response?.data?.message) toast.success(response.data.message)
      await loadData()
    } catch (err) {
      toast.error('Retour anticipé : ' + errMsg(err, err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleActiverRh = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/missions/activation/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
      if (response?.data?.message) toast.success(response.data.message)
      await loadData()
    } catch (err) {
      toast.error('Activation RH : ' + errMsg(err, err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleCloturerRh = async (id) => {
    setLoadingOp(id)
    try {
      const response = await api.post(`/api/missions/cloture/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
      if (response?.data?.message) toast.success(response.data.message)
      await loadData()
    } catch (err) {
      toast.error('Clôture RH : ' + errMsg(err, err.message))
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
    const eyeBtn = <button key="eye" onClick={(e) => openMissionDetail(e, id)} className="btn-ghost-primary" style={{ ...rowBtn, display: 'inline-flex', alignItems: 'center' }} title="Voir détails"><Eye size={12} /></button>
    const pdfBtn = isValid ? <button key="pdf" onClick={(e) => { e.stopPropagation(); setDownloadingPdf(id); api.get(`/api/pdf/mission/${id}`, { responseType: 'blob' }).then(res => { const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `mission_${id}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }).finally(() => setDownloadingPdf(null)) }} className="btn-ghost-primary" style={{ ...rowBtn, display: 'inline-flex', alignItems: 'center', opacity: downloadingPdf === id ? 0.6 : 1 }} disabled={downloadingPdf === id} title="Télécharger PDF"><FileDown size={13} /></button> : null
    const remplacantBtn = <button key="remplacant" onClick={(e) => { e.stopPropagation(); setRemplacantOpId(id); setShowRemplacantModal(true) }} className="btn-ghost-primary" style={{ ...rowBtn, display: 'inline-flex', alignItems: 'center' }} title="Remplaçant"><Users2 size={12} /></button>

    if (isRefus) return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{eyeBtn}</div>

    if (isRecu) {
      const canApprove = !isValid && item.__workflow_bucket === 'recu'
      const isMissionnaire = item.__workflow_bucket === 'missionnaire'
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'validé') }} style={okBtn} disabled={isLoading}>{"Approuver"}</button>}
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'refusé') }} style={dangerBtn} disabled={isLoading}>{"Refuser"}</button>}
          {isMissionnaire && isValid && etat === '--' && <button onClick={(e) => { e.stopPropagation(); handleActiver(id) }} style={btnStyle(okBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>}
          {isMissionnaire && isValid && etat === 'AttenteRH' && <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente RH</span>}
          {isMissionnaire && isValid && etat === 'Active' && <button onClick={(e) => { e.stopPropagation(); handleCloturer(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>}
          {estRh && isValid && etat === 'AttenteRH' && <button onClick={(e) => { e.stopPropagation(); handleActiverRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer (RH)'}</button>}
          {estRh && isValid && etat === 'Active' && <button onClick={(e) => { e.stopPropagation(); handleCloturerRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer (RH)'}</button>}
          {pdfBtn}{eyeBtn}{remplacantBtn}
        </div>
      )
    }

    if (!isValid) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleEditMission(item) }} style={primaryBtn}>{"Modifier"}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAnnuler(id) }} style={dangerBtn}>{"Annuler"}</button>
          {eyeBtn}{remplacantBtn}
        </div>
      )
    }

    if (etat === '--') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleActiver(id) }} style={btnStyle(okBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    if (etat === 'AttenteRH') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente RH</span>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    if (etat === 'Active') {
      const dateFin = item.date_fin || item.date_retour
      const canRetourAnticipe = dateFin && new Date() < new Date(dateFin)
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleCloturer(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Clôturer'}</button>{canRetourAnticipe && <button onClick={(e) => { e.stopPropagation(); handleRetourAnticipe(id) }} style={btnStyle({ ...primaryBtn, background: '#3b82f6' })} disabled={isLoading}>{isLoading ? '…' : 'Retour anticipé'}</button>}{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    if (etat === 'ClotureDemandee') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>En attente confirmation RH</span>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) {
      return <tr><td colSpan={isRecu ? 14 : 13} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    }

    return rows.map(item => (
      <tr key={item.id_operation} onClick={() => setSelectedOperationForWorkflow(item.id_operation)} style={{ cursor: 'pointer' }}>
        <td style={td} title={operationLabel(item)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{operationLabel(item)}</span>
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
        <td style={td} title={(() => { const v = item.date_demande || item.date_creation || item.created_at || item.date_soumission || item.date_debut; return v ? new Date(v).toLocaleString('fr-FR') : '' })()}>{fmtDate(item.date_demande || item.date_creation || item.created_at || item.date_soumission || item.date_debut)}</td>
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
        <td style={{ ...td, textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); setRapportModalOp(item.id_operation) }}>{(() => {
          const hasRapport = missionStatuts[item.id_operation]?.rapport_televerse ?? missionsById.get(item.id_operation)?.rapport_televerse
          const rapportDate = missionStatuts[item.id_operation]?.date_telechargement_rapport
          return hasRapport
            ? <span title={rapportDate ? `Téléversé le ${new Date(rapportDate).toLocaleString('fr-FR')}` : 'Cliquez pour voir/modifier le rapport'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}>✓ Téléversé</span>
            : <span title="Cliquez pour téléverser le rapport" style={{ color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline dotted' }}>—</span>
        })()}</td>
        <td style={td} onClick={(e) => e.stopPropagation()}>{(() => {
          const p = statutsPaiementFrais[item.id_operation]
          if (!isValidated(item.statut || item.status) && !item.validation_terminee) return <span style={{ color: '#9ca3af' }}>—</span>
          if (!p) return <span style={{ color: '#9ca3af' }}>—</span>
          if (p.frais_payes) {
            const tooltip = p.date_paiement_frais ? `Payé le ${fmtDateTime(p.date_paiement_frais)}` : 'Cliquez pour voir les détails'
            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}><Banknote size={10}/>Payé</span>
          }
          if (p.frais_valides_missionnaire && !p.frais_valides_rh) {
            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title="Cliquez pour voir les détails" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', cursor: 'pointer' }}><Clock size={10}/>Att. conf. RH</span>
          }
          return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title="Cliquez pour voir les détails" style={{ padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', cursor: 'pointer' }}>Impayé</span>
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

  const _source = activeTab === 'envoye' ? envoye : recu
  const pagination = usePagination(_source, { pageSize: 20 })
  if (loading) return <div style={{ padding: 20 }}><TableSkeleton rows={6} columns={9} /></div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>{"Gestion des Missions"}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <>
            <button onClick={() => setActiveUploadModal('rapport')} style={{ padding: '9px 14px', background: '#fff', color: '#334155', border: '1.5px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><FileUp size={15} /> {"Téléverser rapport"}</button>
            <button onClick={() => { setActiveUploadModal('preuves'); setPreuveUploadMissionId(''); setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null }) }} style={{ padding: '9px 14px', background: '#fff', color: '#334155', border: '1.5px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={15} /> Téléverser preuves frais</button>
          </>
          <button onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); resetMissionForm() }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{missionEditMode ? 'Modifier la mission' : 'Nouvelle demande de mission'}</strong>
            <button onClick={() => { setShowForm(false); resetMissionForm() }} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Annuler"}</button>
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
              {missionEditMode && <button className="btn" type="button" onClick={() => { resetMissionForm(); setFormSuccess(''); setFormError('') }} style={{background: '#6c757d', color: 'white'}}>{"Annuler"}</button>}
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
                  <button onClick={() => setActiveUploadModal(null)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Fermer"}</button>
                </div>
                {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
                {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}
                <form className="form-card" onSubmit={uploadRapport}>
                  <div style={{ background: '#d1ecf1', padding: '10px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #bee5eb', fontSize: '0.9em' }}>Le rapport ne peut être téléversé que pour une mission <strong>active</strong> (validée et activée).</div>
                  <div className="form-group"><label>Mission (ID opération)</label>
                    <select value={rapportUpload.id_operation} onChange={(e) => setRapportUpload({ ...rapportUpload, id_operation: e.target.value })}>
                      <option value="">Sélectionner une mission</option>
                      {[...items, ...workflowMissionnaire].filter((m, i, arr) => rowEtat[m.id_operation] === 'Active' && arr.findIndex(x => x.id_operation === m.id_operation) === i).map(m => (<option key={m.id_operation} value={m.id_operation}>#{m.id_operation} - {m.pays || '?'}, {m.ville || 'N/A'} (Active)</option>))}
                    </select>
                    {[...items, ...workflowMissionnaire].filter((m, i, arr) => rowEtat[m.id_operation] === 'Active' && arr.findIndex(x => x.id_operation === m.id_operation) === i).length === 0 && <p style={{ fontSize: '0.85em', color: '#856404', background: '#fff3cd', padding: '8px', borderRadius: '4px', marginTop: '8px' }}><AlertTriangle size={13}/> Aucune mission activée disponible.</p>}
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
                  <button onClick={() => setActiveUploadModal(null)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Fermer"}</button>
                </div>
                {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
                {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}
                <form className="form-card" onSubmit={uploadPreuveFrais}>
                  <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}><p style={{margin: 0, fontSize: '0.9rem', color: '#92400e'}}><strong>Important:</strong> Vous devez d'abord soumettre une demande de frais associée à une mission <strong>validée et activée</strong> pour pouvoir téléverser les preuves.</p></div>
                  <div className="form-group"><label>Mission (ID opération)</label>
                    <select value={preuveUploadMissionId} onChange={(e) => handleMissionPreuveSelect(e.target.value)} required>
                      <option value="">— Sélectionner une mission —</option>
                      {[...items, ...workflowMissionnaire].filter((m, i, arr) => m.a_des_frais && arr.findIndex(x => x.id_operation === m.id_operation) === i).map(m => (
                        <option key={m.id_operation} value={m.id_operation}>
                          #{m.id_operation} — {m.pays || '?'}{m.ville ? ', ' + m.ville : ''}{m.mission_comment ? ' (' + m.mission_comment + ')' : ''}
                        </option>
                      ))}
                    </select>
                    {[...items, ...workflowMissionnaire].filter((m, i, arr) => m.a_des_frais && arr.findIndex(x => x.id_operation === m.id_operation) === i).length === 0 &&
                      <p style={{ fontSize: '0.82rem', color: '#92400e', marginTop: 6 }}>Aucune mission avec demande de frais disponible.</p>}
                  </div>
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
              <th style={{ ...th, width: '7%' }}>{"Statut"}</th>
              <th style={{ ...th, width: '7%' }}>Date Création</th>
              {activeTab !== 'envoye' && <th style={{ ...th, width: '7%' }}>Envoyé Par</th>}
              <th style={{ ...th, width: '6%' }}>Date Départ</th>
              <th style={{ ...th, width: '6%' }}>Date Retour</th>
              <th style={{ ...th, width: '4%' }}>Durée</th>
              <th style={{ ...th, width: '8%' }}>Missionnaire(s)</th>
              <th style={{ ...th, width: '7%' }}>Destination(s)</th>
              <th style={{ ...th, width: '4%' }}>{"Rapport"}</th>
              <th style={{ ...th, width: '6%' }}>{"Paiement des frais"}</th>
              <th style={{ ...th, width: '5%' }}>État</th>
              <th style={{ ...th, width: '16%' }}>{"Actions"}</th>
            </tr>
          </thead>
          <tbody>{renderRows(pagination.pageItems, activeTab === 'recu')}</tbody>
        </table>
        <Pagination {...pagination} />
        {activeTab === 'recu' && estRh && workflowPcaAg.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ padding: '10px 14px', background: 'rgba(2,22,46,0.06)', borderLeft: '3px solid var(--bleu)', borderTop: '1px solid rgba(2,22,46,0.15)', borderBottom: '1px solid rgba(2,22,46,0.15)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--bleu)', letterSpacing: '0.02em' }}>
              Pour information — PCA / AG
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '18%' }}>Titre de demande</th>
                  <th style={{ ...th, width: '10%' }}>Demandeur</th>
                  <th style={{ ...th, width: '9%' }}>Statut</th>
                  <th style={{ ...th, width: '9%' }}>Date Création</th>
                  <th style={{ ...th, width: '9%' }}>Date Départ</th>
                  <th style={{ ...th, width: '9%' }}>Date Retour</th>
                  <th style={{ ...th, width: '5%' }}>Durée</th>
                  <th style={{ ...th, width: '17%' }}>État</th>
                  <th style={{ ...th, width: '14%' }}>Actions</th>
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
                    <tr
                      key={item.id_operation}
                      onClick={() => setSelectedOperationForWorkflow(item.id_operation)}
                      style={{ cursor: 'pointer' }}
                      title="Cliquez pour afficher le diagramme de progression"
                    >
                      <td style={td}>{item.titre || item.type_demande || 'Mission'} #{item.id_operation}</td>
                      <td style={td}>{item.demandeur?.nom_complet || item.demandeur?.nom || `#${item.matricule}`}</td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: /valid/i.test(item.statut) ? '#065f46' : /refus/i.test(item.statut) ? '#991b1b' : '#92400e', background: /valid/i.test(item.statut) ? '#d1fae5' : /refus/i.test(item.statut) ? '#fee2e2' : '#fef3c7' }}>{item.statut || 'En attente'}</span></td>
                      <td style={td} title={item.date_demande ? new Date(item.date_demande).toLocaleString('fr-FR') : ''}>{item.date_demande ? String(item.date_demande).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.date_depart ? String(item.date_depart).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.date_retour ? String(item.date_retour).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.duree_jours ?? item.duree ?? '--'} j</td>
                      <td style={td} onClick={(e) => e.stopPropagation()}>{etatBadge}</td>
                      <td style={td} onClick={(e) => e.stopPropagation()}>{renderActionButtons(item, true)}</td>
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

      {showRemplacantModal && (
        <RemplacantModal
          operationId={remplacantOpId}
          userRole={user?.role}
          userMatricule={user?.matricule}
          onClose={() => { setShowRemplacantModal(false); setRemplacantOpId(null) }}
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
              <button onClick={() => { setDetailMissionId(null); setDetailData(null) }} style={{ padding: '7px 14px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Fermer"}</button>
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
                        : <span style={{ color: '#ef4444', fontWeight: 700 }}>Impayé</span>}
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

      {/* Modal: Détail des frais de mission */}
      {detailFraisData && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setDetailFraisData(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Détail des Frais de Mission</strong>
              <button onClick={() => setDetailFraisData(null)} style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Fermer</button>
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
                  {_sec('Détail des frais')}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
                    <thead><tr style={{ background: '#f8fafc' }}>
                      <th style={{ ...th, fontSize: '0.67rem' }}>Poste</th>
                      <th style={{ ...th, fontSize: '0.67rem' }}>Base</th>
                      <th style={{ ...th, fontSize: '0.67rem' }}>Qté</th>
                      <th style={{ ...th, fontSize: '0.67rem', textAlign: 'right' }}>Total (FCFA)</th>
                    </tr></thead>
                    <tbody>
                      <tr><td style={td}>Transport / Voyage</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_fmt(_transport)} FCFA</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>forfait</td><td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_transport)}</td></tr>
                      <tr><td style={td}>Hôtel</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_nuits > 0 ? `${_fmt(Math.round(_hotel/_nuits))} FCFA/nuit` : `${_fmt(_hotel)} FCFA`}</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_nuits > 0 ? `${_nuits} nuit${_nuits!==1?'s':''}` : '—'}</td><td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_hotel)}</td></tr>
                      <tr><td style={td}>Déplacement</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_fmt(Math.round(_depl/_jours))} FCFA/j` : `${_fmt(_depl)} FCFA`}</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_jours} j` : '—'}</td><td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_depl)}</td></tr>
                      <tr><td style={td}>Per diem (nutrition)</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_fmt(Math.round(_nutri/_jours))} FCFA/j` : `${_fmt(_nutri)} FCFA`}</td><td style={{ ...td, color: '#64748b', fontSize: '0.7rem' }}>{_jours > 0 ? `${_jours} j` : '—'}</td><td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{_fmt(_nutri)}</td></tr>
                      <tr style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderTop: '2px solid #16a34a' }}><td colSpan={3} style={{ ...td, fontWeight: 800, fontSize: '0.88rem', color: '#14532d' }}>TOTAL</td><td style={{ ...td, fontWeight: 800, fontSize: '0.98rem', color: '#16a34a', textAlign: 'right' }}>{_fmt(_total)} FCFA</td></tr>
                    </tbody>
                  </table>
                  {_sec('État du paiement')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 4 }}>
                    <div><span style={{ fontSize: '0.68rem', color: '#64748b' }}>Confirmation missionnaire</span><p style={{ margin: '3px 0 0', fontSize: '0.8rem', fontWeight: 600 }}>{_d.frais_valides_missionnaire ? <span style={{ color: '#16a34a' }}>✓ Confirmé</span> : <span style={{ color: '#dc2626' }}>✗ En attente</span>}</p></div>
                    <div><span style={{ fontSize: '0.68rem', color: '#64748b' }}>Validation RH</span><p style={{ margin: '3px 0 0', fontSize: '0.8rem', fontWeight: 600 }}>{_d.frais_valides_rh ? <span style={{ color: '#16a34a' }}>✓ Validé</span> : <span style={{ color: '#dc2626' }}>✗ En attente</span>}</p></div>
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: '0.68rem', color: '#64748b' }}>Statut final</span><p style={{ margin: '3px 0 0' }}>{_d.frais_payes ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#14532d', fontWeight: 800 }}><Banknote size={15}/> Payé{_d.date_paiement_frais ? ` le ${fmtDate(_d.date_paiement_frais)}` : ''}</span> : _d.frais_valides_missionnaire ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#92400e', fontWeight: 700 }}><Clock size={13}/> En attente RH</span> : <span style={{ color: '#991b1b', fontWeight: 700 }}>Non payé</span>}</p></div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Modal: Rapport de mission */}
      {rapportModalOp && (
        <RapportModal
          idOperation={rapportModalOp}
          matricule={matricule}
          missionStatuts={missionStatuts}
          estMissionnaire={workflowMissionnaire.some(m => m.id_operation === rapportModalOp)}
          onClose={() => setRapportModalOp(null)}
          onUploaded={() => { loadData(); setRapportModalOp(null) }}
        />
      )}
    </div>
  )
}
