import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import WorkflowModal from '../components/WorkflowModal'
import RemplacantModal from '../components/RemplacantModal'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import ModifiedBadge from '../components/ModifiedBadge'
import { operationLabel } from '../utils/operationLabel'
import '../styles/Operations.css'

import {
  ClipboardList, AlertTriangle, Calendar, FileText, Pin, Clock, Search, CheckCircle, Upload, Eye, Download, Trash2, X, FileDown, Users2
} from 'lucide-react'

const PERMISSIONS_CONVENTIONNELLES = {
  'mariage': {
    label: 'Mariage',
    sousTypes: [
      { value: 'salarie', label: 'Mariage du travailleur', duree: 4 },
      { value: 'enfant', label: 'Mariage d\'un enfant du travailleur', duree: 2 }
    ]
  },
  'paternite': {
    label: 'Paternité',
    sousTypes: [
      { value: 'epouse', label: 'Naissance de l\'enfant (conjointe)', duree: 3 }
    ]
  },
  'bapteme': {
    label: 'Baptême',
    sousTypes: [
      { value: 'enfant', label: 'Baptême d\'un enfant du travailleur', duree: 1 }
    ]
  },
  'deces': {
    label: 'Décès',
    sousTypes: [
      { value: 'conjoint', label: 'Décès du conjoint du travailleur', duree: 5 },
      { value: 'enfant', label: 'Décès d\'un enfant du travailleur', duree: 3 },
      { value: 'pere', label: 'Décès du père du travailleur', duree: 5 },
      { value: 'mere', label: 'Décès de la mère du travailleur', duree: 5 },
      { value: 'beau_pere', label: 'Décès du père du conjoint légitime', duree: 3 },
      { value: 'belle_mere', label: 'Décès de la mère du conjoint légitime', duree: 3 },
      { value: 'frere', label: 'Décès du frère du travailleur', duree: 3 },
      { value: 'soeur', label: 'Décès de la sœur du travailleur', duree: 3 }
    ]
  },
  'maladie': {
    label: 'Maladie',
    sousTypes: [
      { value: 'certifiee', label: 'Maladie (avec justificatif médical)', duree: 3 }
    ]
  },
  'maternelle': {
    label: 'Maternité',
    sousTypes: [
      { value: 'simple', label: 'Congé maternité (16 semaines)', duree: 112 },
      { value: 'pathologique', label: 'Congé maternité pathologique (18 semaines)', duree: 126 }
    ]
  }
}

const DOCUMENTS_REQUIS = {
  'mariage': {
    titre: 'Mariage',
    documents: [
      { label: 'Mariage du travailleur (4j)', doc: 'Copie certifiée conforme de l\'acte de mariage' },
      { label: 'Mariage d\'un enfant (2j)', doc: 'Copie certifiée conforme de l\'acte de mariage' }
    ],
    delai: '72h à l\'avance'
  },
  'paternite': {
    titre: 'Paternité',
    documents: [
      { label: 'Naissance de l\'enfant (3j)', doc: 'Certificat médical ou acte de naissance' }
    ],
    delai: '48h après l\'événement'
  },
  'bapteme': {
    titre: 'Baptême',
    documents: [
      { label: 'Baptême d\'un enfant (1j)', doc: 'Certificat ou attestation de l\'établissement religieux' }
    ],
    delai: '72h à l\'avance'
  },
  'deces': {
    titre: 'Décès',
    documents: [
      { label: 'Décès du conjoint (5j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès d\'un enfant (3j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès du père ou de la mère (5j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès du père ou de la mère du conjoint (3j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès du frère ou de la sœur (3j)', doc: 'Acte de décès ou certificat de décès' }
    ],
    delai: '48h après l\'événement'
  },
  'maladie': {
    titre: 'Maladie',
    documents: [
      { label: 'Maladie (3j)', doc: 'Certificat médical' }
    ],
    delai: '48h après l\'événement'
  },
  'maternelle': {
    titre: 'Maternité',
    documents: [
      { label: 'Maternité (16 sem = 112j / 18 sem pathologique = 126j)', doc: 'Certificat médical d\'accouchement' }
    ],
    delai: '48h après l\'événement'
  }
}

function infererTypePermissionDepuisPermission(permission) {
  if (!permission) return ''
  const brut = String(permission.type_permission || permission.type || permission.motif || '').toLowerCase().trim()
  if (brut.includes('mariage')) return 'mariage'
  if (brut.includes('accouchement') || brut.includes('paternit')) return 'paternite'
  if (brut.includes('malad')) return 'maladie'
  if (brut.includes('bapteme') || brut.includes('baptême')) return 'bapteme'
  if (brut.includes('deces') || brut.includes('décès')) return 'deces'
  if (brut.includes('matern')) return 'maternelle'
  const sousType = String(permission.sous_type || '').toLowerCase().trim()
  const duree = Number(permission.duree_jours || permission.duree || 0)
  if (['conjoint', 'pere', 'mere', 'beau_pere', 'belle_mere', 'frere', 'soeur'].includes(sousType)) return 'deces'
  if (sousType === 'epouse') return 'paternite'
  if (['simple', 'pathologique'].includes(sousType)) return 'maternelle'
  if (sousType === 'salarie') return 'mariage'
  if (sousType === 'enfant') {
    if (duree === 1) return 'bapteme'
    if (duree === 2) return 'mariage'
    if (duree === 3) return 'deces'
  }
  return ''
}

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }
const initialPermForm = { type_permission: '', sous_type: '', duree: 1, date_debut: '', date_fin: '', motif: '' }
const initialPermNonConvForm = { date_debut: '', date_fin: '', motif: '' }
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
const addWorkingDays = (start, workingDays) => {
  const begin = new Date(start)
  if (Number.isNaN(begin.getTime()) || !workingDays || workingDays < 1) return null

  let counted = 0
  while (counted < workingDays) {
    const weekday = begin.getDay()
    if (weekday !== 0 && weekday !== 6) counted += 1
    if (counted < workingDays) begin.setDate(begin.getDate() + 1)
  }
  return begin
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
const normalizePermissionsWorkflow = (rows, label, bucket) => (Array.isArray(rows) ? rows : [])
  .filter((item) => normalizeText(item?.type_demande) === 'permission')
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
const cleanNonConventionalMotif = (value) => String(value || '').replace(/^Permission non-conventionnelle:\s*/i, '').trim()

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
        <option value="">Tous états</option>
        {['--', 'AttenteRH', 'Active', 'ClotureDemandee', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>{"Réinitialiser les filtres"}</button>}
    </div>
  )
}

function ProuvesModal({ idOperation, onClose, onUploaded, readOnly = false }) {
  const [preuves, setPreuves] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = React.useRef(null)

  const charger = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/permissions/${idOperation}/preuves`)
      setPreuves(Array.isArray(res.data) ? res.data : [])
    } catch {
      setPreuves([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [idOperation])

  const buildUrl = (p) => {
    const base = (api.defaults.baseURL || '').replace(/\/$/, '')
    return `${base}${p.url}`
  }

  const supprimer = async (idPreuve) => {
    if (!window.confirm('Supprimer cette preuve ?')) return
    try {
      await api.delete(`/api/permissions/${idOperation}/preuves/${idPreuve}`)
      await charger()
      onUploaded()
    } catch {
      setError('Erreur lors de la suppression')
    }
  }

  const uploader = async (e) => {
    e.preventDefault()
    const files = fileRef.current?.files
    if (!files || files.length === 0) { setError('Sélectionnez au moins un fichier'); return }
    setUploading(true)
    setError('')
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('fichier', file)
        await api.post(`/api/permissions/${idOperation}/televerser-preuves`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      if (fileRef.current) fileRef.current.value = ''
      await charger()
      onUploaded()
    } catch {
      setError('Erreur lors du téléversement')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 540, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={16} style={{ color: '#475569' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Documents justificatifs</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Permission #{idOperation}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <X size={15} />
          </button>
        </div>

        {/* File list */}
        <div style={{ padding: '16px 22px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.85rem' }}>Chargement…</div>
          ) : preuves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#cbd5e1', fontSize: '0.85rem' }}>
              <Upload size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              Aucun document téléversé
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preuves.map(p => (
                <div key={p.id_preuve} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9' }}>
                  <FileText size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.82rem', color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nom_fichier}>{p.nom_fichier}</span>
                  {p.date_upload && <span style={{ fontSize: '0.71rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{new Date(p.date_upload).toLocaleDateString('fr-FR')}</span>}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <a href={buildUrl(p)} target="_blank" rel="noopener noreferrer" title="Ouvrir" style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', textDecoration: 'none' }}><Eye size={13} /></a>
                    <a href={buildUrl(p)} download={p.nom_fichier} title="Télécharger" style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', textDecoration: 'none' }}><Download size={13} /></a>
                    {!readOnly && <button onClick={() => supprimer(p.id_preuve)} title="Supprimer" style={{ width: 30, height: 30, border: '1px solid #fecaca', borderRadius: 7, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload form - hidden for read-only view (validators) */}
        {!readOnly && <div style={{ padding: '14px 22px 20px', borderTop: '1px solid #f1f5f9' }}>
          <form onSubmit={uploader} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Ajouter un ou plusieurs fichiers</label>
            <input ref={fileRef} type="file" multiple style={{ fontSize: '0.82rem', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: 8, cursor: 'pointer', color: '#475569', background: '#f8fafc' }} />
            {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={uploading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: uploading ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.82rem', alignSelf: 'flex-start' }}>
              <Upload size={14} />{uploading ? 'Téléversement…' : 'Téléverser'}
            </button>
          </form>
        </div>}
      </div>
    </div>
  )
}

export default function PermissionsPage() {
  const { user } = useAuth()
  const [sexeEmploye, setSexeEmploye] = useState('')
  const [activeTab, setActiveTab] = useState('envoye')
  const [items, setItems] = useState([])
  const [workflowEnvoye, setWorkflowEnvoye] = useState([])
  const [workflowAValider, setWorkflowAValider] = useState([])
  const [workflowValide, setWorkflowValide] = useState([])
  const [workflowRefuse, setWorkflowRefuse] = useState([])
  const [workflowPcaAg, setWorkflowPcaAg] = useState([])
  const [rowEtat, setRowEtat] = useState({})
  const [loadingOp, setLoadingOp] = useState(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterEmetteur, setFilterEmetteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [soldeConges, setSoldeConges] = useState(null)
  const [loading, setLoading] = useState(true)
  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])
  const [showForm, setShowForm] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(null)
  const matricule = useMemo(() => Number(user?.matricule || user?.sub || 0), [user])
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const estRh = useMemo(() => ['RH', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])
  const peutCreerPourAutrui = useMemo(() => ['RH', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])

  // Form state
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [permissionType, setPermissionType] = useState('conventionnelle')
  const [matriculeCible, setMatriculeCible] = useState('')
  const [permForm, setPermForm] = useState(initialPermForm)
  const [permNonConvForm, setPermNonConvForm] = useState(initialPermNonConvForm)
  const [permissionEditMode, setPermissionEditMode] = useState(false)
  const [permissionEditId, setPermissionEditId] = useState(null)
  const [permNonConvEditMode, setPermNonConvEditMode] = useState(false)
  const [permNonConvEditId, setPermNonConvEditId] = useState(null)
  const [permissionPreuveUpload, setPermissionPreuveUpload] = useState({ id_operation: '', files: [] })
  const [prevuesPermissionEnCours, setPrevuesPermissionEnCours] = useState([])
  const [voirTousDocuments, setVoirTousDocuments] = useState(false)
  const [typePermissionDocuments, setTypePermissionDocuments] = useState('')
  const [showUploadSection, setShowUploadSection] = useState(false)
  const [selectedOperationForWorkflow, setSelectedOperationForWorkflow] = useState(null)
  const [detailPermissionItem, setDetailPermissionItem] = useState(null)
  const [showRemplacantModal, setShowRemplacantModal] = useState(false)
  const [remplacantOpId, setRemplacantOpId] = useState(null)
  const [preuveModalItem, setProuveModalItem] = useState(null)

  const filteredPermissionTypes = useMemo(() => {
    const sex = String(sexeEmploye || '').toUpperCase()
    return Object.entries(PERMISSIONS_CONVENTIONNELLES).filter(([key]) => {
      if (key === 'maternelle' && sex === 'M') return false
      if (key === 'paternite' && sex === 'F') return false
      return true
    })
  }, [sexeEmploye])

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const opId = searchParams.get('operationId')
    if (opId) setSelectedOperationForWorkflow(Number(opId))
    const tab = searchParams.get('tab')
    if (tab === 'recu' || tab === 'envoye') setActiveTab(tab)
  }, [])

  const permissionsEligibles = useMemo(() => {
    return items.filter(p => p.statut === 'validé' && p.statut_activation === 'ACTIVE' && !p.statut_cloture)
  }, [items])

  const permissionsById = useMemo(() => {
    const map = new Map()
    items.forEach((item) => {
      map.set(item.id_operation, item)
    })
    return map
  }, [items])

  const sousTypesDisponibles = useMemo(() => {
    const typeConfig = PERMISSIONS_CONVENTIONNELLES[permForm.type_permission]
    return typeConfig ? typeConfig.sousTypes : []
  }, [permForm.type_permission])

  // Auto-calc date_fin for conventionnelle
  useEffect(() => {
    if (permForm.type_permission && permForm.sous_type && permForm.date_debut) {
      const typeConfig = PERMISSIONS_CONVENTIONNELLES[permForm.type_permission]
      if (typeConfig) {
        const sousTypeConfig = typeConfig.sousTypes.find(st => st.value === permForm.sous_type)
        if (sousTypeConfig && sousTypeConfig.duree) {
          const dateFin = addWorkingDays(permForm.date_debut, sousTypeConfig.duree)
          if (dateFin) {
            setPermForm(prev => ({ ...prev, date_fin: dateFin.toISOString().split('T')[0], duree: sousTypeConfig.duree }))
          }
        }
      }
    }
  }, [permForm.type_permission, permForm.sous_type, permForm.date_debut])

  useEffect(() => {
    if (!permissionPreuveUpload.id_operation) { setTypePermissionDocuments(''); return }
    const sel = permissionsEligibles.find(p => String(p.id_operation) === String(permissionPreuveUpload.id_operation))
    setTypePermissionDocuments(infererTypePermissionDepuisPermission(sel))
    setVoirTousDocuments(false)
  }, [permissionPreuveUpload.id_operation, permissionsEligibles])

  async function loadData() {
    if (!user?.matricule) { setLoading(false); return }
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get(`/api/permissions/mes-permissions/${user.matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/boite/${user.matricule}`).catch(() => ({ data: {} })),
        api.get(`/api/conges/solde/${user.matricule}`).catch(() => ({ data: {} }))
      ])
      const sent = Array.isArray(r1.data) ? r1.data : []
      const boite = r2?.data || {}
      setItems(sent)
      const envoyeNorm = normalizePermissionsWorkflow(boite.envoye, 'Envoyée', 'envoye')
      const aValiderNorm = normalizePermissionsWorkflow(boite.recu, 'À valider', 'recu')
      const valideNorm = normalizePermissionsWorkflow(boite.valide, 'Validée par moi', 'valide')
      const refuseNorm = normalizePermissionsWorkflow(boite.refuse, 'Refusée par moi', 'refuse')
      const pcaAgRaw = (boite.recu_pca_ag || []).filter(o => (o.type_demande || '').toLowerCase().includes('permission'))
      const pcaAgNorm = normalizePermissionsWorkflow(pcaAgRaw, 'PCA/AG', 'recu_pca_ag')
      setWorkflowEnvoye(envoyeNorm)
      setWorkflowAValider(aValiderNorm)
      setWorkflowValide(valideNorm)
      setWorkflowRefuse(refuseNorm)
      setWorkflowPcaAg(pcaAgNorm)
      setRowEtat(initRowEtatFromApi([...envoyeNorm, ...aValiderNorm, ...valideNorm, ...refuseNorm]))
      setSoldeConges(Number(r3?.data?.solde_conges ?? 0))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user?.matricule])

  // Actualisation automatique toutes les 30 secondes
  useAutoRefresh(loadData)

  // Keep detail modal in sync when items refresh (e.g. after proof upload)
  useEffect(() => {
    setDetailPermissionItem(prev => {
      if (!prev) return prev
      const fresh = items.find(p => p.id_operation === prev.id_operation)
      if (!fresh) return prev
      return { ...prev, preuves_televersees: fresh.preuves_televersees, preuves: fresh.preuves, date_telechargement_preuves: fresh.date_telechargement_preuves, date_limite_preuves: fresh.date_limite_preuves }
    })
  }, [items])

  useEffect(() => {
    if (!user?.matricule) return
    api.get(`/employees/${user.matricule}`).then((res) => {
      setSexeEmploye(String(res?.data?.sexe || '').toUpperCase())
    }).catch(() => setSexeEmploye(''))
  }, [user?.matricule])

  useEffect(() => {
    if (!permForm.type_permission) return
    const allowed = new Set(filteredPermissionTypes.map(([key]) => key))
    if (!allowed.has(permForm.type_permission) && permForm.type_permission !== 'maladie') {
      setPermForm((prev) => ({ ...prev, type_permission: '', sous_type: '' }))
    }
  }, [filteredPermissionTypes, permForm.type_permission])

  const resetConventionnelleForm = () => {
    setPermForm(initialPermForm)
    setPermissionEditMode(false)
    setPermissionEditId(null)
  }

  const resetNonConventionnelleForm = () => {
    setPermNonConvForm(initialPermNonConvForm)
    setPermNonConvEditMode(false)
    setPermNonConvEditId(null)
  }

  async function submitPermission(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    try {
      const mat = (peutCreerPourAutrui && matriculeCible) ? Number(matriculeCible) : matricule
      if (!mat || Number.isNaN(mat)) { setFormError('Matricule cible invalide'); return }
      if (permissionEditMode && permissionEditId) {
        await api.put(`/api/permissions/${permissionEditId}/modifier`, null, {
          params: { type_permission: permForm.type_permission, sous_type: permForm.sous_type || null, date_debut: permForm.date_debut, date_fin: permForm.date_fin, motif: permForm.motif || null }
        })
        setFormSuccess('Permission conventionnelle modifiée')
        resetConventionnelleForm()
        setShowForm(false)
      } else {
        await api.post('/api/permissions/conventionnelle', null, {
          params: { matricule: mat, matricule_createur: matricule, type_permission: permForm.type_permission, sous_type: permForm.sous_type || null, duree: Number(permForm.duree || 1), date_debut: permForm.date_debut, date_fin: permForm.date_fin, motif: permForm.motif || null }
        })
        setFormSuccess('Demande de permission conventionnelle soumise')
        resetConventionnelleForm()
        setShowForm(false)
      }
      await loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur création/modification permission') }
  }

  async function submitPermissionNonConventionnelle(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    try {
      const mat = (peutCreerPourAutrui && matriculeCible) ? Number(matriculeCible) : matricule
      if (!mat || Number.isNaN(mat)) { setFormError('Matricule cible invalide'); return }
      if (permNonConvEditMode && permNonConvEditId) {
        await api.put(`/api/permissions/${permNonConvEditId}/modifier`, null, {
          params: { date_debut: permNonConvForm.date_debut, date_fin: permNonConvForm.date_fin, motif: permNonConvForm.motif ? `Permission non-conventionnelle: ${permNonConvForm.motif}` : 'Permission non-conventionnelle' }
        })
        setFormSuccess('Permission non-conventionnelle modifiée')
        resetNonConventionnelleForm()
        setShowForm(false)
      } else {
        await api.post('/api/permissions/non-conventionnelle', null, {
          params: { matricule: mat, matricule_createur: matricule, duree: calcWorkingDays(permNonConvForm.date_debut, permNonConvForm.date_fin), date_debut: permNonConvForm.date_debut, date_fin: permNonConvForm.date_fin, motif: permNonConvForm.motif ? `Permission non-conventionnelle: ${permNonConvForm.motif}` : 'Permission non-conventionnelle' }
        })
        setFormSuccess('Demande de permission non-conventionnelle soumise (déduit du solde de congés)')
        resetNonConventionnelleForm()
        setShowForm(false)
      }
      await loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur création/modification permission non-conventionnelle') }
  }

  async function uploadPreuvePermission(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    if (!permissionPreuveUpload.id_operation || permissionPreuveUpload.files.length === 0) { setFormError('Veuillez renseigner ID opération et sélectionner au moins un fichier'); return }
    try {
      for (const file of permissionPreuveUpload.files) {
        const fd = new FormData()
        fd.append('fichier', file)
        await api.post(`/api/permissions/${permissionPreuveUpload.id_operation}/televerser-preuves`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        setPrevuesPermissionEnCours(prev => [...prev, { filename: file.name }])
      }
      setFormSuccess(`${permissionPreuveUpload.files.length} preuve(s) de permission téléversée(s) avec succès!`)
      setPermissionPreuveUpload({ id_operation: '', files: [] })
      await loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur téléversement preuve permission') }
  }

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_demande || item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = normalizeText(normalizeListStatus(item.statut || item.status || 'en attente'))
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Permission').toLowerCase()
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
    if (!confirm("Êtes-vous sûr de vouloir annuler cette demande ?")) return
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
      const response = await api.post(`/api/permissions/activation/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
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
      const response = await api.post(`/api/permissions/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur clôture: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleRetourAnticipe = async (id) => {
    if (!confirm("Êtes-vous sûr de vouloir déclarer un retour anticipé ?")) return
    setLoadingOp(id)
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await api.post(`/api/permissions/cloture/${id}/demandeur`, null, { params: { matricule_demandeur: user.matricule, retour_anticipe: true, date_retour_anticipe: today } })
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
      const response = await api.post(`/api/permissions/activation/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
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
      const response = await api.post(`/api/permissions/cloture/${id}/rh`, null, { params: { matricule_rh: user.matricule } })
      if (response?.data?.message) alert(response.data.message)
      await loadData()
    } catch (err) {
      alert('Erreur clôture RH: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setLoadingOp(null)
    }
  }

  const handleEditPermission = (item) => {
    const detail = permissionsById.get(item.id_operation) || item
    const dateDebut = detail.date_debut ? String(detail.date_debut).slice(0, 10) : ''
    const dateFin = detail.date_fin ? String(detail.date_fin).slice(0, 10) : ''
    const estConventionnelle = detail.est_conventionnelle !== false && detail.type_permission !== 'non_conventionnelle'

    setShowForm(true)
    setFormError('')
    setFormSuccess('')

    if (estConventionnelle) {
      const inferredType = detail.type_permission && detail.type_permission !== 'conventionnelle'
        ? detail.type_permission
        : infererTypePermissionDepuisPermission(detail)
      setPermissionType('conventionnelle')
      setPermForm({
        type_permission: inferredType || 'maladie',
        sous_type: detail.sous_type || '',
        duree: detail.duree_jours || 1,
        date_debut: dateDebut,
        date_fin: dateFin,
        motif: detail.motif || ''
      })
      setPermissionEditMode(true)
      setPermissionEditId(detail.id_operation)
      setPermNonConvEditMode(false)
      setPermNonConvEditId(null)
    } else {
      setPermissionType('non-conventionnelle')
      setPermNonConvForm({
        date_debut: dateDebut,
        date_fin: dateFin,
        motif: cleanNonConventionalMotif(detail.motif)
      })
      setPermNonConvEditMode(true)
      setPermNonConvEditId(detail.id_operation)
      setPermissionEditMode(false)
      setPermissionEditId(null)
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
    const eyeBtn = <button key="eye" onClick={(e) => { e.stopPropagation(); setDetailPermissionItem({ ...item, ...(permissionsById.get(item.id_operation) || {}) }) }} style={{ ...rowBtn, background: '#6366f1' }} title="Voir détails"><Eye size={12} /></button>
    const pdfBtn = isValid ? <button key="pdf" onClick={(e) => { e.stopPropagation(); setDownloadingPdf(id); api.get(`/api/pdf/permission/${id}`, { responseType: 'blob' }).then(res => { const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `permission_${id}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }).finally(() => setDownloadingPdf(null)) }} style={{ ...rowBtn, background: '#0e7490', display: 'inline-flex', alignItems: 'center', opacity: downloadingPdf === id ? 0.6 : 1 }} disabled={downloadingPdf === id} title="Télécharger PDF"><FileDown size={13} /></button> : null
    const remplacantBtn = <button key="remplacant" onClick={(e) => { e.stopPropagation(); setRemplacantOpId(id); setShowRemplacantModal(true) }} style={{ ...rowBtn, background: '#2563eb', display: 'inline-flex', alignItems: 'center' }} title="Remplaçant"><Users2 size={12} /></button>

    if (isRefus) return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{eyeBtn}</div>

    if (isRecu) {
      const canApprove = !isValid && item.__workflow_bucket === 'recu'
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'validé') }} style={okBtn} disabled={isLoading}>{"Approuver"}</button>}
          {canApprove && <button onClick={(e) => { e.stopPropagation(); handleWorkflow(id, 'refusé') }} style={dangerBtn} disabled={isLoading}>{"Refuser"}</button>}
          {estRh && isValid && etat === 'AttenteRH' && <button onClick={(e) => { e.stopPropagation(); handleActiverRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>}
          {estRh && isValid && etat === 'Active' && <button onClick={(e) => { e.stopPropagation(); handleCloturerRh(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : "Clôturer le congé"}</button>}
          {pdfBtn}{eyeBtn}{remplacantBtn}
        </div>
      )
    }

    if (!isValid) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); handleEditPermission(item) }} style={primaryBtn}>{"Modifier"}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAnnuler(id) }} style={dangerBtn}>{"Annuler"}</button>
          {eyeBtn}{remplacantBtn}
        </div>
      )
    }

    if (etat === '--') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleActiver(id) }} style={btnStyle(okBtn)} disabled={isLoading}>{isLoading ? '…' : 'Activer'}</button>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    if (etat === 'AttenteRH') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>{"En attente RH"}</span>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    if (etat === 'Active') {
      const dateFin = item.date_fin || item.date_retour
      const canRetourAnticipe = dateFin && new Date() < new Date(dateFin)
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button onClick={(e) => { e.stopPropagation(); handleCloturer(id) }} style={btnStyle(warnBtn)} disabled={isLoading}>{isLoading ? '…' : "Clôturer le congé"}</button>{canRetourAnticipe && <button onClick={(e) => { e.stopPropagation(); handleRetourAnticipe(id) }} style={btnStyle({ ...primaryBtn, background: '#3b82f6' })} disabled={isLoading}>{isLoading ? '…' : 'Retour anticipé'}</button>}{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    if (etat === 'ClotureDemandee') {
      return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: '#f59e0b22' }}>{"En attente confirmation RH"}</span>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
    }

    return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{pdfBtn}{eyeBtn}{remplacantBtn}</div>
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={isRecu ? 11 : 10} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_operation} onClick={() => setSelectedOperationForWorkflow(item.id_operation)} style={{ cursor: 'pointer' }}>
        <td style={td} title={operationLabel(item)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{operationLabel(item)}</span>
            <ModifiedBadge estModifie={item.est_modifie} dateModification={item.date_modification} />
          </div>
        </td>
        <td style={td}>{isRecu ? 'Approbations' : 'Permission'}</td>
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
        <td style={{ ...td, textAlign: 'center' }}>
          {(() => {
            // Utiliser permissionsById (données owner) ou les champs de l'item lui-même (visible pour les validateurs)
            const permInfo = permissionsById.get(item.id_operation)
            const estConv = permInfo?.est_conventionnelle ?? item.est_conventionnelle
            const aPreuves = permInfo?.preuves_televersees ?? item.preuves_televersees
            const isValidatorView = isRecu && !permInfo
            return estConv
              ? (aPreuves
                ? <button
                    title={permInfo?.date_telechargement_preuves ? `Téléversé le ${new Date(permInfo.date_telechargement_preuves).toLocaleString('fr-FR')}` : 'Preuves téléversées'}
                    onClick={(e) => { e.stopPropagation(); setProuveModalItem({ id_operation: item.id_operation, permInfo, readOnly: isValidatorView }) }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: '#d1fae5', color: '#065f46', border: 'none', cursor: 'pointer' }}>✓ Téléversées</button>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, background: '#f1f5f9', color: '#94a3b8' }}>—</span>)
              : <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>N/A</span>
          })()}
        </td>
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

  if (loading) return <div style={{ padding: 28 }}>{"Chargement..."}</div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>{"Gestion des Permissions"}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowUploadSection(true); setShowForm(false) }} style={{ padding: '9px 14px', background: '#fff', color: '#334155', border: '1.5px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={15} /> Téléverser preuves</button>
          <button onClick={() => { setShowForm(true); resetConventionnelleForm(); resetNonConventionnelleForm(); setPermissionType('conventionnelle'); setFormError(''); setFormSuccess(''); setShowUploadSection(false) }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{permissionEditMode || permNonConvEditMode ? 'Modifier la demande de permission' : 'Nouvelle demande de permission'}</strong>
            <button onClick={() => { setShowForm(false); resetConventionnelleForm(); resetNonConventionnelleForm(); setPermissionType('conventionnelle') }} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Annuler"}</button>
          </div>
          {formError && <div className="alert alert-danger" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div className="alert alert-success" style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}

          {/* Sous-onglets permission */}
          <div style={{display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px'}}>
            <button className={`btn ${permissionType === 'conventionnelle' ? 'btn-primary' : ''}`} onClick={() => setPermissionType('conventionnelle')} style={{minWidth: '150px', display:'inline-flex', alignItems:'center', gap:5}}>
              <ClipboardList size={13}/> Conventionnelle
            </button>
            <button className={`btn ${permissionType === 'non-conventionnelle' ? 'btn-primary' : ''}`} onClick={() => setPermissionType('non-conventionnelle')} style={{minWidth: '150px', display:'inline-flex', alignItems:'center', gap:5}}>
              <AlertTriangle size={13}/> Non-conventionnelle
            </button>
          </div>

          {permissionType === 'conventionnelle' && (
            <>
              <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
                <p style={{margin: 0, fontSize: '0.9rem', color: '#0369a1'}}>
                  <strong style={{display:'inline-flex',alignItems:'center',gap:5}}><Calendar size={13}/> Permission conventionnelle:</strong> Autorisée par le code du travail (maladie, décès, mariage, etc.). N'affecte pas votre solde de congés.
                </p>
              </div>
              <form className="form-card" onSubmit={submitPermission}>
                <h3>{permissionEditMode ? 'Modifier la permission conventionnelle' : 'Demande de permission conventionnelle'}</h3>
                {peutCreerPourAutrui && (
                  <div className="form-group">
                    <label>Matricule cible (optionnel)</label>
                    <input type="number" value={matriculeCible} onChange={(e) => setMatriculeCible(e.target.value)} placeholder="Laisser vide pour moi-même" />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Type de permission</label>
                    <select value={permForm.type_permission} onChange={(e) => setPermForm({ ...permForm, type_permission: e.target.value, sous_type: '', date_fin: '', duree: 1 })} required>
                      <option value="">-- Sélectionner un type --</option>
                      {filteredPermissionTypes.map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {sousTypesDisponibles.length > 0 && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Précision (selon Convention Collective Nationale du Commerce)</label>
                      <input list="sous-types-list-perm" value={permForm.sous_type} onChange={(e) => setPermForm({ ...permForm, sous_type: e.target.value })} placeholder="Sélectionnez ou saisissez..." required />
                      <datalist id="sous-types-list-perm">
                        {sousTypesDisponibles.map(st => (<option key={st.value} value={st.value}>{st.label} - {st.duree} jour{st.duree > 1 ? 's' : ''}</option>))}
                      </datalist>
                    </div>
                  </div>
                )}
                {sousTypesDisponibles.length > 0 && permForm.sous_type && (
                  <div style={{background: '#dbeafe', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem'}}>
                    <strong style={{display:'inline-flex',alignItems:'center',gap:5}}><ClipboardList size={13}/> Durée automatique:</strong> {(() => { const st = sousTypesDisponibles.find(s => s.value === permForm.sous_type); return st ? `${st.duree} jour${st.duree > 1 ? 's' : ''} selon la convention collective` : '' })()}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Date début</label>
                    <input type="date" value={permForm.date_debut} onChange={(e) => setPermForm({ ...permForm, date_debut: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Date fin {sousTypesDisponibles.length > 0 && permForm.sous_type ? '(calculée automatiquement)' : ''}</label>
                    <input type="date" value={permForm.date_fin} onChange={(e) => setPermForm({ ...permForm, date_fin: e.target.value })} readOnly={sousTypesDisponibles.length > 0 && !!permForm.sous_type} required style={sousTypesDisponibles.length > 0 && permForm.sous_type ? {background: '#f3f4f6', cursor: 'not-allowed'} : {}} />
                  </div>
                  <div className="form-group">
                    <label>Durée (jours)</label>
                    <input type="number" value={permForm.date_debut && permForm.date_fin ? calcWorkingDays(permForm.date_debut, permForm.date_fin) : (permForm.duree || 0)} readOnly style={{background: '#f3f4f6', cursor: 'not-allowed'}} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Motif</label>
                  <textarea value={permForm.motif} onChange={(e) => setPermForm({ ...permForm, motif: e.target.value })} />
                </div>
                <button className="btn btn-success" type="submit">{permissionEditMode ? 'Enregistrer' : 'Soumettre'}</button>
              </form>
            </>
          )}

          {permissionType === 'non-conventionnelle' && (<>
            <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#92400e', display:'flex', alignItems:'center', gap:6}}>
                <AlertTriangle size={13}/> <strong>Permission non-conventionnelle:</strong> Absence exceptionnelle. La durée sera <strong>déduite de votre solde de congés</strong>.
              </p>
            </div>
            <form className="form-card" onSubmit={submitPermissionNonConventionnelle}>
              <h3>{permNonConvEditMode ? 'Modifier la permission non-conventionnelle' : 'Demande de permission non-conventionnelle'}</h3>
              {peutCreerPourAutrui && (
                <div className="form-group">
                  <label>Matricule cible (optionnel)</label>
                  <input type="number" value={matriculeCible} onChange={(e) => setMatriculeCible(e.target.value)} placeholder="Laisser vide pour moi-même" />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Date début</label>
                  <input type="date" value={permNonConvForm.date_debut} onChange={(e) => setPermNonConvForm({ ...permNonConvForm, date_debut: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Date fin</label>
                  <input type="date" value={permNonConvForm.date_fin} onChange={(e) => setPermNonConvForm({ ...permNonConvForm, date_fin: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Durée (jours) - Sera déduite du solde</label>
                  <input type="number" value={calcWorkingDays(permNonConvForm.date_debut, permNonConvForm.date_fin)} readOnly />
                </div>
              </div>
              <div className="form-group">
                <label>Motif (obligatoire)</label>
                <textarea value={permNonConvForm.motif} onChange={(e) => setPermNonConvForm({ ...permNonConvForm, motif: e.target.value })} required placeholder="Expliquez la raison de cette permission non-conventionnelle..." />
              </div>
              <button className="btn btn-success" type="submit">{permNonConvEditMode ? 'Enregistrer' : 'Soumettre'}</button>
            </form>
          </>)}
        </div>
      )}

      {showUploadSection && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowUploadSection(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Téléversement de preuves de permission</strong>
            <button onClick={() => setShowUploadSection(false)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{"Fermer"}</button>
          </div>
          {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}
          <form className="form-card" onSubmit={uploadPreuvePermission}>
            <h3>Téléversement des preuves</h3>
            <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#92400e', display:'flex', alignItems:'flex-start', gap:5}}>
                <AlertTriangle size={12} style={{flexShrink:0, marginTop:2}}/> <span><strong>Important:</strong> Vous ne pouvez téléverser une preuve que pour une permission <strong>validée et activée</strong>. Le téléversement de la preuve permet de <strong>clôturer la permission</strong>.</span>
              </p>
            </div>
            {permissionsEligibles.length > 0 && (
              <div className="form-group">
                <label>Sélectionnez la permission</label>
                <select value={permissionPreuveUpload.id_operation} onChange={(e) => { setPermissionPreuveUpload({ ...permissionPreuveUpload, id_operation: e.target.value }); setVoirTousDocuments(false) }} required>
                  <option value="">-- Choisir une permission --</option>
                  {permissionsEligibles.map(p => (<option key={p.id_operation} value={p.id_operation}>ID {p.id_operation} - {p.type_permission} ({new Date(p.date_debut).toLocaleDateString('fr-FR')} au {new Date(p.date_fin).toLocaleDateString('fr-FR')})</option>))}
                </select>
              </div>
            )}
            <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
              <p style={{margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#0c4a6e', display:'flex', alignItems:'center', gap:5}}><FileText size={13}/> ARTICLE 7 - Documents requis</p>
              <div className="form-group" style={{marginBottom: '12px'}}>
                <label style={{fontSize: '0.85rem', color: '#075985'}}>Type de document à afficher</label>
                <select value={voirTousDocuments ? '__all__' : (typePermissionDocuments || '')} onChange={(e) => { const v = e.target.value; if (v === '__all__') { setVoirTousDocuments(true) } else { setTypePermissionDocuments(v); setVoirTousDocuments(false) } }}>
                  <option value="__all__">Tous les types</option>
                  {filteredPermissionTypes.map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              {(() => {
                if (typePermissionDocuments && !voirTousDocuments && DOCUMENTS_REQUIS[typePermissionDocuments]) {
                  const info = DOCUMENTS_REQUIS[typePermissionDocuments]
                  return (<>
                    <div style={{background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '10px'}}>
                      <p style={{margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#0369a1', display:'flex', alignItems:'center', gap:4}}><Pin size={12}/> {info.titre}</p>
                      <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#0c4a6e', lineHeight: '1.6'}}>{info.documents.map((doc, idx) => (<li key={idx}><strong>{doc.label}:</strong> {doc.doc}</li>))}</ul>
                      <p style={{margin: '8px 0 0 0', fontSize: '0.75rem', color: '#075985', fontStyle: 'italic'}}><Clock size={12} style={{verticalAlign:'middle', marginRight:4}}/> Délai de demande: {info.delai}</p>
                    </div>
                    <button type="button" onClick={() => setVoirTousDocuments(true)} style={{background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: '5px'}}><ClipboardList size={12} style={{verticalAlign:'middle', marginRight:3}}/> Voir tous les types de permissions</button>
                  </>)
                } else {
                  return (<>
                    {Object.entries(DOCUMENTS_REQUIS).map(([type, info]) => (
                      <div key={type} style={{background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '8px'}}>
                        <p style={{margin: '0 0 5px 0', fontSize: '0.8rem', fontWeight: 'bold', color: '#0369a1'}}>{info.titre}</p>
                        <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#0c4a6e', lineHeight: '1.5'}}>{info.documents.map((doc, idx) => (<li key={idx}><strong>{doc.label}:</strong> {doc.doc}</li>))}</ul>
                      </div>
                    ))}
                    {typePermissionDocuments && voirTousDocuments && (
                      <button type="button" onClick={() => setVoirTousDocuments(false)} style={{background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: '5px'}}><Pin size={12} style={{verticalAlign:'middle', marginRight:3}}/> Voir uniquement mon type sélectionné</button>
                    )}
                  </>)
                }
              })()}
              <p style={{margin: '12px 0 0 0', fontSize: '0.75rem', color: '#075985', fontStyle: 'italic', paddingTop: '10px', borderTop: '1px solid #bae6fd'}}>
                <strong style={{display:'inline-flex',alignItems:'center',gap:4}}><Calendar size={12}/> Délais généraux:</strong> Documents à fournir dans les 60 jours (Article 7). Limite annuelle: 12 jours par année calendaire (hors maternité).
              </p>
            </div>
            {permissionsEligibles.length > 0 ? (<>
              <div className="form-group">
                <label>Fichiers preuve (sélectionnez un ou plusieurs fichiers)</label>
                <input type="file" multiple onChange={(e) => setPermissionPreuveUpload({ ...permissionPreuveUpload, files: Array.from(e.target.files || []) })} required />
                {permissionPreuveUpload.files.length > 0 && <p style={{fontSize: '0.85rem', color: '#666', marginTop: '5px'}}>{permissionPreuveUpload.files.length} fichier(s) sélectionné(s)</p>}
              </div>
              <button className="btn btn-primary" type="submit" disabled={permissionPreuveUpload.files.length === 0}>Téléverser {permissionPreuveUpload.files.length > 0 ? `${permissionPreuveUpload.files.length} fichier(s)` : "preuves"}</button>
              {prevuesPermissionEnCours.length > 0 && (
                <div className="form-card" style={{background: '#d1e7dd', marginTop: '20px'}}>
                  <h3 style={{display:'flex',alignItems:'center',gap:6}}><CheckCircle size={14}/> Preuves téléversées ({prevuesPermissionEnCours.length})</h3>
                  <ul style={{margin: '10px 0', paddingLeft: '20px'}}>{prevuesPermissionEnCours.map((p, idx) => (<li key={idx} style={{marginBottom: '5px'}}><strong>{p.filename}</strong></li>))}</ul>
                  <button className="btn btn-info" onClick={() => { setPermissionPreuveUpload({ id_operation: permissionPreuveUpload.id_operation, files: [] }); setFormSuccess('') }} style={{marginTop: '10px'}}>+ Téléverser d'autres preuves</button>
                </div>
              )}
            </>) : (
              <div style={{background: '#e0e7ff', padding: '20px', borderRadius: '8px', textAlign: 'center'}}>
                <p style={{margin: 0, color: '#3730a3', fontSize: '0.95rem', display:'flex', alignItems:'center', gap:6}}><Search size={13}/> Aucune permission validée et activée disponible pour le téléversement de preuve.</p>
              </div>
            )}
          </form>
        </div>
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
              <th style={{ ...th, width: '7%' }}>Preuves</th>
              <th style={{ ...th, width: '5%' }}>État</th>
              <th style={{ ...th, width: '15%' }}>Actions</th>
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
                  <th style={{ ...th, width: '18%' }}>Titre de demande</th>
                  <th style={{ ...th, width: '10%' }}>Demandeur</th>
                  <th style={{ ...th, width: '9%' }}>Statut</th>
                  <th style={{ ...th, width: '9%' }}>Date création</th>
                  <th style={{ ...th, width: '9%' }}>Date départ</th>
                  <th style={{ ...th, width: '9%' }}>Date retour</th>
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
                    <tr key={item.id_operation}>
                      <td style={td}>{item.titre || item.type_demande || 'Permission'} #{item.id_operation}</td>
                      <td style={td}>{item.demandeur?.nom_complet || item.demandeur?.nom || `#${item.matricule}`}</td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: /valid/i.test(item.statut) ? '#065f46' : /refus/i.test(item.statut) ? '#991b1b' : '#92400e', background: /valid/i.test(item.statut) ? '#d1fae5' : /refus/i.test(item.statut) ? '#fee2e2' : '#fef3c7' }}>{item.statut || 'En attente'}</span></td>
                      <td style={td}>{item.date_demande ? String(item.date_demande).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.date_depart ? String(item.date_depart).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.date_retour ? String(item.date_retour).slice(0, 10) : '--'}</td>
                      <td style={td}>{item.duree_jours ?? item.duree ?? '--'} j</td>
                      <td style={td}>{etatBadge}</td>
                      <td style={td}>{renderActionButtons(item, true)}</td>
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

      {/* Modal: Preuves permission */}
      {preuveModalItem && (
        <ProuvesModal
          idOperation={preuveModalItem.id_operation}
          onClose={() => setProuveModalItem(null)}
          onUploaded={loadData}
          readOnly={!!preuveModalItem.readOnly}
        />
      )}

      {/* Modal: Voir détails permission */}
      {detailPermissionItem && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDetailPermissionItem(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={15} style={{ color: '#6366f1' }} /> Détails permission #{detailPermissionItem.id_operation}
              </strong>
              <button onClick={() => setDetailPermissionItem(null)} style={{ padding: '7px 14px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '0.86rem' }}>
              {(detailPermissionItem.titre || detailPermissionItem.motif) && (
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Motif: </span>{detailPermissionItem.titre || detailPermissionItem.motif}</div>
              )}
              {detailPermissionItem.type_permission && (
                <div><span style={{ color: '#64748b', fontWeight: 600 }}>Type: </span>{detailPermissionItem.type_permission}</div>
              )}
              {detailPermissionItem.sous_type && (
                <div><span style={{ color: '#64748b', fontWeight: 600 }}>Sous-type: </span>{detailPermissionItem.sous_type}</div>
              )}
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Conventionnelle: </span>{detailPermissionItem.est_conventionnelle ? 'Oui' : 'Non'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Date début: </span>{detailPermissionItem.date_debut ? new Date(detailPermissionItem.date_debut).toLocaleDateString('fr-FR') : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Date fin: </span>{detailPermissionItem.date_fin ? new Date(detailPermissionItem.date_fin).toLocaleDateString('fr-FR') : '—'}</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Durée: </span>{detailPermissionItem.duree_jours ?? '—'} j</div>
              <div><span style={{ color: '#64748b', fontWeight: 600 }}>Statut: </span>
                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                  color: (detailPermissionItem.statut || '').toLowerCase().includes('valid') ? '#065f46' : (detailPermissionItem.statut || '').toLowerCase().includes('refus') ? '#991b1b' : '#92400e',
                  background: (detailPermissionItem.statut || '').toLowerCase().includes('valid') ? '#d1fae5' : (detailPermissionItem.statut || '').toLowerCase().includes('refus') ? '#fee2e2' : '#fef3c7'
                }}>{detailPermissionItem.statut || 'En attente'}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Preuves: </span>
                {detailPermissionItem.preuves_televersees
                  ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>Téléversées ✓</span>
                      {detailPermissionItem.preuve && (
                        <>
                          <a
                            href={`${api.defaults.baseURL || ''}/uploads/${detailPermissionItem.preuve.replace(/^uploads\//,'').replace(/^\//,'')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #bfdbfe' }}
                          >
                            Voir
                          </a>
                          <a
                            href={`${api.defaults.baseURL || ''}/uploads/${detailPermissionItem.preuve.replace(/^uploads\//,'').replace(/^\//,'')}`}
                            download
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #bbf7d0' }}
                          >
                            Télécharger
                          </a>
                        </>
                      )}
                    </span>
                  )
                  : <span style={{ color: '#9ca3af' }}>Non téléversées</span>}
              </div>
              {(detailPermissionItem.demandeur || detailPermissionItem.demandeur_nom) && (
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Initié par: </span>{[detailPermissionItem.demandeur?.prenom, detailPermissionItem.demandeur?.nom].filter(Boolean).join(' ') || detailPermissionItem.demandeur?.nom_complet || detailPermissionItem.demandeur_nom}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
